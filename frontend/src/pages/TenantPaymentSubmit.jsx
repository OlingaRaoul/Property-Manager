import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAppState } from '../context/StateContext';
import { CheckCircle2, Upload, AlertCircle, FileText, X } from 'lucide-react';

const TenantPaymentSubmit = () => {
    const { token } = useParams();
    const { API_URL, state } = useAppState();
    const currency = state?.settings?.currency || 'CFA';

    const [tenantData, setTenantData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Form states
    const [type, setType] = useState('Rent'); // 'Rent' | 'Deposit' | 'Utility Bill'
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [monthList, setMonthList] = useState([]); // Selected rent months
    const [depositMonths, setDepositMonths] = useState('1'); // Number of deposit months
    const [utilityId, setUtilityId] = useState('');
    const [note, setNote] = useState('');
    
    // File upload states
    const [proofFile, setProofFile] = useState('');
    const [proofFileType, setProofFileType] = useState('');
    const [fileName, setFileName] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchTenant = async () => {
            try {
                const { data } = await axios.get(`${API_URL}/public/tenant/${token}`);
                setTenantData(data);
                
                // Set default month to current month
                const now = new Date();
                const currentMonthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                setMonthList([currentMonthString]);
                
                // Set initial amount to rent amount
                setAmount(String(data.tenant.rentAmount || ''));
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load tenant details. Please check your payment link.');
            } finally {
                setLoading(false);
            }
        };
        fetchTenant();
    }, [token, API_URL]);

    // Handle automated prefilling of amount based on selections
    useEffect(() => {
        if (!tenantData) return;
        const rent = tenantData.tenant.rentAmount || 0;
        
        if (type === 'Rent') {
            setAmount(String(rent * monthList.length));
            setUtilityId('');
        } else if (type === 'Deposit') {
            const count = Number(depositMonths) || 1;
            setAmount(String(rent * count));
            setUtilityId('');
            if (!note) {
                setNote('Security Deposit');
            }
        } else if (type === 'Utility Bill') {
            const firstUtil = tenantData.pendingUtilities?.[0];
            if (firstUtil) {
                setUtilityId(firstUtil.id);
                setAmount(String(firstUtil.amount || ''));
            } else {
                setUtilityId('');
                setAmount('');
            }
        }
    }, [type, monthList, depositMonths, tenantData]);

    // Update amount automatically when utility changes
    const handleUtilityChange = (id) => {
        setUtilityId(id);
        const selectedUtil = tenantData?.pendingUtilities?.find(u => String(u.id) === String(id));
        if (selectedUtil) {
            setAmount(String(selectedUtil.amount || ''));
        }
    };

    // Helper to generate a range of months for rent selection
    const generateMonths = () => {
        const months = [];
        const now = new Date();
        for (let i = -3; i <= 3; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const value = `${yyyy}-${mm}`;
            const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
            months.push({ value, label });
        }
        return months;
    };

    const toggleMonth = (val) => {
        if (monthList.includes(val)) {
            setMonthList(prev => prev.filter(m => m !== val));
        } else {
            setMonthList(prev => [...prev, val].sort());
        }
    };

    // Process file uploads
    const processFile = (file) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert("File exceeds maximum allowed size of 5MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setProofFile(reader.result); // Base64 Data URL
            setProofFileType(file.type);
            setFileName(file.name);
        };
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e) => {
        processFile(e.target.files[0]);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const clearFile = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setProofFile('');
        setProofFileType('');
        setFileName('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || Number(amount) <= 0) {
            alert("Please enter a valid payment amount.");
            return;
        }
        if (type === 'Rent' && monthList.length === 0) {
            alert("Please select at least one billing month.");
            return;
        }
        if (!proofFile) {
            alert("Please upload a file copy of your payment confirmation (receipt/screenshot).");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                paymentToken: token,
                type,
                amount: Number(amount),
                date,
                monthList: type === 'Rent' ? monthList : undefined,
                depositMonths: type === 'Deposit' ? Number(depositMonths) : undefined,
                utilityId: type === 'Utility Bill' ? utilityId : undefined,
                note,
                proofFile,
                proofFileType
            };
            await axios.post(`${API_URL}/public/payments/submit`, payload);
            setSuccess(true);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to submit payment proof. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="submit-page-container">
                <div className="spinner" />
                <span style={{ marginTop: '1rem', color: '#718EBF', fontWeight: 600 }}>Loading secure portal...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="submit-page-container">
                <div className="error-card animate-pop-in">
                    <AlertCircle size={48} color="#FF4B4A" />
                    <h2>Invalid Link</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    const { tenant, apartment, property, pendingUtilities } = tenantData;

    return (
        <div className="submit-page-container">
            <style>{`
                .submit-page-container {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #F5F7FA 0%, #E4ECF7 100%);
                    padding: 2rem 1rem;
                    font-family: 'Inter', sans-serif;
                }
                .spinner {
                    width: 50px;
                    height: 50px;
                    border: 4px solid rgba(45, 96, 255, 0.1);
                    border-left-color: #2D60FF;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .error-card {
                    background: #FFFFFF;
                    padding: 3rem 2rem;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.05);
                    max-width: 450px;
                    width: 100%;
                    text-align: center;
                    border: 1px solid #E6EFF5;
                }
                .error-card h2 {
                    color: #343C6A;
                    margin: 1.5rem 0 0.75rem;
                    font-weight: 800;
                    font-size: 1.5rem;
                }
                .error-card p {
                    color: #718EBF;
                    line-height: 1.5;
                }
                .portal-card {
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    border-radius: 24px;
                    box-shadow: 0 20px 50px rgba(45, 96, 255, 0.08);
                    max-width: 580px;
                    width: 100%;
                    padding: 2.5rem;
                    box-sizing: border-box;
                }
                .portal-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                .portal-header h1 {
                    font-size: 1.6rem;
                    font-weight: 800;
                    color: #343C6A;
                    margin-bottom: 0.5rem;
                    letter-spacing: -0.5px;
                }
                .portal-header p {
                    color: #718EBF;
                    font-size: 0.95rem;
                    font-weight: 500;
                }
                .tenant-badge {
                    background: #E7EDFF;
                    border: 1px solid #C5D6FF;
                    border-radius: 16px;
                    padding: 1rem 1.25rem;
                    margin-bottom: 2rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                .tenant-badge img {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: #FFF;
                    border: 2px solid #FFF;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.05);
                }
                .tenant-badge-info h3 {
                    color: #343C6A;
                    font-size: 1.05rem;
                    font-weight: 700;
                    margin-bottom: 0.2rem;
                }
                .tenant-badge-info p {
                    color: #718EBF;
                    font-size: 0.85rem;
                    font-weight: 600;
                }
                .form-group {
                    margin-bottom: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .form-group label {
                    color: #343C6A;
                    font-weight: 700;
                    font-size: 0.875rem;
                }
                .form-control {
                    width: 100%;
                    padding: 0.85rem 1rem;
                    border: 1px solid #D2DCF2;
                    border-radius: 12px;
                    background: #FFFFFF;
                    font-size: 0.95rem;
                    color: #343C6A;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .form-control:focus {
                    border-color: #2D60FF;
                    box-shadow: 0 0 0 4px rgba(45, 96, 255, 0.1);
                }
                .type-selector {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1.5rem;
                }
                .type-btn {
                    flex: 1;
                    padding: 0.85rem 0.5rem;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid #D2DCF2;
                    background: #FFFFFF;
                    color: #718EBF;
                    text-align: center;
                }
                .type-btn.active {
                    background: #2D60FF;
                    color: #FFFFFF;
                    border-color: #2D60FF;
                    box-shadow: 0 4px 12px rgba(45, 96, 255, 0.2);
                }
                .dropzone {
                    border: 2px dashed #B8C7E0;
                    border-radius: 16px;
                    padding: 2rem 1.5rem;
                    text-align: center;
                    background: rgba(245, 247, 250, 0.5);
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                }
                .dropzone.active {
                    border-color: #2D60FF;
                    background: rgba(45, 96, 255, 0.05);
                }
                .dropzone-label {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    color: #718EBF;
                    font-size: 0.875rem;
                    font-weight: 600;
                }
                .file-info-badge {
                    background: #F4F7FE;
                    border: 1px solid #E2E8F0;
                    border-radius: 10px;
                    padding: 0.6rem 1rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-top: 0.5rem;
                }
                .file-info-badge span {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #343C6A;
                    max-width: 250px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .btn-submit {
                    width: 100%;
                    padding: 1rem;
                    border-radius: 14px;
                    border: none;
                    background: linear-gradient(135deg, #2D60FF 0%, #003CD6 100%);
                    color: white;
                    font-weight: 700;
                    font-size: 1.05rem;
                    cursor: pointer;
                    transition: all 0.3s;
                    box-shadow: 0 6px 20px rgba(45, 96, 255, 0.35);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }
                .btn-submit:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(45, 96, 255, 0.45);
                }
                .btn-submit:disabled {
                    background: #C4C4C4;
                    box-shadow: none;
                    cursor: not-allowed;
                }
                .success-card {
                    background: #FFFFFF;
                    border-radius: 24px;
                    padding: 4rem 2rem;
                    text-align: center;
                    max-width: 500px;
                    width: 100%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.05);
                    border: 1px solid #E6EFF5;
                }
                .success-card h2 {
                    color: #343C6A;
                    font-size: 1.75rem;
                    font-weight: 800;
                    margin: 1.5rem 0 0.5rem;
                }
                .success-card p {
                    color: #718EBF;
                    line-height: 1.6;
                    margin-bottom: 2rem;
                    font-weight: 500;
                }
                .receipt-summary {
                    background: #F8FAFC;
                    border-radius: 16px;
                    padding: 1.25rem;
                    margin-bottom: 2rem;
                    border: 1px solid #E2E8F0;
                    text-align: left;
                }
                .receipt-summary-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.5rem 0;
                    border-bottom: 1px solid #EDF2F7;
                    font-size: 0.9rem;
                }
                .receipt-summary-item:last-child {
                    border-bottom: none;
                }
                .receipt-summary-item span:first-child {
                    color: #718EBF;
                    font-weight: 600;
                }
                .receipt-summary-item span:last-child {
                    color: #343C6A;
                    font-weight: 800;
                }
                .animate-pop-in {
                    animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                @keyframes popIn {
                    0% { transform: scale(0.9); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .months-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.75rem;
                    margin-top: 0.25rem;
                }
                .month-checkbox-label {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.85rem 1rem;
                    border: 1.5px solid #D2DCF2;
                    border-radius: 12px;
                    background: #FFFFFF;
                    cursor: pointer;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #343C6A;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    user-select: none;
                }
                .month-checkbox-label.checked {
                    border-color: #2D60FF;
                    background: #F0F4FF;
                    box-shadow: 0 4px 10px rgba(45, 96, 255, 0.08);
                }
                .month-checkbox-label input {
                    width: 16px;
                    height: 16px;
                    accent-color: #2D60FF;
                    cursor: pointer;
                }
                .selector-hint {
                    font-size: 0.8rem;
                    color: #718EBF;
                    font-weight: 600;
                    margin-top: 0.5rem;
                }
            `}</style>

            {success ? (
                <div className="success-card animate-pop-in">
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <CheckCircle2 size={72} color="#41D433" />
                    </div>
                    <h2>Submission Received!</h2>
                    <p>
                        Your proof of payment has been uploaded successfully. It is now pending landlord approval and account reconciliation.
                    </p>

                    <div className="receipt-summary">
                        <div className="receipt-summary-item">
                            <span>Tenant</span>
                            <span>{tenant.name}</span>
                        </div>
                        <div className="receipt-summary-item">
                            <span>Payment For</span>
                            <span>
                                {type === 'Rent' 
                                    ? `Rent (${monthList.join(', ')})` 
                                    : type === 'Deposit' 
                                    ? `Deposit (${depositMonths} Month${Number(depositMonths) > 1 ? 's' : ''})` 
                                    : 'Utility Bill'}
                            </span>
                        </div>
                        <div className="receipt-summary-item">
                            <span>Amount Submitted</span>
                            <span>{Number(amount).toLocaleString()} {currency}</span>
                        </div>
                        <div className="receipt-summary-item">
                            <span>Submission Date</span>
                            <span>{date}</span>
                        </div>
                    </div>

                    <button className="btn-submit" style={{ background: '#718EBF', boxShadow: 'none' }} onClick={() => setSuccess(false)}>
                        Submit Another Payment
                    </button>
                </div>
            ) : (
                <div className="portal-card animate-pop-in">
                    <div className="portal-header">
                        <h1>Tenant Payment Portal</h1>
                        <p>Submit your digital proof of rent, deposit, or utility bills directly to your landlord.</p>
                    </div>

                    <div className="tenant-badge">
                        <img src={`https://robohash.org/${encodeURIComponent(tenant.name)}?set=set4`} alt="Avatar" />
                        <div className="tenant-badge-info">
                            <h3>{tenant.name}</h3>
                            <p>
                                {property ? property.name : 'Horizon Residency'} {apartment ? `• Unit ${apartment.unitNumber}` : ''}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Payment Module</label>
                            <div className="type-selector">
                                <button type="button" className={`type-btn ${type === 'Rent' ? 'active' : ''}`} onClick={() => setType('Rent')}>
                                    Rent
                                </button>
                                <button type="button" className={`type-btn ${type === 'Deposit' ? 'active' : ''}`} onClick={() => setType('Deposit')}>
                                    Deposit
                                </button>
                                <button type="button" className={`type-btn ${type === 'Utility Bill' ? 'active' : ''}`} onClick={() => setType('Utility Bill')}>
                                    Utilities
                                </button>
                            </div>
                        </div>

                        {type === 'Rent' && (
                            <div className="form-group animate-pop-in">
                                <label>Select Billing Month(s) *</label>
                                <div className="months-grid">
                                    {generateMonths().map(m => {
                                        const isChecked = monthList.includes(m.value);
                                        return (
                                            <label key={m.value} className={`month-checkbox-label ${isChecked ? 'checked' : ''}`}>
                                                <input 
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleMonth(m.value)}
                                                />
                                                <span>{m.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <div className="selector-hint">
                                    Selected {monthList.length} month{monthList.length !== 1 ? 's' : ''} (Rent: {Number(tenant.rentAmount).toLocaleString()} {currency}/mo)
                                </div>
                            </div>
                        )}

                        {type === 'Deposit' && (
                            <div className="form-group animate-pop-in">
                                <label>Number of Deposit Months *</label>
                                <select 
                                    className="form-control" 
                                    value={depositMonths} 
                                    onChange={e => setDepositMonths(e.target.value)} 
                                    required
                                >
                                    <option value="1">1 Month</option>
                                    <option value="2">2 Months</option>
                                    <option value="3">3 Months</option>
                                    <option value="4">4 Months</option>
                                </select>
                                <div className="selector-hint">
                                    Deposit: {Number(tenant.rentAmount).toLocaleString()} {currency}/mo
                                </div>
                            </div>
                        )}

                        {type === 'Utility Bill' && (
                            <div className="form-group animate-pop-in">
                                <label>Select Utility Bill *</label>
                                {pendingUtilities && pendingUtilities.length > 0 ? (
                                    <select className="form-control" value={utilityId} onChange={e => handleUtilityChange(e.target.value)} required>
                                        {pendingUtilities.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.type} — {Number(u.amount).toLocaleString()} {currency} ({u.month})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div style={{ color: 'var(--error)', fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem 0' }}>
                                        No pending utility bills found for your apartment.
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="form-group">
                            <label>Payment Amount ({currency}) *</label>
                            <input type="number" className="form-control" placeholder="0" min="1" value={amount} onChange={e => setAmount(e.target.value)} required />
                        </div>

                        <div className="form-group">
                            <label>Payment Date *</label>
                            <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} required />
                        </div>

                        <div className="form-group">
                            <label>Proof of Payment Document (PDF, PNG, JPG) *</label>
                            <div 
                                className={`dropzone ${dragActive ? 'active' : ''}`}
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => document.getElementById('file-upload-input').click()}
                            >
                                <input 
                                    id="file-upload-input"
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                                {fileName ? (
                                    <div className="file-info-badge">
                                        <FileText size={18} color="#2D60FF" />
                                        <span>{fileName}</span>
                                        <button 
                                            onClick={clearFile}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        >
                                            <X size={16} color="#FF4B4A" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="dropzone-label">
                                        <Upload size={32} color="#2D60FF" />
                                        <span>Drag & drop receipt here or click to browse</span>
                                        <span style={{ fontSize: '0.75rem', color: '#A0AEC0' }}>Supports PNG, JPG, PDF up to 5MB</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Optional Note to Landlord</label>
                            <textarea 
                                className="form-control" 
                                rows="3" 
                                placeholder="Enter transaction reference, details, or comments..."
                                value={note}
                                onChange={e => setNote(e.target.value)}
                            />
                        </div>

                        <button type="submit" className="btn-submit" disabled={submitting || (type === 'Utility Bill' && (!pendingUtilities || pendingUtilities.length === 0)) || (type === 'Rent' && monthList.length === 0)}>
                            {submitting ? 'Uploading Proof...' : 'Submit Payment Confirmation'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default TenantPaymentSubmit;
