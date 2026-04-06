import { useState } from 'react';
import axios from 'axios';
import { useAppState } from '../context/StateContext';
import { formatMonth, calculateRentStatus } from '../utils';
import { UserPlus, Edit, DoorOpen, Trash2, X, AlertTriangle } from 'lucide-react';

const EMPTY_FORM = {
    name: '',
    phone: '',
    email: '',
    propertyId: '',
    apartmentId: '',
    rentAmount: '',
    dueDateDay: '1',
    lastPaidMonth: '',
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
    const { state, setState, API_URL, loading } = useAppState();
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

    // Derived: units available for selected property
    const availableUnits = form.propertyId
        ? state.apartments.filter(a => String(a.propertyId) === String(form.propertyId))
        : [];

    const openCreate = () => {
        const defaultProp = state.properties[0]?.id || '';
        const defaultUnits = defaultProp ? state.apartments.filter(a => String(a.propertyId) === String(defaultProp)) : [];
        setForm({ ...EMPTY_FORM, propertyId: defaultProp, apartmentId: defaultUnits[0]?.id || '' });
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
        if (!form.apartmentId)       return 'Please select a unit.';
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
                apartmentId:   form.apartmentId,
                rentAmount:    Number(form.rentAmount),
                dueDateDay:    Number(form.dueDateDay),
                lastPaidMonth: form.lastPaidMonth || null,
            };

            if (modal === 'create') {
                const newTenant = { id: `t${Date.now()}`, ...payload };
                await axios.post(`${API_URL}/tenants`, newTenant);
                setState(prev => ({ ...prev, tenants: [...prev.tenants, newTenant] }));
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

    const filteredTenants = state.tenants.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.email || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="view-container animate-fade-in" style={{ paddingTop: '1.25rem' }}>
            <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
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

            {/* ── Tenant cards ── */}
            {filteredTenants.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#B1B1B1' }}>
                    No tenants found. Click <strong>Add Tenant</strong> to get started.
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {filteredTenants.map(tenantObj => {
                    const apartment = state.apartments.find(a => String(a.id) === String(tenantObj.apartmentId));
                    const property  = apartment ? state.properties.find(p => String(p.id) === String(apartment.propertyId)) : null;
                    const rentStatus = calculateRentStatus(tenantObj, state.settings);

                    return (
                        <div key={tenantObj.id} className="stat-card animate-slide-in">
                            {/* Card header */}
                            <div className="stat-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #E7EDFF', flexShrink: 0 }}>
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${tenantObj.name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '700', color: '#343C6A', fontSize: '1rem' }}>{tenantObj.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: rentStatus.color || (rentStatus.isPaid ? 'var(--success)' : 'var(--error)'), fontWeight: '700', textTransform: 'uppercase' }}>
                                            {rentStatus.status}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button className="btn-icon" title="Edit" onClick={() => openEdit(tenantObj)}><Edit size={16}/></button>
                                    <button className="btn-icon" title="Delete" style={{ color: 'var(--error)' }} onClick={() => setDeleteConfirm(tenantObj)}><Trash2 size={16}/></button>
                                </div>
                            </div>

                            {/* Rent info */}
                            <div style={{ margin: '1.25rem 0' }}>
                                <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                                    {(tenantObj.rentAmount || 0).toLocaleString()} {state.settings.currency}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                                    {property ? property.name : 'Unassigned'} • {apartment ? apartment.unitNumber : 'No unit'}
                                </div>
                                {tenantObj.phone && <div style={{ fontSize: '0.8rem', color: '#718EBF', marginTop: '0.35rem' }}>📞 {tenantObj.phone}</div>}
                                {tenantObj.email && <div style={{ fontSize: '0.8rem', color: '#718EBF' }}>✉️ {tenantObj.email}</div>}
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

                            {/* Total revenue */}
                            <div style={{ marginTop: '0.5rem', background: 'var(--bg-body)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>Total Revenue</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)' }}>
                                    {state.payments.filter(p => p.tenantId === tenantObj.id).reduce((s, p) => s + p.amount, 0).toLocaleString()} {state.settings.currency}
                                </span>
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
                                <label>Property *</label>
                                <select value={form.propertyId} onChange={e => handlePropertyChange(e.target.value)} style={selectStyle}>
                                    <option value="">— Select property —</option>
                                    {state.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label>Unit *</label>
                                <select value={form.apartmentId} onChange={e => setForm(f => ({ ...f, apartmentId: e.target.value }))} style={selectStyle} disabled={!form.propertyId}>
                                    <option value="">— Select unit —</option>
                                    {availableUnits.map(a => {
                                        const occupied = state.tenants.some(t => String(t.apartmentId) === String(a.id) && (modal === 'create' || String(t.id) !== String(modal?.id)));
                                        return <option key={a.id} value={a.id} disabled={occupied}>{a.unitNumber} ({a.type}){occupied ? ' — Occupied' : ''}</option>;
                                    })}
                                </select>
                            </div>

                            <div>
                                <label>Monthly Rent ({state.settings.currency}) *</label>
                                <input type="number" placeholder="e.g. 1500" min="0" value={form.rentAmount}
                                    onChange={e => setForm(f => ({ ...f, rentAmount: e.target.value }))} style={inputStyle} />
                            </div>

                            <div>
                                <label>Rent Due Day</label>
                                <select value={form.dueDateDay} onChange={e => setForm(f => ({ ...f, dueDateDay: e.target.value }))} style={selectStyle}>
                                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                                        <option key={d} value={d}>Day {d} of each month</option>
                                    ))}
                                </select>
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
        </div>
    );
};

export default Tenants;
