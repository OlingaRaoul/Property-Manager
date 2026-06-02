import { useState, useEffect } from 'react';
import { useAppState } from '../context/StateContext';
import { t } from '../utils';
import { Settings as SettingsIcon, Mail, Save, Send, Tag, Trash2, CheckCircle } from 'lucide-react';
import axios from 'axios';

const Settings = () => {
    const { state, setState, API_URL, loading } = useAppState();
    const [smtp, setSmtp] = useState({ host: '', port: '587', user: '', pass: '', from: '' });
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
    const [newUnitType, setNewUnitType] = useState('');
    const [testLoading, setTestLoading] = useState(false);
    const lang = state.settings.lang || 'en';

    useEffect(() => {
        const fetchSmtp = async () => {
            try {
                const { data } = await axios.get(`${API_URL}/smtp-settings`);
                setSmtp(prev => ({ ...prev, ...data, pass: '' }));
            } catch (e) { console.error("SMTP fetch failed"); }
        };
        fetchSmtp();
    }, [API_URL]);

    if (loading) return <div>Loading...</div>;

    // Autosave regional settings on select box changes
    const handleRegionalSettingChange = async (key, val) => {
        // Optimistically update frontend state
        setState(s => ({
            ...s,
            settings: { ...s.settings, [key]: val }
        }));
        
        try {
            await axios.post(`${API_URL}/settings`, { key, value: val });
            setStatusMsg({ text: `Auto-saved preference: ${val}`, type: 'success' });
            setTimeout(() => setStatusMsg({ text: '', type: '' }), 2000);
        } catch (e) {
            setStatusMsg({ text: 'Failed to auto-save preference', type: 'error' });
        }
    };

    const saveSmtp = async () => {
        try {
            await axios.post(`${API_URL}/smtp-settings`, smtp);
            setStatusMsg({ text: 'SMTP settings saved successfully!', type: 'success' });
            setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
        } catch (e) { setStatusMsg({ text: 'Failed to save SMTP', type: 'error' }); }
    };

    const testSmtpConnection = async () => {
        setTestLoading(true);
        setStatusMsg({ text: 'Testing SMTP connection...', type: 'info' });
        try {
            const { data } = await axios.post(`${API_URL}/test-smtp`, smtp);
            setStatusMsg({ text: data.message || 'SMTP verified successfully!', type: 'success' });
            setTimeout(() => setStatusMsg({ text: '', type: '' }), 4000);
        } catch (e) {
            const errMsg = e.response?.data?.error || e.message;
            setStatusMsg({ text: errMsg, type: 'error' });
        } finally {
            setTestLoading(false);
        }
    };

    const handleAddUnitType = async () => {
        if (!newUnitType.trim()) return;
        const newObj = { id: `ut_${Date.now()}`, name: newUnitType.trim() };
        try {
            await axios.post(`${API_URL}/unit_types`, newObj);
            setState(prev => ({
                ...prev,
                unit_types: [...prev.unit_types, newObj]
            }));
            setNewUnitType('');
            setStatusMsg({ text: 'Unit category added successfully!', type: 'success' });
            setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
        } catch (e) {
            setStatusMsg({ text: 'Failed to add unit category', type: 'error' });
        }
    };

    const handleDeleteUnitType = async (id) => {
        try {
            await axios.delete(`${API_URL}/unit_types/${id}`);
            setState(prev => ({
                ...prev,
                unit_types: prev.unit_types.filter(ut => ut.id !== id)
            }));
            setStatusMsg({ text: 'Unit category deleted successfully!', type: 'success' });
            setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
        } catch (e) {
            setStatusMsg({ text: 'Failed to delete unit category', type: 'error' });
        }
    };

    return (
        <div className="view-container animate-fade-in" style={{ paddingTop: '1.25rem' }}>
            <div className="view-header" style={{ marginBottom: '2.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#343C6A', margin: 0, fontFamily: 'Outfit' }}>Application Settings</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '2rem', alignItems: 'stretch' }}>
                {/* Regional Settings */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', background: 'white', borderRadius: '20px', boxShadow: 'var(--card-shadow)', border: '1px solid var(--border-light)' }}>
                    <h3 style={{ marginBottom: '1.5rem', fontFamily: 'Outfit', fontWeight: '800' }}>Regional Settings</h3>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Language</label>
                        <select className="search-box" style={{ width: '100%' }} value={state.settings.lang} onChange={e => handleRegionalSettingChange('lang', e.target.value)}>
                            <option value="en">English (UK/US)</option>
                            <option value="fr">Français (France/Afrique)</option>
                        </select>
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Currency Symbol</label>
                        <select className="search-box" style={{ width: '100%' }} value={state.settings.currency} onChange={e => handleRegionalSettingChange('currency', e.target.value)}>
                            <option value="$">$ (USD)</option>
                            <option value="€">€ (EUR)</option>
                            <option value="£">£ (GBP)</option>
                            <option value="FCFA">FCFA</option>
                        </select>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto', fontStyle: 'italic' }}>
                        * Settings are saved automatically as soon as they are changed.
                    </p>
                </div>

                {/* Unit Types Manager */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', background: 'white', borderRadius: '20px', boxShadow: 'var(--card-shadow)', border: '1px solid var(--border-light)' }}>
                    <h3 style={{ marginBottom: '1.5rem', fontFamily: 'Outfit', fontWeight: '800' }}>Managed Unit Categories</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        <input type="text" className="search-box" style={{ flex: 1 }} placeholder="e.g. Warehouse" value={newUnitType} onChange={e => setNewUnitType(e.target.value)} />
                        <button className="btn btn-primary" onClick={handleAddUnitType} style={{ padding: '0.75rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Add</button>
                    </div>
                    <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                        {state.unit_types.map(ut => (
                            <div key={ut.id} className="glass" style={{ padding: '0.75rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                   <Tag size={14} style={{ color: 'var(--primary)' }} />
                                   <span style={{ fontWeight: '600' }}>{ut.name}</span>
                                </div>
                                <button className="btn-icon" onClick={() => handleDeleteUnitType(ut.id)} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* SMTP Config */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', background: 'white', borderRadius: '20px', boxShadow: 'var(--card-shadow)', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            <Mail size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontFamily: 'Outfit', fontWeight: 800, fontSize: '1rem' }}>Email & SMTP Configuration</h3>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Configure outgoing email for receipt delivery</p>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '1rem', marginBottom: '1rem' }}>
                        <input type="text" className="search-box" placeholder="SMTP Host" value={smtp.host || ''} onChange={e => setSmtp({...smtp, host: e.target.value})} />
                        <input type="number" className="search-box" placeholder="Port" value={smtp.port || '587'} onChange={e => setSmtp({...smtp, port: e.target.value})} />
                    </div>
                    <input type="email" className="search-box" style={{ width: '100%', marginBottom: '1rem' }} placeholder="Login/Email" value={smtp.user || ''} onChange={e => setSmtp({...smtp, user: e.target.value})} />
                    <input type="password" className="search-box" style={{ width: '100%', marginBottom: '1rem' }} placeholder="Password" value={smtp.pass || ''} onChange={e => setSmtp({...smtp, pass: e.target.value})} />
                    <input type="text" className="search-box" style={{ width: '100%', marginBottom: '1.5rem' }} placeholder="Sender Name" value={smtp.from || ''} onChange={e => setSmtp({...smtp, from: e.target.value})} />
                    
                    <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-primary" onClick={saveSmtp} style={{ flex: 1, padding: '0.75rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <Save size={15} /> Save SMTP
                        </button>
                        <button className="btn btn-secondary" onClick={testSmtpConnection} disabled={testLoading} style={{ flex: 1, padding: '0.75rem', background: 'var(--secondary)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: testLoading ? 0.6 : 1 }}>
                            <Send size={15} /> {testLoading ? 'Testing...' : 'Test'}
                        </button>
                    </div>
                </div>
            </div>
            
            {statusMsg.text && (
                <div style={{ color: statusMsg.type === 'success' ? 'var(--success)' : statusMsg.type === 'error' ? 'var(--error)' : 'var(--primary)', textAlign: 'center', fontWeight: 600, marginTop: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    {statusMsg.type === 'success' && <CheckCircle size={16} />}
                    <span>{statusMsg.text}</span>
                </div>
            )}
        </div>
    );
};

export default Settings;
