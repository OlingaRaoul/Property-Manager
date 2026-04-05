import React, { useState } from 'react';
import axios from 'axios';
import { useAppState } from '../context/StateContext';
import { Edit3, Trash2, MapPin, PlusCircle, Home, DoorClosed, X, Plus, AlertTriangle } from 'lucide-react';

const EMPTY_PROP_FORM = { name: '', address: '' };
const EMPTY_UNIT_FORM = { unitNumber: '', type: '' };

const Properties = () => {
    const { state, setState, API_URL, loading } = useAppState();

    // ── Property modal (create & edit) ──────────────────────────────
    const [propModal, setPropModal] = useState(null); // null | 'create' | property-object
    const [propForm, setPropForm] = useState(EMPTY_PROP_FORM);
    const [propSaving, setPropSaving] = useState(false);
    const [propError, setPropError] = useState('');

    const openCreateProp = () => { setPropForm(EMPTY_PROP_FORM); setPropError(''); setPropModal('create'); };
    const openEditProp   = (p)  => { setPropForm({ name: p.name, address: p.address }); setPropError(''); setPropModal(p); };
    const closePropModal = ()   => { setPropModal(null); setPropError(''); };

    const handleSaveProperty = async () => {
        if (!propForm.name.trim())    { setPropError('Property name is required.'); return; }
        if (!propForm.address.trim()) { setPropError('Address is required.'); return; }
        setPropSaving(true); setPropError('');
        try {
            if (propModal === 'create') {
                const newProp = { id: `p${Date.now()}`, name: propForm.name.trim(), address: propForm.address.trim() };
                await axios.post(`${API_URL}/properties`, newProp);
                setState(prev => ({ ...prev, properties: [...prev.properties, newProp] }));
            } else {
                await axios.put(`${API_URL}/properties/${propModal.id}`, { name: propForm.name.trim(), address: propForm.address.trim() });
                setState(prev => ({ ...prev, properties: prev.properties.map(p => String(p.id) === String(propModal.id) ? { ...p, ...propForm } : p) }));
            }
            closePropModal();
        } catch { setPropError('Failed to save. Please try again.'); }
        finally { setPropSaving(false); }
    };

    // ── Delete property (with confirmation) ─────────────────────────
    const [deleteConfirm, setDeleteConfirm] = useState(null); // property object
    const [deleting, setDeleting] = useState(false);

    const handleDeleteProperty = async () => {
        setDeleting(true);
        try {
            await axios.delete(`${API_URL}/properties/${deleteConfirm.id}`);
            setState(prev => ({
                ...prev,
                properties: prev.properties.filter(p => String(p.id) !== String(deleteConfirm.id)),
                apartments: prev.apartments.filter(a => String(a.propertyId) !== String(deleteConfirm.id)),
            }));
            setDeleteConfirm(null);
        } catch { alert('Failed to delete property.'); }
        finally { setDeleting(false); }
    };

    // ── Unit modal (create & edit) ───────────────────────────────────
    const [unitModal, setUnitModal] = useState(null); // null | { propertyId } | { ...unit (edit) }
    const [unitForm, setUnitForm] = useState(EMPTY_UNIT_FORM);
    const [unitSaving, setUnitSaving] = useState(false);
    const [unitError, setUnitError] = useState('');

    const defaultType = () => state.unit_types[0]?.name || 'Studio';

    const openAddUnit  = (propertyId) => { setUnitForm({ unitNumber: '', type: defaultType() }); setUnitError(''); setUnitModal({ propertyId, mode: 'create' }); };
    const openEditUnit = (unit)       => { setUnitForm({ unitNumber: unit.unitNumber, type: unit.type }); setUnitError(''); setUnitModal({ ...unit, mode: 'edit' }); };
    const closeUnitModal = ()         => { setUnitModal(null); setUnitError(''); };

    const handleSaveUnit = async () => {
        if (!unitForm.unitNumber.trim()) { setUnitError('Unit number is required.'); return; }
        if (!unitForm.type.trim())       { setUnitError('Unit type is required.'); return; }
        setUnitSaving(true); setUnitError('');
        try {
            if (unitModal.mode === 'create') {
                const newUnit = { id: `a${Date.now()}`, propertyId: unitModal.propertyId, unitNumber: unitForm.unitNumber.trim(), type: unitForm.type };
                await axios.post(`${API_URL}/apartments`, newUnit);
                setState(prev => ({ ...prev, apartments: [...prev.apartments, newUnit] }));
            } else {
                await axios.put(`${API_URL}/apartments/${unitModal.id}`, { unitNumber: unitForm.unitNumber.trim(), type: unitForm.type });
                setState(prev => ({ ...prev, apartments: prev.apartments.map(a => String(a.id) === String(unitModal.id) ? { ...a, ...unitForm } : a) }));
            }
            closeUnitModal();
        } catch { setUnitError('Failed to save unit. Please try again.'); }
        finally { setUnitSaving(false); }
    };

    // ── Delete unit ──────────────────────────────────────────────────
    const handleDeleteUnit = async (unitId) => {
        if (!window.confirm('Remove this unit?')) return;
        try {
            await axios.delete(`${API_URL}/apartments/${unitId}`);
            setState(prev => ({ ...prev, apartments: prev.apartments.filter(a => String(a.id) !== String(unitId)) }));
        } catch { alert('Failed to delete unit.'); }
    };

    if (loading) return <div className="loader">Loading properties...</div>;

    const unitTypes = state.unit_types.length > 0
        ? state.unit_types.map(u => u.name)
        : ['Studio', 'Room', '2BR', 'House'];

    // ── Shared modal button style ────────────────────────────────────
    const btnBlue = (disabled) => ({
        backgroundColor: '#2D60FF', color: '#FFFFFF', border: 'none',
        padding: '0.75rem 2rem', borderRadius: '10px', fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
    });

    return (
        <div className="animate-fade-in" style={{ padding: '0 1.5rem' }}>
            {/* ── Page header ── */}
            <div className="view-header" style={{ marginBottom: '2.5rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#343C6A', marginBottom: '1.25rem', fontFamily: 'Outfit' }}>Properties</h2>
                <button className="btn" style={btnBlue(false)} onClick={openCreateProp}>
                    <Plus size={20} /> Add Property
                </button>
            </div>

            {/* ── Property cards ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                {state.properties.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem', color: '#B1B1B1' }}>
                        No properties yet. Click <strong>Add Property</strong> to get started.
                    </div>
                )}
                {state.properties.map(p => {
                    const units = state.apartments.filter(a => String(a.propertyId) === String(p.id));
                    return (
                        <div key={p.id} className="stat-card" style={{ padding: '2.5rem', borderRadius: '25px', backgroundColor: '#FFFFFF', border: '1px solid #E6EFF5', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                            {/* Card header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#718EBF', marginBottom: '0.4rem' }}>Property</div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#343C6A' }}>{p.name}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <button title="Edit property" onClick={() => openEditProp(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#718EBF', padding: '4px' }}>
                                        <Edit3 size={18}/>
                                    </button>
                                    <button title="Delete property" onClick={() => setDeleteConfirm(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF4B4A', padding: '4px' }}>
                                        <Trash2 size={18}/>
                                    </button>
                                </div>
                            </div>

                            <div style={{ fontSize: '0.9rem', color: '#718EBF', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <MapPin size={15} /> {p.address}
                            </div>

                            {/* Add unit button */}
                            <button className="btn" style={{ width: '100%', padding: '1.1rem', borderRadius: '12px', fontSize: '0.95rem', marginBottom: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', backgroundColor: '#2D60FF', color: '#FFFFFF', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                                onClick={() => openAddUnit(p.id)}>
                                <PlusCircle size={20} /> Add Unit
                            </button>

                            {/* Unit inventory */}
                            <div>
                                <h4 style={{ fontSize: '0.8rem', fontWeight: '700', color: '#718EBF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>
                                    APARTMENT INVENTORY ({units.length})
                                </h4>
                                {units.length === 0 && <div style={{ color: '#B1B1B1', fontSize: '0.9rem', padding: '0.75rem 0' }}>No units yet.</div>}
                                {units.map(a => {
                                    const tenant = state.tenants.find(t => t.apartmentId === a.id);
                                    return (
                                        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderTop: '1px solid #F2F4F7' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                {a.type === 'Studio' ? <Home size={17} color="#718EBF" /> : <DoorClosed size={17} color="#718EBF" />}
                                                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#343C6A' }}>
                                                    {a.unitNumber}
                                                    <span style={{ fontWeight: '500', color: '#718EBF', fontSize: '0.82rem', marginLeft: '6px' }}>({a.type})</span>
                                                </span>
                                                {tenant && <span style={{ fontSize: '0.88rem', color: '#343C6A', fontWeight: '500' }}> • {tenant.name}</span>}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                {tenant
                                                    ? <span style={{ fontSize: '0.75rem', padding: '0.35rem 1rem', borderRadius: '40px', background: '#DCFCE7', color: '#15803D', fontWeight: '700' }}>Paid</span>
                                                    : <span style={{ fontSize: '0.75rem', padding: '0.35rem 1rem', borderRadius: '40px', background: '#FEF9C3', color: '#A16207', fontWeight: '700' }}>Vacant</span>
                                                }
                                                <button title="Edit unit" onClick={() => openEditUnit(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#718EBF' }}><Edit3 size={14}/></button>
                                                <button title="Delete unit" onClick={() => handleDeleteUnit(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF4B4A' }}><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ══ Property Modal (Create / Edit) ══ */}
            {propModal && (
                <div className="modal-overlay active">
                    <div className="modal animate-pop-in">
                        <div className="modal-header">
                            <h3>{propModal === 'create' ? 'Add New Property' : 'Edit Property'}</h3>
                            <button className="btn-close" onClick={closePropModal}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            {propError && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', marginBottom: '1.25rem' }}>{propError}</div>}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label>Property Name</label>
                                <input type="text" placeholder="e.g. Westside Towers" value={propForm.name}
                                    onChange={e => setPropForm(f => ({ ...f, name: e.target.value }))} style={{ marginTop: '0.5rem' }} />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label>Full Address</label>
                                <input type="text" placeholder="e.g. 123 Main St, City" value={propForm.address}
                                    onChange={e => setPropForm(f => ({ ...f, address: e.target.value }))} style={{ marginTop: '0.5rem' }} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={closePropModal} disabled={propSaving}>Cancel</button>
                            <button className="btn" style={btnBlue(propSaving)} onClick={handleSaveProperty} disabled={propSaving}>
                                {propSaving ? 'Saving...' : propModal === 'create' ? 'Save Property' : 'Update Property'}
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
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Delete Property?</h3>
                            <p style={{ color: '#718EBF', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                You are about to permanently delete <strong style={{ color: '#343C6A' }}>{deleteConfirm.name}</strong>.
                            </p>
                            <p style={{ color: '#FF4B4A', fontSize: '0.82rem', fontWeight: '600' }}>
                                All units in this property will also be deleted. This cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'center', gap: '1rem', paddingTop: '1.5rem' }}>
                            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</button>
                            <button className="btn" style={{ backgroundColor: '#FF4B4A', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: '10px', fontWeight: '600', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}
                                onClick={handleDeleteProperty} disabled={deleting}>
                                {deleting ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ Unit Modal (Create / Edit) ══ */}
            {unitModal && (
                <div className="modal-overlay active">
                    <div className="modal animate-pop-in">
                        <div className="modal-header">
                            <h3>{unitModal.mode === 'create' ? 'Add New Unit' : 'Edit Unit'}</h3>
                            <button className="btn-close" onClick={closeUnitModal}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            {unitError && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', marginBottom: '1.25rem' }}>{unitError}</div>}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label>Unit Number / Name</label>
                                <input type="text" placeholder="e.g. Apt 301, Suite A, Room 5"
                                    value={unitForm.unitNumber} onChange={e => setUnitForm(f => ({ ...f, unitNumber: e.target.value }))} style={{ marginTop: '0.5rem' }} />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label>Unit Type</label>
                                <select value={unitForm.type} onChange={e => setUnitForm(f => ({ ...f, type: e.target.value }))}
                                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #E6EFF5', background: '#FFFFFF', color: '#343C6A', fontSize: '0.95rem', outline: 'none' }}>
                                    {unitTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={closeUnitModal} disabled={unitSaving}>Cancel</button>
                            <button className="btn" style={btnBlue(unitSaving)} onClick={handleSaveUnit} disabled={unitSaving}>
                                {unitSaving ? 'Saving...' : unitModal.mode === 'create' ? 'Save Unit' : 'Update Unit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Properties;
