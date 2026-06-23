import { useState } from 'react';
import axios from 'axios';
import { useAppState } from '../context/StateContext';
import { formatMonth, calculateRentStatus, getMonthsDifference } from '../utils';
import { UserPlus, Edit, Trash2, X, AlertTriangle, Link } from 'lucide-react';

const EMPTY_FORM = {
    name: '',
    phone: '',
    email: '',
    propertyId: '',
    apartmentId: '',
    rentAmount: '',
    dueDateDay: '1',
    lastPaidMonth: '',
    depositMonths: '0',
    isAssigned: 'true'
};

const btnBlue = (disabled) => ({
    backgroundColor: '#2D60FF', color: '#FFFFFF', border: 'none',
    padding: '0.75rem 2rem', borderRadius: '10px', fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    textAlign: 'center',
});

const inputStyle = { marginTop: '0.5rem', width: '100%' };
const selectStyle = {
    marginTop: '0.5rem', width: '100%', padding: '0.8rem 1rem',
    borderRadius: '10px', border: '1px solid #E6EFF5',
    background: '#FFFFFF', color: '#343C6A', fontSize: '0.95rem', outline: 'none',
};

const Tenants = () => {
    const { state, setState, API_URL, loading, showTenantHistory } = useAppState();
    const lang = state.settings.lang || 'en';

    const [search, setSearch] = useState('');

    // ── Add / Edit modal ─────────────────────────────────────────────
    const [modal, setModal]   = useState(null); // null | 'create' | tenantObj
    const [form, setForm]     = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState('');

    // ── Delete confirmation ──────────────────────────────────────────
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [deleting, setDeleting]           = useState(false);
    
    // Toast notification state
    const [toast, setToast] = useState('');
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'unassigned'

    const copyPaymentLink = (tenant) => {
        if (!tenant.paymentToken) {
            // Self-healing fallback if token isn't in state
            alert("No payment token found for this tenant. Try editing the tenant or reloading.");
            return;
        }
        let base = import.meta.env.VITE_FRONTEND_URL || state.settings.frontendBaseUrl || window.location.origin;
        base = base.trim();
        
        // Self-healing: if the saved setting contains localhost/127.0.0.1 but the landlord accesses the app via a production domain,
        // ignore the stale local database setting and fall back to the actual browser origin.
        const isCurrentLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const isBaseLocal = base.includes('localhost') || base.includes('127.0.0.1');
        if (isBaseLocal && !isCurrentLocal) {
            base = window.location.origin;
        }

        if (base && !/^https?:\/\//i.test(base)) {
            // If no protocol specified, prepend window protocol
            base = `${window.location.protocol}//${base}`;
        }
        const link = `${base.replace(/\/+$/, '')}/pay/${tenant.paymentToken}`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => {
                setToast(`Copied payment link for ${tenant.name}!`);
                setTimeout(() => setToast(''), 3000);
            }).catch(err => {
                console.error("Clipboard copy failed", err);
                fallbackCopy(link, tenant.name);
            });
        } else {
            fallbackCopy(link, tenant.name);
        }
    };

    const fallbackCopy = (text, name) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                setToast(`Copied payment link for ${name}!`);
                setTimeout(() => setToast(''), 3000);
            } else {
                alert(`Could not copy automatically. Here is the link:\n\n${text}`);
            }
        } catch (err) {
            console.error("Fallback copy failed", err);
            alert(`Could not copy automatically. Here is the link:\n\n${text}`);
        }
        document.body.removeChild(textArea);
    };

    // Derived: units available for selected property
    const availableUnits = form.propertyId
        ? state.apartments.filter(a => String(a.propertyId) === String(form.propertyId))
        : [];

    const openCreate = () => {
        const defaultProp = state.properties[0]?.id || '';
        const defaultUnits = defaultProp ? state.apartments.filter(a => String(a.propertyId) === String(defaultProp)) : [];
        setForm({ ...EMPTY_FORM, propertyId: defaultProp, apartmentId: defaultUnits[0]?.id || '', isAssigned: 'true' });
        setError('');
        setModal('create');
    };

    const openEdit = (tenant) => {
        const apt = state.apartments.find(a => String(a.id) === String(tenant.apartmentId));
        setForm({
            name:          tenant.name || '',
            phone:         tenant.phone || '',
            email:         tenant.email || '',
            propertyId:    apt ? String(apt.propertyId) : '',
            apartmentId:   String(tenant.apartmentId || ''),
            rentAmount:    String(tenant.rentAmount || ''),
            dueDateDay:    String(tenant.dueDateDay || '1'),
            lastPaidMonth: tenant.lastPaidMonth || '',
            depositMonths: String(tenant.depositMonths || '0'),
            isAssigned:    tenant.isAssigned !== false ? 'true' : 'false'
        });
        setError('');
        setModal(tenant);
    };

    const closeModal = () => { setModal(null); setError(''); };

    const handlePropertyChange = (propId) => {
        const units = state.apartments.filter(a => String(a.propertyId) === String(propId));
        setForm(f => ({ ...f, propertyId: propId, apartmentId: units[0]?.id || '' }));
    };

    const validate = () => {
        if (!form.name.trim())       return 'Tenant name is required.';
        if (form.isAssigned === 'true') {
            if (!form.apartmentId) return 'Please select a unit for active assignment.';
            // Check if selected unit is occupied by another active tenant
            const occupied = state.tenants.some(t => 
                String(t.apartmentId) === String(form.apartmentId) && 
                t.isAssigned !== false && 
                String(t.id) !== String(modal?.id)
            );
            if (occupied) {
                return 'The selected unit is currently occupied by another active tenant. Please select a vacant unit.';
            }
        }
        if (!form.rentAmount || isNaN(Number(form.rentAmount)) || Number(form.rentAmount) <= 0)
            return 'Enter a valid rent amount.';
        return null;
    };

    const handleSave = async () => {
        const err = validate();
        if (err) { setError(err); return; }
        setSaving(true); setError('');
        try {
            const payload = {
                name:          form.name.trim(),
                phone:         form.phone.trim(),
                email:         form.email.trim(),
                apartmentId:   form.apartmentId || null,
                rentAmount:    Number(form.rentAmount),
                dueDateDay:    Number(form.dueDateDay),
                lastPaidMonth: form.lastPaidMonth || null,
                depositMonths: Number(form.depositMonths || 0),
                depositPaidAmount: modal === 'create' ? 0 : (modal.depositPaidAmount || 0),
                depositMonthsPaid: modal === 'create' ? 0 : (modal.depositMonthsPaid || 0),
                isAssigned:    form.isAssigned === 'true'
            };

            if (modal === 'create') {
                const newTenant = { id: `t${Date.now()}`, ...payload };
                const response = await axios.post(`${API_URL}/tenants`, newTenant);
                const savedTenant = response.data.tenant || newTenant;

                // Automate open-ended contract creation
                const contractPayload = {
                    id: `c${Date.now()}`,
                    tenantId: savedTenant.id,
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: null,
                    agreedDay: Number(savedTenant.dueDateDay) || 1,
                    rentAmount: Number(savedTenant.rentAmount) || 0,
                    deposit: (Number(savedTenant.depositMonths || 0) * Number(savedTenant.rentAmount || 0)) || 0,
                    notes: "Open-ended contract created automatically at registration.",
                    active: true
                };
                try {
                    await axios.post(`${API_URL}/contracts`, contractPayload);
                } catch (e) {
                    console.error("Automatic contract creation failed", e);
                }

                setState(prev => ({ 
                    ...prev, 
                    tenants: [...prev.tenants, savedTenant],
                    contracts: [...prev.contracts, contractPayload]
                }));
            } else {
                await axios.put(`${API_URL}/tenants/${modal.id}`, payload);
                setState(prev => ({
                    ...prev,
                    tenants: prev.tenants.map(t => String(t.id) === String(modal.id) ? { ...t, ...payload } : t),
                }));
            }
            closeModal();
        } catch { setError('Failed to save tenant. Please try again.'); }
        finally { setSaving(false); }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await axios.delete(`${API_URL}/tenants/${deleteConfirm.id}`);
            setState(prev => ({ ...prev, tenants: prev.tenants.filter(t => String(t.id) !== String(deleteConfirm.id)) }));
            setDeleteConfirm(null);
        } catch { alert('Failed to delete tenant.'); }
        finally { setDeleting(false); }
    };

    if (loading) return <div className="loader">Loading tenants...</div>;

    const assignedTenants = state.tenants.filter(t => t.isAssigned !== false);
    const unassignedTenants = state.tenants.filter(t => t.isAssigned === false);

    const filteredAssigned = assignedTenants.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.email || '').toLowerCase().includes(search.toLowerCase())
    );

    const filteredUnassigned = unassignedTenants.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.email || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="view-container animate-fade-in" style={{ paddingTop: '1.25rem' }}>
            <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                {/* Left: title + add button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
                    <h2 style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: '800', 
                        color: '#343C6A', 
                        margin: 0, 
                        fontFamily: '"Sora", "Outfit", sans-serif',
                        letterSpacing: '-0.5px',
                        lineHeight: 1.1,
                      }}>
                        Tenant Registry
                    </h2>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button className="btn" style={btnBlue(false)} onClick={openCreate}>
                            <UserPlus size={18} /> Add Tenant
                        </button>
                        <div className="search-box">
                            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Selector */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #E6EFF5', marginBottom: '2rem', paddingBottom: '0.5rem' }}>
                <button onClick={() => setActiveTab('active')} style={{
                    background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '0.95rem', fontWeight: '700',
                    color: activeTab === 'active' ? '#2D60FF' : '#718EBF',
                    borderBottom: activeTab === 'active' ? '3px solid #2D60FF' : '3px solid transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
                }}>
                    Active Occupants ({assignedTenants.length})
                </button>
                <button onClick={() => setActiveTab('unassigned')} style={{
                    background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '0.95rem', fontWeight: '700',
                    color: activeTab === 'unassigned' ? '#2D60FF' : '#718EBF',
                    borderBottom: activeTab === 'unassigned' ? '3px solid #2D60FF' : '3px solid transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
                }}>
                    Contract Finished / Unassigned ({unassignedTenants.length})
                </button>
            </div>

            {/* ── Tenant cards ── */}
            {((activeTab === 'active' ? filteredAssigned : filteredUnassigned).length === 0) && (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#B1B1B1', width: '100%', gridColumn: '1/-1' }}>
                    {activeTab === 'active' 
                        ? 'No active tenants found. Click Add Tenant to get started.' 
                        : 'No unassigned tenants found.'}
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {(activeTab === 'active' ? filteredAssigned : filteredUnassigned).map(tenantObj => {
                    const apartment = state.apartments.find(a => String(a.id) === String(tenantObj.apartmentId));
                    const property  = apartment ? state.properties.find(p => String(p.id) === String(apartment.propertyId)) : null;
                    const rentStatus = calculateRentStatus(tenantObj, state.settings);

                    // 1. Date of Last Payment
                    const tenantPayments = state.payments.filter(p => String(p.tenantId) === String(tenantObj.id));
                    const sortedPayments = [...tenantPayments].sort((a, b) => b.date.localeCompare(a.date));
                    const lastPaymentDate = sortedPayments.length > 0 ? sortedPayments[0].date : (lang === 'fr' ? 'Aucun paiement' : 'No payments');

                    // Helper to get next month string
                    const getNextMonth = (monthStr) => {
                        if (!monthStr || !monthStr.includes('-')) {
                            const today = new Date();
                            return today.toISOString().slice(0, 7);
                        }
                        const [y, m] = monthStr.split('-').map(Number);
                        let nextY = y;
                        let nextM = m + 1;
                        if (nextM > 12) {
                            nextM = 1;
                            nextY += 1;
                        }
                        return `${nextY}-${String(nextM).padStart(2, '0')}`;
                    };

                    // Helper to get due date of a month capped to the month length
                    const getDueDateForMonth = (dueDateDay, monthStr) => {
                        if (!monthStr || !monthStr.includes('-')) return '';
                        const [y, m] = monthStr.split('-').map(Number);
                        const daysInMonth = new Date(y, m, 0).getDate();
                        const cappedDay = Math.min(dueDateDay || 1, daysInMonth);
                        return `${monthStr}-${String(cappedDay).padStart(2, '0')}`;
                    };

                    // 2. Current Rent Payment Due Date
                    const nextUnpaidMonth = getNextMonth(tenantObj.lastPaidMonth);
                    const nextDueDate = getDueDateForMonth(tenantObj.dueDateDay, nextUnpaidMonth);

                    // 3. Number of months left before next payment
                    const today = new Date();
                    const currentMonthStr = today.toISOString().slice(0, 7);
                    const monthsLeft = Math.max(0, getMonthsDifference(currentMonthStr, tenantObj.lastPaidMonth));

                    return (
                        <div key={tenantObj.id} className="stat-card animate-slide-in">
                            {/* Card header */}
                            <div className="stat-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #E7EDFF', flexShrink: 0 }}>
                                        <img src={`https://robohash.org/${encodeURIComponent(tenantObj.name)}?set=set4`} style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#F5F7FA' }} alt="Avatar" />
                                    </div>
                                    <div>
                                        <div className="clickable-tenant" style={{ fontWeight: '700', fontSize: '1rem' }} onClick={() => showTenantHistory(tenantObj.id)}>
                                            {tenantObj.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: rentStatus.color || (rentStatus.isPaid ? 'var(--success)' : 'var(--error)'), fontWeight: '700', textTransform: 'uppercase' }}>
                                            {rentStatus.status}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button className="btn-icon" title="Copy Payment Link" onClick={() => copyPaymentLink(tenantObj)}><Link size={16}/></button>
                                    <button className="btn-icon" title="Edit" onClick={() => openEdit(tenantObj)}><Edit size={16}/></button>
                                    <button className="btn-icon" title="Delete" style={{ color: 'var(--error)' }} onClick={() => setDeleteConfirm(tenantObj)}><Trash2 size={16}/></button>
                                </div>
                            </div>

                            {/* Rent info */}
                            <div style={{ margin: '1.25rem 0' }}>
                                <div style={{ fontSize: '1.5rem' }}>
                                    {(tenantObj.rentAmount || 0).toLocaleString()} {state.settings.currency}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                                    {tenantObj.isAssigned !== false ? (
                                        `${property ? property.name : 'Unassigned'} • ${apartment ? apartment.unitNumber : 'No unit'}`
                                    ) : (
                                        <span style={{ color: '#D97706', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            ⚠️ Previous Unit: {property ? property.name : '—'} • {apartment ? apartment.unitNumber : '—'}
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#718EBF', marginTop: '0.35rem', fontWeight: '600' }}>
                                    Deposit: {tenantObj.depositMonthsPaid || 0} / {tenantObj.depositMonths || 0} Months Paid
                                </div>
                                {tenantObj.phone && <div style={{ fontSize: '0.8rem', color: '#718EBF', marginTop: '0.35rem' }}>📞 {tenantObj.phone}</div>}
                                {tenantObj.email && <div style={{ fontSize: '0.8rem', color: '#718EBF' }}>✉️ {tenantObj.email}</div>}
                            </div>

                            {/* Payment status breakdown */}
                            <div style={{
                                padding: '0.75rem 1rem',
                                backgroundColor: 'var(--bg-body)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.4rem',
                                border: '1px dashed var(--border-light)',
                                marginBottom: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '500' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{lang === 'fr' ? 'Dernier paiement :' : 'Last Payment:'}</span>
                                    <span style={{ fontWeight: '700', color: '#343C6A' }}>{lastPaymentDate}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '500' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{lang === 'fr' ? "Date d'échéance :" : 'Next Due Date:'}</span>
                                    <span style={{ fontWeight: '700', color: '#343C6A' }}>{nextDueDate}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '500' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{lang === 'fr' ? 'Mois restants :' : 'Months Left:'}</span>
                                    <span style={{
                                        fontWeight: '800',
                                        color: monthsLeft > 0 ? 'var(--success)' : '#D97706',
                                    }}>
                                        {monthsLeft} {lang === 'fr' ? `mois` : `Month${monthsLeft !== 1 ? 's' : ''}`}
                                    </span>
                                </div>
                            </div>

                            {/* Payment history */}
                            <div style={{ padding: '1rem 0', borderTop: '1px dotted var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Recent Payments</div>
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                    {state.payments
                                        .filter(p => String(p.tenantId) === String(tenantObj.id))
                                        .sort((a, b) => a.monthPaid.localeCompare(b.monthPaid))
                                        .slice(-3)
                                        .map(p => (
                                            <span key={p.id} className="status-pill paid" style={{ minWidth: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.65rem' }}>
                                                {formatMonth(p.monthPaid, lang)}
                                            </span>
                                        ))}
                                </div>
                            </div>

                            {/* Revenue Breakdown */}
                            <div style={{ marginTop: '0.5rem', background: 'var(--bg-body)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>Rent Paid</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)' }}>
                                        {state.payments.filter(p => String(p.tenantId) === String(tenantObj.id) && p.type === 'Rent').reduce((s, p) => s + p.amount, 0).toLocaleString()} {state.settings.currency}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '0.35rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>Deposit Paid</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--success)' }}>
                                        {state.payments.filter(p => String(p.tenantId) === String(tenantObj.id) && p.type === 'Deposit').reduce((s, p) => s + p.amount, 0).toLocaleString()} {state.settings.currency}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ══ Add / Edit Tenant Modal ══ */}
            {modal && (
                <div className="modal-overlay active">
                    <div className="modal animate-pop-in" style={{ maxWidth: '580px' }}>
                        <div className="modal-header">
                            <h3>{modal === 'create' ? 'Add New Tenant' : 'Edit Tenant'}</h3>
                            <button className="btn-close" onClick={closeModal}><X size={20} /></button>
                        </div>

                        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            {error && (
                                <div style={{ gridColumn: '1/-1', background: '#FEE2E2', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600' }}>
                                    {error}
                                </div>
                            )}

                            <div style={{ gridColumn: '1/-1' }}>
                                <label>Full Name *</label>
                                <input type="text" placeholder="e.g. John Smith" value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
                            </div>

                            <div>
                                <label>Phone Number</label>
                                <input type="tel" placeholder="e.g. +1 555 000 0000" value={form.phone}
                                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
                            </div>

                            <div>
                                <label>Email Address</label>
                                <input type="email" placeholder="e.g. john@email.com" value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                            </div>

                            <div>
                                <label>Property</label>
                                <select value={form.propertyId} onChange={e => handlePropertyChange(e.target.value)} style={selectStyle}>
                                    <option value="">— Unassigned —</option>
                                    {state.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label>Unit</label>
                                <select value={form.apartmentId} onChange={e => {
                                    const val = e.target.value;
                                    setForm(f => ({ ...f, apartmentId: val, propertyId: val ? f.propertyId : '' }));
                                }} style={selectStyle} disabled={!form.propertyId}>
                                    <option value="">— Unassigned —</option>
                                    {availableUnits.map(a => {
                                        const occupied = state.tenants.some(t => String(t.apartmentId) === String(a.id) && t.isAssigned !== false && (modal === 'create' || String(t.id) !== String(modal?.id)));
                                        return <option key={a.id} value={a.id} disabled={occupied}>{a.unitNumber} ({a.type}){occupied ? ' — Occupied' : ''}</option>;
                                    })}
                                </select>
                                {form.apartmentId && state.tenants.some(t => String(t.apartmentId) === String(form.apartmentId) && t.isAssigned !== false && String(t.id) !== String(modal?.id)) && (
                                    <div style={{ fontSize: '0.75rem', color: '#B91C1C', fontWeight: '600', marginTop: '5px' }}>
                                        ⚠ This unit is occupied by another active tenant.
                                    </div>
                                )}
                            </div>

                            <div>
                                <label>Monthly Rent ({state.settings.currency}) *</label>
                                <input type="number" placeholder="e.g. 1500" min="0" value={form.rentAmount}
                                    onChange={e => setForm(f => ({ ...f, rentAmount: e.target.value }))} style={inputStyle} />
                            </div>

                            <div>
                                <label>Assignment Status</label>
                                <select value={form.isAssigned} onChange={e => setForm(f => ({ ...f, isAssigned: e.target.value }))} style={selectStyle}>
                                    <option value="true">Active (Occupying Unit)</option>
                                    <option value="false">Unassigned (Contract Finished)</option>
                                </select>
                            </div>

                            <div>
                                <label>Rent Due Day</label>
                                <select value={form.dueDateDay} onChange={e => setForm(f => ({ ...f, dueDateDay: e.target.value }))} style={selectStyle}>
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                        <option key={d} value={d}>Day {d}{d > 28 ? ' (may use last day of month)' : ''}</option>
                                    ))}
                                </select>
                                {Number(form.dueDateDay) > 28 && (
                                    <div style={{ fontSize: '0.75rem', color: '#A16207', fontWeight: '600', marginTop: '5px' }}>
                                        ⚠ For months with fewer than {form.dueDateDay} days, the due date will be the last day of that month.
                                    </div>
                                )}
                            </div>

                            <div>
                                <label>Deposit Months</label>
                                <input type="number" min="0" placeholder="e.g. 2" value={form.depositMonths}
                                    onChange={e => setForm(f => ({ ...f, depositMonths: e.target.value }))} style={inputStyle} />
                            </div>

                            <div style={{ gridColumn: '1/-1' }}>
                                <label>Last Paid Month (optional)</label>
                                <input type="month" value={form.lastPaidMonth}
                                    onChange={e => setForm(f => ({ ...f, lastPaidMonth: e.target.value }))} style={inputStyle} />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
                            <button className="btn" style={btnBlue(saving)} onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : modal === 'create' ? 'Add Tenant' : 'Update Tenant'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ Delete Confirmation Modal ══ */}
            {deleteConfirm && (
                <div className="modal-overlay active">
                    <div className="modal animate-pop-in" style={{ maxWidth: '420px' }}>
                        <div style={{ textAlign: 'center', padding: '1.5rem 0 0.5rem' }}>
                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                                <AlertTriangle size={28} color="#FF4B4A" />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Remove Tenant?</h3>
                            <p style={{ color: '#718EBF', fontSize: '0.9rem' }}>
                                You are about to remove <strong style={{ color: '#343C6A' }}>{deleteConfirm.name}</strong> from the registry. Their payment history will not be deleted.
                            </p>
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</button>
                            <button className="btn" style={{ backgroundColor: '#FF4B4A', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: '10px', fontWeight: '600', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}
                                onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Removing...' : 'Yes, Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className="toast animate-fade-in" style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    background: '#343C6A',
                    color: '#fff',
                    padding: '0.8rem 1.5rem',
                    borderRadius: '10px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                    zIndex: 9999,
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <span>{toast}</span>
                </div>
            )}
        </div>
    );
};

export default Tenants;
