import { useState, useMemo } from 'react';
import axios from 'axios';
import { useAppState } from '../context/StateContext';
import {
    FileText, PlusCircle, X, AlertTriangle, Edit3, Trash2,
    CalendarDays, Building2, User, CheckCircle2, Clock, XCircle, Download
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Given a due day and a month string "YYYY-MM", return the actual due date.
 * If the agreed day exceeds the number of days in that month, use the LAST day.
 * e.g. day=31 in February → Feb 28/29
 */
const computeDueDate = (agreedDay, monthStr) => {
    if (!agreedDay || !monthStr) return null;
    const [year, month] = monthStr.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
    const resolvedDay = Math.min(agreedDay, lastDay);
    return `${monthStr}-${String(resolvedDay).padStart(2, '0')}`;
};

/** Get the last day of any month */
const lastDayOfMonth = (monthStr) => {
    if (!monthStr) return null;
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month, 0).getDate();
};

const TODAY    = new Date().toISOString().split('T')[0];
const THIS_YM  = TODAY.slice(0, 7);

const getContractStatus = (contract) => {
    if (!contract.active) return 'terminated';
    if (contract.startDate > TODAY)  return 'pending';
    if (contract.endDate && contract.endDate < TODAY) return 'expired';
    return 'active';
};

const STATUS_META = {
    active:      { label: 'Active',      bg: '#DCFCE7', color: '#15803D', Icon: CheckCircle2 },
    pending:     { label: 'Pending',     bg: '#FEF9C3', color: '#A16207', Icon: Clock },
    expired:     { label: 'Expired',     bg: '#FEE2E2', color: '#B91C1C', Icon: XCircle },
    terminated:  { label: 'Terminated', bg: '#F1F5F9', color: '#64748B', Icon: XCircle },
};

const EMPTY_FORM = {
    tenantId:    '',
    startDate:   TODAY,
    endDate:     '',
    agreedDay:   '1',   // agreed payment day of the month
    rentAmount:  '',
    deposit:     '',
    notes:       '',
};

const btnBlue = (disabled) => ({
    backgroundColor: '#2D60FF', color: '#fff', border: 'none',
    padding: '0.75rem 2rem', borderRadius: '10px', fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
});

const field = (label, children, full = false) => (
    <div style={{ gridColumn: full ? '1/-1' : 'auto' }}>
        <label style={{ display: 'block', color: '#718EBF', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>{label}</label>
        {children}
    </div>
);

const inputCls = { width: '100%', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #E6EFF5', background: '#fff', color: '#343C6A', fontSize: '0.9rem', outline: 'none', marginTop: '0' };
const selectCls = { ...inputCls };

// ── Component ─────────────────────────────────────────────────────────

const Contracts = () => {
    const { state, setState, API_URL, loading } = useAppState();

    const [modal, setModal]     = useState(null); // null | 'create' | contractObj
    const [form, setForm]       = useState(EMPTY_FORM);
    const [saving, setSaving]   = useState(false);
    const [error, setError]     = useState('');

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting]         = useState(false);

    const [search, setSearch]   = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    const openCreate = () => {
        const first = state.tenants[0];
        setForm({
            ...EMPTY_FORM,
            tenantId:   first?.id || '',
            rentAmount: first ? String(first.rentAmount) : '',
            agreedDay:  first ? String(first.dueDateDay || 1) : '1',
        });
        setError('');
        setModal('create');
    };

    const openEdit = (c) => {
        setForm({
            tenantId:   c.tenantId,
            startDate:  c.startDate,
            endDate:    c.endDate || '',
            agreedDay:  String(c.agreedDay),
            rentAmount: String(c.rentAmount),
            deposit:    String(c.deposit || ''),
            notes:      c.notes || '',
        });
        setError('');
        setModal(c);
    };

    const closeModal = () => { setModal(null); setError(''); };

    const handleTenantChange = (id) => {
        const t = state.tenants.find(t => String(t.id) === String(id));
        setForm(f => ({
            ...f,
            tenantId:   id,
            rentAmount: t ? String(t.rentAmount) : '',
            agreedDay:  t ? String(t.dueDateDay || 1) : '1',
        }));
    };

    const validate = () => {
        if (!form.tenantId)   return 'Please select a tenant.';
        if (!form.startDate)  return 'Start date is required.';
        if (!form.agreedDay)  return 'Agreed payment day is required.';
        if (!form.rentAmount || isNaN(Number(form.rentAmount)) || Number(form.rentAmount) <= 0)
            return 'Enter a valid monthly rent amount.';
        return null;
    };

    const handleSave = async () => {
        const err = validate();
        if (err) { setError(err); return; }
        setSaving(true); setError('');
        try {
            const payload = {
                tenantId:   form.tenantId,
                startDate:  form.startDate,
                endDate:    form.endDate || null,
                agreedDay:  Number(form.agreedDay),
                rentAmount: Number(form.rentAmount),
                deposit:    form.deposit ? Number(form.deposit) : 0,
                notes:      form.notes.trim(),
                active:     true,
            };

            if (modal === 'create') {
                const newContract = { id: `c${Date.now()}`, ...payload };
                await axios.post(`${API_URL}/contracts`, newContract);
                // Also update tenant's dueDateDay to match agreed day
                await axios.put(`${API_URL}/tenants/${form.tenantId}`, { dueDateDay: payload.agreedDay });
                setState(prev => ({
                    ...prev,
                    contracts: [...prev.contracts, newContract],
                    tenants: prev.tenants.map(t =>
                        String(t.id) === String(form.tenantId) ? { ...t, dueDateDay: payload.agreedDay } : t
                    ),
                }));
            } else {
                await axios.put(`${API_URL}/contracts/${modal.id}`, payload);
                setState(prev => ({
                    ...prev,
                    contracts: prev.contracts.map(c =>
                        String(c.id) === String(modal.id) ? { ...c, ...payload } : c
                    ),
                }));
            }
            closeModal();
        } catch { setError('Failed to save contract. Please try again.'); }
        finally { setSaving(false); }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await axios.delete(`${API_URL}/contracts/${deleteTarget.id}`);
            setState(prev => ({ ...prev, contracts: prev.contracts.filter(c => String(c.id) !== String(deleteTarget.id)) }));
            setDeleteTarget(null);
        } catch { alert('Failed to delete contract.'); }
        finally { setDeleting(false); }
    };

    const handleTerminate = async (c) => {
        if (!window.confirm(`Terminate contract for this tenant?`)) return;
        try {
            await axios.put(`${API_URL}/contracts/${c.id}`, { active: false, endDate: TODAY });
            setState(prev => ({
                ...prev,
                contracts: prev.contracts.map(x =>
                    String(x.id) === String(c.id) ? { ...x, active: false, endDate: TODAY } : x
                ),
            }));
        } catch { alert('Failed to terminate contract.'); }
    };

    if (loading) return <div className="loader">Loading contracts...</div>;

    // Filter
    const displayed = state.contracts.filter(c => {
        const tenant = state.tenants.find(t => String(t.id) === String(c.tenantId));
        const matchSearch = !search || (tenant?.name || '').toLowerCase().includes(search.toLowerCase());
        const status = getContractStatus(c);
        const matchStatus = filterStatus === 'all' || status === filterStatus;
        return matchSearch && matchStatus;
    });

    // Stats
    const activeCount = state.contracts.filter(c => getContractStatus(c) === 'active').length;
    const expiredCount = state.contracts.filter(c => ['expired', 'terminated'].includes(getContractStatus(c))).length;
    const totalDeposit = state.contracts.filter(c => getContractStatus(c) === 'active')
        .reduce((s, c) => s + (c.deposit || 0), 0);

    return (
        <div className="view-container animate-fade-in" style={{ paddingTop: '1.25rem' }}>
            {/* ── Header ── */}
            <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ flex: '1', minWidth: '280px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#343C6A', margin: 0, fontFamily: '"Sora", "Outfit", sans-serif', letterSpacing: '-0.5px' }}>
                        Lease Contracts
                    </h2>
                    <p style={{ color: '#718EBF', fontSize: '0.75rem', margin: '0.25rem 0 0', fontWeight: '500' }}>
                        Manage rental agreements and track payment obligations
                    </p>
                </div>
                <button className="btn" style={btnBlue(false)} onClick={openCreate}>
                    <PlusCircle size={18} /> New Contract
                </button>
            </div>

            {/* ── Stats strip ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
                {[
                    { label: 'Active Contracts', value: activeCount, color: '#15803D', bg: '#DCFCE7' },
                    { label: 'Expired / Terminated', value: expiredCount, color: '#B91C1C', bg: '#FEE2E2' },
                    { label: 'Total Deposits Held', value: `${totalDeposit.toLocaleString()} ${state.settings.currency}`, color: '#2D60FF', bg: '#EFF6FF' },
                ].map((s, i) => (
                    <div key={i} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText size={18} color={s.color} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.6rem', color: '#718EBF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#343C6A', fontFamily: 'Outfit' }}>{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Filters ── */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="search-box" style={{ flex: 1, minWidth: '200px' }}>
                    <input type="text" placeholder="Search by tenant name..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {['all', 'active', 'pending', 'expired', 'terminated'].map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)} style={{
                        padding: '0.5rem 1.1rem', borderRadius: '40px', fontWeight: '600', fontSize: '0.82rem',
                        cursor: 'pointer', border: 'none', textTransform: 'capitalize',
                        background: filterStatus === s ? '#2D60FF' : '#F5F7FA',
                        color:      filterStatus === s ? '#fff' : '#718EBF',
                        transition: 'all 0.2s',
                    }}>{s === 'all' ? 'All' : STATUS_META[s]?.label}</button>
                ))}
            </div>

            {/* ── Contract cards ── */}
            {displayed.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#B1B1B1' }}>
                    {state.contracts.length === 0
                        ? <><FileText size={48} style={{ opacity: 0.15, marginBottom: '1rem' }} /><p>No contracts yet. Click <strong>New Contract</strong> to create one.</p></>
                        : <p>No contracts match the current filter.</p>}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {displayed.map(c => {
                    const tenant  = state.tenants.find(t => String(t.id) === String(c.tenantId));
                    const apt     = tenant ? state.apartments.find(a => String(a.id) === String(tenant.apartmentId)) : null;
                    const prop    = apt ? state.properties.find(p => String(p.id) === String(apt.propertyId)) : null;
                    const status  = getContractStatus(c);
                    const meta    = STATUS_META[status];
                    const StatusIcon = meta.Icon;

                    // Compute the actual next due date: agreed day capped to last day of THIS month
                    const dueDateThisMonth = computeDueDate(c.agreedDay, THIS_YM);
                    const lastDayThisMonth  = lastDayOfMonth(THIS_YM);
                    const resolvedDay       = Math.min(c.agreedDay, lastDayThisMonth);

                    return (
                        <div key={c.id} className="stat-card" style={{ padding: '2rem', borderRadius: '20px', border: '1px solid #E6EFF5' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>

                                {/* Left: tenant + property info */}
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #E7EDFF', flexShrink: 0 }}>
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${tenant?.name || 'default'}`} style={{ width: '100%', height: '100%' }} alt="" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#343C6A' }}>{tenant?.name || 'Unknown Tenant'}</div>
                                        <div style={{ fontSize: '0.82rem', color: '#718EBF', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Building2 size={13} /> {prop?.name || '—'} &nbsp;/&nbsp; {apt?.unitNumber || '—'}
                                        </div>
                                        <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {/* Status pill */}
                                            <span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '0.3rem 0.85rem', borderRadius: '40px', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <StatusIcon size={11} /> {meta.label}
                                            </span>
                                            {c.deposit > 0 && (
                                                <span style={{ fontSize: '0.72rem', fontWeight: '600', padding: '0.3rem 0.85rem', borderRadius: '40px', background: '#F5F7FA', color: '#718EBF' }}>
                                                    Deposit: {c.deposit.toLocaleString()} {state.settings.currency}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: actions */}
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {status === 'active' && (
                                        <button title="Terminate contract" onClick={() => handleTerminate(c)}
                                            style={{ fontSize: '0.78rem', fontWeight: '600', padding: '0.45rem 1rem', borderRadius: '8px', background: '#FEE2E2', color: '#B91C1C', border: 'none', cursor: 'pointer' }}>
                                            Terminate
                                        </button>
                                    )}
                                    <button title="Edit" onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#718EBF', padding: '4px' }}><Edit3 size={17}/></button>
                                    <button title="Delete" onClick={() => setDeleteTarget(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF4B4A', padding: '4px' }}><Trash2 size={17}/></button>
                                </div>
                            </div>

                            {/* Contract details grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1.25rem', marginTop: '1.75rem', borderTop: '1px solid #F2F4F7', paddingTop: '1.5rem' }}>
                                {[
                                    { label: 'Monthly Rent', value: `${(c.rentAmount || 0).toLocaleString()} ${state.settings.currency}`, bold: true, color: '#2D60FF' },
                                    { label: 'Agreed Payment Day', value: `Day ${c.agreedDay} of each month` },
                                    {
                                        label: 'Due Date This Month',
                                        value: resolvedDay < c.agreedDay
                                            ? `${dueDateThisMonth} (last day of month)`
                                            : dueDateThisMonth,
                                        color: resolvedDay < c.agreedDay ? '#A16207' : '#15803D',
                                    },
                                    { label: 'Contract Start', value: c.startDate },
                                    { label: 'Contract End', value: c.endDate || 'Open-ended' },
                                ].map((item, i) => (
                                    <div key={i}>
                                        <div style={{ fontSize: '0.72rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{item.label}</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: item.bold ? '800' : '600', color: item.color || '#343C6A' }}>{item.value}</div>
                                    </div>
                                ))}
                            </div>

                            {c.notes && (
                                <div style={{ marginTop: '1rem', background: '#F9FAFB', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.83rem', color: '#718EBF', fontStyle: 'italic' }}>
                                    📝 {c.notes}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ══ Create / Edit Modal ══ */}
            {modal && (
                <div className="modal-overlay active">
                    <div className="modal animate-pop-in" style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <FileText size={20} style={{ color: '#2D60FF' }} />
                                {modal === 'create' ? 'New Rental Contract' : 'Edit Contract'}
                            </h3>
                            <button className="btn-close" onClick={closeModal}><X size={20} /></button>
                        </div>

                        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            {error && (
                                <div style={{ gridColumn: '1/-1', background: '#FEE2E2', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600' }}>
                                    {error}
                                </div>
                            )}

                            {field('Tenant *',
                                <select value={form.tenantId} onChange={e => handleTenantChange(e.target.value)} style={selectCls}>
                                    <option value="">— Select tenant —</option>
                                    {state.tenants.map(t => {
                                        const a = state.apartments.find(a => String(a.id) === String(t.apartmentId));
                                        const p = a ? state.properties.find(p => String(p.id) === String(a.propertyId)) : null;
                                        return <option key={t.id} value={t.id}>{t.name}{p ? ` — ${p.name}` : ''}{a ? ` / ${a.unitNumber}` : ''}</option>;
                                    })}
                                </select>, true
                            )}

                            {field('Monthly Rent *',
                                <input type="number" min="0" placeholder="e.g. 1500" value={form.rentAmount}
                                    onChange={e => setForm(f => ({ ...f, rentAmount: e.target.value }))} style={inputCls} />
                            )}

                            {field('Security Deposit',
                                <input type="number" min="0" placeholder="e.g. 3000" value={form.deposit}
                                    onChange={e => setForm(f => ({ ...f, deposit: e.target.value }))} style={inputCls} />
                            )}

                            {field('Agreed Payment Day *',
                                <>
                                    <select value={form.agreedDay} onChange={e => setForm(f => ({ ...f, agreedDay: e.target.value }))} style={selectCls}>
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                            <option key={d} value={d}>Day {d}{d > 28 ? ' (may use last day of month)' : ''}</option>
                                        ))}
                                    </select>
                                    {form.agreedDay > 28 && (
                                        <div style={{ fontSize: '0.75rem', color: '#A16207', fontWeight: '600', marginTop: '5px' }}>
                                            ⚠ For months with fewer than {form.agreedDay} days, the due date will be the last day of that month.
                                        </div>
                                    )}
                                </>
                            )}

                            {field('Contract Start *',
                                <input type="date" value={form.startDate}
                                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={inputCls} />
                            )}

                            {field('Contract End (leave blank = open-ended)',
                                <input type="date" value={form.endDate}
                                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={inputCls} />, true
                            )}

                            {/* Due date preview */}
                            {form.tenantId && form.agreedDay && (
                                <div style={{ gridColumn: '1/-1', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '10px', padding: '0.85rem 1.1rem' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#15803D', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                        📅 Due Date Preview — Current Month ({THIS_YM})
                                    </div>
                                    <div style={{ fontWeight: '700', color: '#166534', fontSize: '0.95rem' }}>
                                        {(() => {
                                            const resolved = computeDueDate(Number(form.agreedDay), THIS_YM);
                                            const last = lastDayOfMonth(THIS_YM);
                                            const capped = Math.min(Number(form.agreedDay), last);
                                            return capped < Number(form.agreedDay)
                                                ? `${resolved} — Day ${form.agreedDay} doesn't exist this month, using last day (${capped})`
                                                : resolved;
                                        })()}
                                    </div>
                                </div>
                            )}

                            {field('Additional Notes',
                                <input type="text" placeholder="e.g. Includes parking, utilities separate" value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputCls} />, true
                            )}
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
                            <button className="btn" style={btnBlue(saving)} onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : modal === 'create' ? 'Create Contract' : 'Update Contract'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ Delete Confirmation ══ */}
            {deleteTarget && (
                <div className="modal-overlay active">
                    <div className="modal animate-pop-in" style={{ maxWidth: '420px' }}>
                        <div style={{ textAlign: 'center', padding: '1.5rem 0 0.5rem' }}>
                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                                <AlertTriangle size={28} color="#FF4B4A" />
                            </div>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Delete Contract?</h3>
                            <p style={{ color: '#718EBF', fontSize: '0.88rem' }}>
                                This will permanently remove the contract for <strong style={{ color: '#343C6A' }}>
                                    {state.tenants.find(t => String(t.id) === String(deleteTarget.tenantId))?.name || 'this tenant'}
                                </strong>. This cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
                            <button className="btn" style={{ backgroundColor: '#FF4B4A', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: '10px', fontWeight: '600', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}
                                onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contracts;
