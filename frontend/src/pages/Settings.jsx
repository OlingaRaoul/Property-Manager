import { useState, useEffect, useRef } from 'react';
import { useAppState } from '../context/StateContext';
import { t } from '../utils';
import { Settings as SettingsIcon, Mail, Save, Send, Tag, Trash2, CheckCircle, PenTool, Upload, RefreshCw, X, Edit, Lock } from 'lucide-react';
import axios from 'axios';

const Settings = () => {
    const { state, setState, API_URL, loading } = useAppState();
    const [smtp, setSmtp] = useState({ host: '', port: '587', user: '', pass: '', from: '' });
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
    const [newUnitType, setNewUnitType] = useState('');
    const [testLoading, setTestLoading] = useState(false);
    const lang = state.settings.lang || 'en';

    // Signature state
    const [signatureMode, setSignatureMode] = useState('preview'); // 'preview' | 'draw' | 'upload'
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadPreview, setUploadPreview] = useState('');
    const canvasRef = useRef(null);

    // Password state
    const [pwdState, setPwdState] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdStatus, setPwdStatus] = useState({ text: '', type: '' });

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPwdStatus({ text: '', type: '' });

        if (!pwdState.currentPassword || !pwdState.newPassword || !pwdState.confirmPassword) {
            setPwdStatus({ text: 'All fields are required.', type: 'error' });
            return;
        }

        if (pwdState.newPassword !== pwdState.confirmPassword) {
            setPwdStatus({ text: 'New passwords do not match.', type: 'error' });
            return;
        }

        if (pwdState.newPassword.length < 6) {
            setPwdStatus({ text: 'New password must be at least 6 characters.', type: 'error' });
            return;
        }

        setPwdLoading(true);
        try {
            const { data } = await axios.post(`${API_URL}/auth/change-password`, {
                currentPassword: pwdState.currentPassword,
                newPassword: pwdState.newPassword
            });
            setPwdStatus({ text: data.message || 'Password updated successfully!', type: 'success' });
            setPwdState({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            setPwdStatus({ text: err.response?.data?.error || 'Failed to update password.', type: 'error' });
        } finally {
            setPwdLoading(false);
        }
    };

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

    // Signature Pad logic
    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#1e293b'; // Slate 800
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const { x, y } = getCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCoordinates(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasDrawn(true);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const saveSignatureToSettings = async (base64Data) => {
        try {
            await axios.post(`${API_URL}/settings`, { key: 'signature', value: base64Data });
            setState(s => ({
                ...s,
                settings: { ...s.settings, signature: base64Data }
            }));
            setSignatureMode('preview');
            setHasDrawn(false);
            setStatusMsg({ text: 'Signature saved successfully!', type: 'success' });
            setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
        } catch (e) {
            setStatusMsg({ text: 'Failed to save signature', type: 'error' });
        }
    };

    const saveDrawSignature = async () => {
        const canvas = canvasRef.current;
        if (!canvas || !hasDrawn) return;
        const base64Data = canvas.toDataURL('image/png');
        await saveSignatureToSettings(base64Data);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setStatusMsg({ text: 'Please select an image file', type: 'error' });
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            setUploadPreview(event.target.result);
        };
        reader.readAsDataURL(file);
        setUploadFile(file);
    };

    const saveUploadSignature = async () => {
        if (!uploadPreview) return;
        await saveSignatureToSettings(uploadPreview);
        setUploadFile(null);
        setUploadPreview('');
    };

    const deleteSignature = async () => {
        if (!confirm('Are you sure you want to delete your signature?')) return;
        try {
            await axios.post(`${API_URL}/settings`, { key: 'signature', value: '' });
            setState(s => ({
                ...s,
                settings: { ...s.settings, signature: '' }
            }));
            setSignatureMode('preview');
            setStatusMsg({ text: 'Signature deleted successfully!', type: 'success' });
            setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
        } catch (e) {
            setStatusMsg({ text: 'Failed to delete signature', type: 'error' });
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
                            <option value="CFA">CFA</option>
                        </select>
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Public Portal URL (Production)</label>
                        <input 
                            type="text" 
                            className="search-box" 
                            style={{ width: '100%' }} 
                            placeholder="e.g. https://app.yourdomain.com" 
                            value={state.settings.frontendBaseUrl || ''} 
                            onChange={e => handleRegionalSettingChange('frontendBaseUrl', e.target.value)} 
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem', lineHeight: '1.3' }}>
                            Used to generate public links for tenants (e.g. payment page). Defaults to the current browser domain if empty.
                        </span>
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

                {/* Landlord Signature Config */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', background: 'white', borderRadius: '20px', boxShadow: 'var(--card-shadow)', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg,#10B981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            <PenTool size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontFamily: 'Outfit', fontWeight: 800, fontSize: '1rem' }}>Landlord Signature</h3>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Set up signature for invoices and receipts</p>
                        </div>
                    </div>

                    {signatureMode === 'preview' && (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
                            {state.settings.signature ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ flex: 1, minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA', borderRadius: '12px', border: '1px solid var(--border-light)', padding: '1rem' }}>
                                        <img src={state.settings.signature} style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain', display: 'block' }} alt="Landlord Signature" />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                        <button className="btn btn-secondary" onClick={() => setSignatureMode('draw')} style={{ flex: 1, padding: '0.6rem', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 600, background: 'var(--secondary)', color: 'white' }}>
                                            <Edit size={14} /> Draw New
                                        </button>
                                        <button className="btn btn-secondary" onClick={() => setSignatureMode('upload')} style={{ flex: 1, padding: '0.6rem', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 600, background: 'var(--secondary)', color: 'white' }}>
                                            <Upload size={14} /> Upload
                                        </button>
                                        <button className="btn btn-secondary" onClick={deleteSignature} style={{ padding: '0.6rem', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#FEE2E2', color: '#EF4444' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic', padding: '1rem' }}>
                                        No signature configured. Rent receipts will render with a blank signature line placeholder.
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                                        <button className="btn btn-primary" onClick={() => setSignatureMode('draw')} style={{ flex: 1, padding: '0.75rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                            <PenTool size={15} /> Draw Signature
                                        </button>
                                        <button className="btn btn-secondary" onClick={() => setSignatureMode('upload')} style={{ flex: 1, padding: '0.75rem', background: 'var(--secondary)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                            <Upload size={15} /> Upload Picture
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {signatureMode === 'draw' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ position: 'relative' }}>
                                <canvas
                                    ref={canvasRef}
                                    width={400}
                                    height={150}
                                    style={{
                                        width: '100%',
                                        height: '150px',
                                        background: '#FCFDFE',
                                        border: '2px dashed var(--border-light)',
                                        borderRadius: '12px',
                                        cursor: 'crosshair',
                                        touchAction: 'none'
                                    }}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                />
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.25rem' }}>
                                    Draw your signature inside the box using mouse, trackpad, or touch screen.
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-primary" onClick={saveDrawSignature} disabled={!hasDrawn} style={{ flex: 1, padding: '0.65rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: 'var(--primary)', color: 'white', opacity: hasDrawn ? 1 : 0.5 }}>
                                    <Save size={14} /> Save Signature
                                </button>
                                <button className="btn btn-secondary" onClick={clearCanvas} style={{ padding: '0.65rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: '#F3F4F6', color: '#4B5563' }}>
                                    <RefreshCw size={14} /> Clear
                                </button>
                                <button className="btn btn-secondary" onClick={() => { setSignatureMode('preview'); setHasDrawn(false); }} style={{ padding: '0.65rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#EF4444', color: 'white' }}>
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {signatureMode === 'upload' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                            <div style={{ border: '2px dashed var(--border-light)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', background: '#FCFDFE', position: 'relative' }}>
                                <input
                                    type="file"
                                    id="signature-upload"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleFileChange}
                                />
                                <label htmlFor="signature-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                    <Upload size={24} style={{ color: 'var(--primary)' }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>Choose image file</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PNG, JPG or SVG formats accepted</span>
                                </label>
                                {uploadPreview && (
                                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Preview:</div>
                                        <img src={uploadPreview} style={{ maxHeight: '70px', maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '0 auto' }} alt="Upload preview" />
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                <button className="btn btn-primary" onClick={saveUploadSignature} disabled={!uploadPreview} style={{ flex: 1, padding: '0.65rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: 'var(--primary)', color: 'white', opacity: uploadPreview ? 1 : 0.5 }}>
                                    <Save size={14} /> Save Signature
                                </button>
                                <button className="btn btn-secondary" onClick={() => { setSignatureMode('preview'); setUploadFile(null); setUploadPreview(''); }} style={{ padding: '0.65rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#EF4444', color: 'white' }}>
                                    <X size={14} /> Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Security & Password */}
                {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                    <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', background: 'white', borderRadius: '20px', boxShadow: 'var(--card-shadow)', border: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                <Lock size={20} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontFamily: 'Outfit', fontWeight: 800, fontSize: '1rem' }}>Security & Password</h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Change your account password directly</p>
                            </div>
                        </div>
                        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', flex: 1 }}>
                            <input 
                                type="password" 
                                className="search-box" 
                                style={{ width: '100%' }} 
                                placeholder="Current Password" 
                                value={pwdState.currentPassword} 
                                onChange={e => setPwdState({ ...pwdState, currentPassword: e.target.value })} 
                                required 
                            />
                            <input 
                                type="password" 
                                className="search-box" 
                                style={{ width: '100%' }} 
                                placeholder="New Password" 
                                value={pwdState.newPassword} 
                                onChange={e => setPwdState({ ...pwdState, newPassword: e.target.value })} 
                                required 
                            />
                            <input 
                                type="password" 
                                className="search-box" 
                                style={{ width: '100%' }} 
                                placeholder="Confirm New Password" 
                                value={pwdState.confirmPassword} 
                                onChange={e => setPwdState({ ...pwdState, confirmPassword: e.target.value })} 
                                required 
                            />
                            {pwdStatus.text && (
                                <div style={{ 
                                    color: pwdStatus.type === 'success' ? 'var(--success)' : 'var(--error)', 
                                    fontSize: '0.8rem', 
                                    fontWeight: '600',
                                    marginTop: '0.25rem'
                                }}>
                                    {pwdStatus.text}
                                </div>
                            )}
                            <button 
                                type="submit" 
                                className="btn btn-primary" 
                                disabled={pwdLoading} 
                                style={{ 
                                    marginTop: 'auto', 
                                    padding: '0.75rem', 
                                    background: 'var(--primary)', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '10px', 
                                    cursor: pwdLoading ? 'not-allowed' : 'pointer', 
                                    fontWeight: 600, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    gap: '0.5rem',
                                    opacity: pwdLoading ? 0.7 : 1
                                }}
                            >
                                <Save size={15} /> {pwdLoading ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                )}
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
