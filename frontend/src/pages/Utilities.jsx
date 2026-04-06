import { useState, useMemo } from 'react';
import axios from 'axios';
import { useAppState } from '../context/StateContext';
import { formatMonth } from '../utils';
import {
    Zap, Droplet, Flame, Building2, CheckCircle2, Trash2,
    ZapOff, PlusCircle, X, AlertTriangle, Edit3, ChevronDown, MapPin,
    BarChart3, DollarSign, Clock, Undo2
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────
const TODAY      = new Date().toISOString().split('T')[0];
const THIS_MONTH = TODAY.slice(0, 7);

const UTILITY_TYPES = [
    { value: 'Electricity', icon: Zap,     color: '#F59E0B', bg: '#FEF3C7' },
    { value: 'Water',       icon: Droplet,  color: '#3B82F6', bg: '#DBEAFE' },
    { value: 'Gas',         icon: Flame,    color: '#EF4444', bg: '#FEE2E2' },
];

const typesMeta = (type) => UTILITY_TYPES.find(t => t.value === type) || UTILITY_TYPES[0];

const STATUS_META = {
    Unpaid: { bg: '#FEE2E2', color: '#B91C1C', label: 'Unpaid' },
    Paid:   { bg: '#DCFCE7', color: '#15803D', label: 'Paid' },
};

const EMPTY_FORM = {
    apartmentId: '',
    type:        'Electricity',
    month:       THIS_MONTH,
    date:        TODAY,
    lastReading: '',
    currentReading: '',
    ratePerUnit: '',
    note:        '',
};

const btnBlue = (disabled) => ({
    backgroundColor: '#2D60FF', color: '#fff', border: 'none',
    padding: '0.75rem 1.75rem', borderRadius: '10px', fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
});

const inputStyle = {
    width: '100%', padding: '0.8rem 1rem', borderRadius: '10px',
    border: '1px solid #E6EFF5', background: '#fff', color: '#343C6A',
    fontSize: '0.9rem', outline: 'none', marginTop: '0.35rem',
};

const fieldLabel = (label) => (
    <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: '700', color: '#718EBF', marginBottom: '2px' }}>
        {label}
    </label>
);

// ── Component ─────────────────────────────────────────────────────────
const Utilities = () => {
    const { state, setState, API_URL, loading } = useAppState();
    const lang = state.settings.lang || 'en';

    const [search, setSearch]             = useState('');
    const [filterType, setFilterType]     = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [expandedProps, setExpandedProps] = useState({});

    // Modal
    const [modal, setModal]   = useState(null); // null | 'create' | utilityObj
    const [form, setForm]     = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState('');

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting]         = useState(false);

    // Computed units consumed + amount
    const consumed   = useMemo(() => {
        const c = Number(form.currentReading) - Number(form.lastReading);
        return isNaN(c) || c < 0 ? 0 : c;
    }, [form.currentReading, form.lastReading]);

    const computedAmount = useMemo(() => {
        const rate = Number(form.ratePerUnit);
        return isNaN(rate) ? 0 : consumed * rate;
    }, [consumed, form.ratePerUnit]);

    // Apartment → property lookup used in the form
    const formApt  = form.apartmentId ? state.apartments.find(a => String(a.id) === String(form.apartmentId)) : null;
    const formProp = formApt ? state.properties.find(p => String(p.id) === String(formApt.propertyId)) : null;
    const formTenant = formApt ? state.tenants.find(t => String(t.apartmentId) === String(formApt.id)) : null;

    // Stats
    const totalBilled   = state.utilities.reduce((s, u) => s + (u.amount || 0), 0);
    const totalUnpaid   = state.utilities.filter(u => u.status === 'Unpaid').reduce((s, u) => s + (u.amount || 0), 0);
    const totalReadings = state.utilities.length;

    const openCreate = () => {
        const firstApt = state.apartments[0];
        setForm({ ...EMPTY_FORM, apartmentId: firstApt?.id || '' });
        setError('');
        setModal('create');
    };

    const openEdit = (u) => {
        setForm({
            apartmentId:    u.apartmentId,
            type:           u.type,
            month:          u.month,
            date:           u.date,
            lastReading:    String(u.lastReading),
            currentReading: String(u.currentReading),
            ratePerUnit:    String(u.ratePerUnit || ''),
            note:           u.note || '',
        });
        setError('');
        setModal(u);
    };

    const closeModal = () => { setModal(null); setError(''); };

    const validate = () => {
        if (!form.apartmentId)   return 'Please select a unit.';
        if (!form.month)         return 'Month is required.';
        if (!form.date)          return 'Reading date is required.';
        if (form.lastReading === '') return 'Previous reading is required.';
        if (form.currentReading === '') return 'Current reading is required.';
        if (Number(form.currentReading) < Number(form.lastReading))
            return 'Current reading cannot be less than previous reading.';
        if (!form.ratePerUnit || Number(form.ratePerUnit) <= 0)
            return 'Enter a valid rate per unit.';
        return null;
    };

    const handleSave = async () => {
        const err = validate();
        if (err) { setError(err); return; }
        setSaving(true); setError('');
        try {
            const apt    = state.apartments.find(a => String(a.id) === String(form.apartmentId));
            const tenant = apt ? state.tenants.find(t => String(t.apartmentId) === String(apt.id)) : null;
            const payload = {
                apartmentId:    form.apartmentId,
                tenantId:       tenant?.id || null,
                type:           form.type,
                month:          form.month,
                date:           form.date,
                lastReading:    Number(form.lastReading),
                currentReading: Number(form.currentReading),
                unitsConsumed:  consumed,
                ratePerUnit:    Number(form.ratePerUnit),
                amount:         computedAmount,
                note:           form.note.trim(),
                status:         'Unpaid',
            };

            if (modal === 'create') {
                const newUtil = { id: `u${Date.now()}`, ...payload };
                await axios.post(`${API_URL}/utilities`, newUtil);
                setState(prev => ({ ...prev, utilities: [...prev.utilities, newUtil] }));
            } else {
                await axios.put(`${API_URL}/utilities/${modal.id}`, payload);
                setState(prev => ({
                    ...prev,
                    utilities: prev.utilities.map(u =>
                        String(u.id) === String(modal.id) ? { ...u, ...payload } : u
                    ),
                }));
            }
            closeModal();
        } catch { setError('Failed to save reading. Please try again.'); }
        finally { setSaving(false); }
    };

    const toggleStatus = async (u) => {
        const newStatus = u.status === 'Paid' ? 'Unpaid' : 'Paid';
        try {
            await axios.put(`${API_URL}/utilities/${u.id}`, { status: newStatus });
            setState(prev => ({
                ...prev,
                utilities: prev.utilities.map(x =>
                    String(x.id) === String(u.id) ? { ...x, status: newStatus } : x
                ),
            }));
        } catch { alert(`Failed to mark as ${newStatus.toLowerCase()}.`); }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await axios.delete(`${API_URL}/utilities/${deleteTarget.id}`);
            setState(prev => ({ ...prev, utilities: prev.utilities.filter(u => String(u.id) !== String(deleteTarget.id)) }));
            setDeleteTarget(null);
        } catch { alert('Failed to delete reading.'); }
        finally { setDeleting(false); }
    };

    if (loading) return <div className="loader">Loading utilities...</div>;

    // Filter utilities
    const filtered = state.utilities.filter(u => {
        const apt    = state.apartments.find(a => String(a.id) === String(u.apartmentId));
        const tenant = state.tenants.find(t => String(t.id) === String(u.tenantId));
        const matchSearch = !search ||
            (tenant?.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (apt?.unitNumber || '').toLowerCase().includes(search.toLowerCase());
        const matchType   = filterType === 'All'   || u.type   === filterType;
        const matchStatus = filterStatus === 'All' || u.status === filterStatus;
        return matchSearch && matchType && matchStatus;
    });

    return (
        <div className="animate-fade-in">
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#343C6A', margin: 0, fontFamily: '"Sora","Outfit",sans-serif', letterSpacing: '-0.5px' }}>
                        Utilities
                    </h2>
                    <p style={{ color: '#718EBF', fontSize: '0.9rem', margin: '0.35rem 0 0', fontWeight: '500' }}>
                        Track electricity, water and gas consumption per unit
                    </p>
                </div>
                <button className="btn" style={btnBlue(false)} onClick={openCreate}>
                    <PlusCircle size={18} /> Record Reading
                </button>
            </div>

            {/* ── Stats ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
                {[
                    { icon: BarChart3,   label: 'Total Readings',   value: totalReadings,                                                      color: '#2D60FF', bg: '#EEF2FF' },
                    { icon: DollarSign,  label: 'Total Billed',     value: `${totalBilled.toLocaleString()} ${state.settings.currency}`,       color: '#15803D', bg: '#DCFCE7' },
                    { icon: Clock,       label: 'Outstanding',      value: `${totalUnpaid.toLocaleString()} ${state.settings.currency}`,       color: '#B91C1C', bg: '#FEE2E2' },
                ].map((s, i) => (
                    <div key={i} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <s.icon size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.65rem', color: '#718EBF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#343C6A', fontFamily: 'Outfit' }}>{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Filters ── */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="search-box" style={{ flex: '1 1 100%', minWidth: '100%', marginBottom: '0.5rem' }}>
                    <input type="text" placeholder="Search by tenant or unit..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
                    {['All', ...UTILITY_TYPES.map(t => t.value)].map(t => (
                        <button key={t} onClick={() => setFilterType(t)} style={{
                            padding: '0.5rem 1rem', borderRadius: '40px', fontWeight: '600', fontSize: '0.75rem',
                            cursor: 'pointer', border: 'none',
                            background: filterType === t ? '#2D60FF' : '#F5F7FA',
                            color:      filterType === t ? '#fff'    : '#718EBF',
                        }}>{t}</button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%', marginTop: '0.5rem' }}>
                    {['All', 'Unpaid', 'Paid'].map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)} style={{
                            padding: '0.5rem 1rem', borderRadius: '40px', fontWeight: '600', fontSize: '0.75rem',
                            cursor: 'pointer', border: 'none',
                            background: filterStatus === s ? (s === 'Paid' ? '#15803D' : s === 'Unpaid' ? '#B91C1C' : '#343C6A') : '#F5F7FA',
                            color:      filterStatus === s ? '#fff' : '#718EBF',
                        }}>{s}</button>
                    ))}
                </div>
            </div>

            {/* ── Empty state ── */}
            {state.utilities.length === 0 && (
                <div className="stat-card" style={{ textAlign: 'center', padding: '4rem 2rem', color: '#718EBF' }}>
                    <ZapOff size={48} style={{ opacity: 0.15, marginBottom: '1rem' }} />
                    <p>No utility readings yet. Click <strong>Record Reading</strong> to add the first one.</p>
                </div>
            )}

            {/* ── Grouped by property ── */}
            {state.properties.map(prop => {
                const propUtils = filtered.filter(u => {
                    const apt = state.apartments.find(a => String(a.id) === String(u.apartmentId));
                    return apt && String(apt.propertyId) === String(prop.id);
                });
                if (!propUtils.length) return null;

                const isExpanded  = expandedProps[prop.id] !== false; // default open
                const totalBilled = propUtils.reduce((s, u) => s + (u.amount || 0), 0);
                const unpaidCount = propUtils.filter(u => u.status === 'Unpaid').length;

                return (
                    <div key={prop.id} className="animate-slide-in" style={{ background: '#fff', border: '1px solid #E6EFF5', borderRadius: '20px', overflow: 'hidden', marginBottom: '1.25rem', boxShadow: 'var(--card-shadow)' }}>
                        {/* Property header */}
                        <div onClick={() => setExpandedProps(prev => ({ ...prev, [prop.id]: !isExpanded }))}
                            style={{ padding: '1.25rem 1.5rem', background: '#F9FAFB', borderBottom: '1px solid #E6EFF5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: '1', minWidth: '200px' }}>
                                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Building2 size={20} color="#2D60FF" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: '800', color: '#343C6A', fontSize: '1rem' }}>{prop.name}</div>
                                    <div style={{ fontSize: '0.73rem', color: '#718EBF', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <MapPin size={10} /> {prop.address}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.6rem', color: '#718EBF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Billed</div>
                                    <div style={{ fontWeight: '800', color: '#343C6A', fontSize: '0.9rem' }}>{totalBilled.toLocaleString()} {state.settings.currency}</div>
                                </div>
                                {unpaidCount > 0 && (
                                    <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '0.25rem 0.75rem', borderRadius: '40px', background: '#FEE2E2', color: '#B91C1C', textTransform: 'uppercase' }}>
                                        {unpaidCount} unpaid
                                    </span>
                                )}
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fff', border: '1px solid #E6EFF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ChevronDown size={16} color="#718EBF" style={{ transition: 'transform 0.25s', transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                                </div>
                            </div>
                        </div>

                        {/* Card List (Replaces Table for better mobile UX) */}
                        {isExpanded && (
                            <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {propUtils.sort((a, b) => b.date.localeCompare(a.date)).map(u => {
                                    const tenant = state.tenants.find(t => String(t.id) === String(u.tenantId));
                                    const apt    = state.apartments.find(a => String(a.id) === String(u.apartmentId));
                                    const typeMeta = typesMeta(u.type);
                                    const statusMeta = STATUS_META[u.status] || STATUS_META.Unpaid;
                                    const Icon    = typeMeta.icon;

                                    return (
                                        <div key={u.id} className="animate-slide-in" style={{ 
                                            background: '#F9FAFB', 
                                            borderRadius: '16px', 
                                            padding: '1.25rem', 
                                            border: '1px solid #E6EFF5',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '1rem'
                                        }}>
                                            {/* Card Top: Tenant & Type */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: typeMeta.bg, color: typeMeta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <Icon size={20} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '800', color: '#343C6A', fontSize: '0.95rem' }}>{tenant?.name || 'Unknown'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#718EBF' }}>Unit {apt?.unitNumber || '—'} • {typeMeta.label}</div>
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '0.35rem 0.85rem', borderRadius: '40px', background: statusMeta.bg, color: statusMeta.color, textTransform: 'uppercase' }}>
                                                    {statusMeta.label}
                                                </span>
                                            </div>

                                            {/* Card Middle: Reading & Amount */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: '#fff', borderRadius: '12px', border: '1px solid #E6EFF5' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.65rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Consumption</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#343C6A' }}>
                                                        {u.lastReading} <span style={{ color: '#BDC3C7', margin: '0 4px' }}>→</span> {u.currentReading}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#718EBF', marginTop: '2px' }}>{u.unitsConsumed ?? (u.currentReading - u.lastReading)} units total</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.65rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Total Amount</div>
                                                    <div style={{ fontSize: '1rem', fontWeight: '900', color: '#2D60FF' }}>
                                                        {(u.amount || 0).toLocaleString()} {state.settings.currency}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#718EBF', marginTop: '2px' }}>Reading Date: {u.date}</div>
                                                </div>
                                            </div>

                                            {/* Card Bottom: Actions */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#718EBF' }}>
                                                    Period: {formatMonth(u.month, lang)}
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                    <button 
                                                        title={u.status === 'Unpaid' ? "Mark as Paid" : "Unmark as Paid"} 
                                                        onClick={() => toggleStatus(u)}
                                                        style={{ background: u.status === 'Unpaid' ? '#DCFCE7' : '#F1F5F9', border: 'none', cursor: 'pointer', color: u.status === 'Unpaid' ? '#15803D' : '#718EBF', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: '700' }}>
                                                        {u.status === 'Unpaid' ? <><CheckCircle2 size={16} /> Pay</> : <><Undo2 size={16} /> Undo</>}
                                                    </button>
                                                    <button onClick={() => openEdit(u)} style={{ background: '#F5F7FA', border: 'none', color: '#718EBF', padding: '8px', borderRadius: '8px' }}><Edit3 size={16} /></button>
                                                    <button onClick={() => setDeleteTarget(u)} style={{ background: '#FEE2E2', border: 'none', color: '#FF4B4A', padding: '8px', borderRadius: '8px' }}><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* ══ Record Reading Modal ══ */}
            {modal && (
                <div className="modal-overlay active">
                    <div className="modal animate-pop-in" style={{ maxWidth: '580px' }}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <Zap size={20} style={{ color: '#2D60FF' }} />
                                {modal === 'create' ? 'Record Utility Reading' : 'Edit Reading'}
                            </h3>
                            <button className="btn-close" onClick={closeModal}><X size={20} /></button>
                        </div>

                        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            {error && (
                                <div style={{ gridColumn: '1/-1', background: '#FEE2E2', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600' }}>
                                    {error}
                                </div>
                            )}

                            {/* Unit selector — full width */}
                            <div style={{ gridColumn: '1/-1' }}>
                                {fieldLabel('Unit *')}
                                <select value={form.apartmentId} onChange={e => setForm(f => ({ ...f, apartmentId: e.target.value }))}
                                    style={{ ...inputStyle }}>
                                    <option value="">— Select unit —</option>
                                    {state.properties.map(prop => (
                                        <optgroup key={prop.id} label={prop.name}>
                                            {state.apartments.filter(a => String(a.propertyId) === String(prop.id)).map(a => {
                                                const t = state.tenants.find(t => String(t.apartmentId) === String(a.id));
                                                return (
                                                    <option key={a.id} value={a.id}>
                                                        {a.unitNumber} ({a.type}){t ? ` — ${t.name}` : ' — Vacant'}
                                                    </option>
                                                );
                                            })}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            {/* Tenant info preview */}
                            {formTenant && (
                                <div style={{ gridColumn: '1/-1', background: '#F5F7FA', borderRadius: '10px', padding: '0.8rem 1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                    <div>
                                        <div style={{ fontSize: '0.68rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Tenant</div>
                                        <div style={{ fontWeight: '700', color: '#343C6A', fontSize: '0.88rem' }}>{formTenant.name}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.68rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Property</div>
                                        <div style={{ fontWeight: '700', color: '#343C6A', fontSize: '0.88rem' }}>{formProp?.name || '—'}</div>
                                    </div>
                                </div>
                            )}

                            {/* Utility type */}
                            <div style={{ gridColumn: '1/-1' }}>
                                {fieldLabel('Utility Type *')}
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    {UTILITY_TYPES.map(t => {
                                        const Icon = t.icon;
                                        const active = form.type === t.value;
                                        return (
                                            <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, type: t.value }))}
                                                style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s',
                                                    background: active ? t.bg : '#F9FAFB',
                                                    border: active ? `2px solid ${t.color}` : '2px solid #E6EFF5',
                                                    color: active ? t.color : '#718EBF',
                                                }}>
                                                <Icon size={15} /> {t.value}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Period + date */}
                            <div>
                                {fieldLabel('Month *')}
                                <input type="month" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} style={inputStyle} />
                            </div>
                            <div>
                                {fieldLabel('Reading Date *')}
                                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
                            </div>

                            {/* Readings */}
                            <div>
                                {fieldLabel('Previous Reading *')}
                                <input type="number" min="0" placeholder="e.g. 1250" value={form.lastReading}
                                    onChange={e => setForm(f => ({ ...f, lastReading: e.target.value }))} style={inputStyle} />
                            </div>
                            <div>
                                {fieldLabel('Current Reading *')}
                                <input type="number" min="0" placeholder="e.g. 1380" value={form.currentReading}
                                    onChange={e => setForm(f => ({ ...f, currentReading: e.target.value }))} style={inputStyle} />
                            </div>

                            {/* Rate + computed */}
                            <div>
                                {fieldLabel('Rate per Unit *')}
                                <input type="number" min="0" step="0.01" placeholder="e.g. 12" value={form.ratePerUnit}
                                    onChange={e => setForm(f => ({ ...f, ratePerUnit: e.target.value }))} style={inputStyle} />
                            </div>

                            {/* Live calculation preview */}
                            {consumed > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '0.2rem' }}>
                                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '0.65rem 1rem' }}>
                                        <div style={{ fontSize: '0.68rem', color: '#2D60FF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Auto-calculated</div>
                                        <div style={{ fontWeight: '800', color: '#343C6A', fontSize: '1rem', marginTop: '2px' }}>
                                            {consumed} units × {form.ratePerUnit || 0} = <span style={{ color: '#2D60FF' }}>{computedAmount.toLocaleString()} {state.settings.currency}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ gridColumn: '1/-1' }}>
                                {fieldLabel('Note (optional)')}
                                <input type="text" placeholder="e.g. Faulty meter, estimated reading" value={form.note}
                                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={inputStyle} />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
                            <button className="btn" style={btnBlue(saving)} onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : modal === 'create' ? 'Save Reading' : 'Update Reading'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ Delete Confirm ══ */}
            {deleteTarget && (
                <div className="modal-overlay active">
                    <div className="modal animate-pop-in" style={{ maxWidth: '420px' }}>
                        <div style={{ textAlign: 'center', padding: '1.5rem 0 0.5rem' }}>
                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                                <AlertTriangle size={28} color="#FF4B4A" />
                            </div>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.6rem' }}>Delete Reading?</h3>
                            <p style={{ color: '#718EBF', fontSize: '0.88rem' }}>
                                This will permanently remove the <strong style={{ color: '#343C6A' }}>{deleteTarget.type}</strong> reading for{' '}
                                <strong style={{ color: '#343C6A' }}>
                                    {formatMonth(deleteTarget.month, lang)}
                                </strong>. This cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
                            <button className="btn" style={{ background: '#FF4B4A', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: '10px', fontWeight: '600', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}
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

export default Utilities;
