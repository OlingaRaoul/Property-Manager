import { useState } from 'react';
import axios from 'axios';
import { useAppState } from '../context/StateContext';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, XCircle, Eye, Download, Search, FileText, X } from 'lucide-react';
import { formatMonth } from '../utils';

const Submissions = () => {
    const { state, refreshData, API_URL, loading, showTenantHistory } = useAppState();
    const { token } = useAuth();
    const lang = state?.settings?.lang || 'en';

    const [activeTab, setActiveTab] = useState('Pending'); // 'Pending' | 'Approved' | 'Rejected'
    const [search, setSearch] = useState('');
    const [previewFile, setPreviewFile] = useState(null); // { file, type, name }
    const [actionLoading, setActionLoading] = useState(false);

    // Filter submissions (only show payments that have status and a proof document)
    // Tenant submissions always have a status and proofFile
    const allSubmissions = state.payments.filter(p => p.proofFile);

    const filteredSubmissions = allSubmissions.filter(p => {
        const tenant = state.tenants.find(t => String(t.id) === String(p.tenantId));
        const tenantName = tenant ? tenant.name.toLowerCase() : '';
        const matchesSearch = tenantName.includes(search.toLowerCase());
        const matchesStatus = p.status === activeTab;
        return matchesSearch && matchesStatus;
    });

    const handleApprove = async (id) => {
        if (!window.confirm("Are you sure you want to approve this payment submission? This will reconcile the tenant's ledger and update their stats.")) return;
        setActionLoading(true);
        try {
            await axios.put(`${API_URL}/payments/${id}/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Payment approved and reconciled successfully!");
            await refreshData();
        } catch (err) {
            alert(err.response?.data?.error || "Failed to approve payment.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async (id) => {
        if (!window.confirm("Are you sure you want to reject this payment submission? The tenant will need to submit a new receipt.")) return;
        setActionLoading(true);
        try {
            await axios.put(`${API_URL}/payments/${id}/reject`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Payment rejected.");
            await refreshData();
        } catch (err) {
            alert(err.response?.data?.error || "Failed to reject payment.");
        } finally {
            setActionLoading(false);
        }
    };

    const openPreview = (payment, tenant) => {
        setPreviewFile({
            file: payment.proofFile,
            type: payment.proofFileType,
            name: `${tenant?.name || 'Tenant'}_Receipt_${payment.date}`
        });
    };

    if (loading) return <div className="loader">Loading submissions...</div>;

    return (
        <div className="view-container animate-fade-in" style={{ paddingTop: '1.25rem' }}>
            <style>{`
                .tab-bar {
                    display: flex;
                    gap: 1rem;
                    border-bottom: 2px solid var(--border-light);
                    margin-bottom: 2rem;
                    padding-bottom: 0.5rem;
                }
                .tab-item {
                    padding: 0.75rem 1.5rem;
                    border: none;
                    background: none;
                    font-weight: 700;
                    color: var(--text-muted);
                    cursor: pointer;
                    font-size: 0.95rem;
                    position: relative;
                    transition: color 0.2s;
                }
                .tab-item:hover {
                    color: var(--primary);
                }
                .tab-item.active {
                    color: var(--primary);
                }
                .tab-item.active::after {
                    content: '';
                    position: absolute;
                    bottom: -0.65rem;
                    left: 0;
                    width: 100%;
                    height: 3px;
                    background-color: var(--primary);
                    border-radius: 9999px;
                }
                .submission-card {
                    background: var(--bg-card);
                    border-radius: var(--radius-lg);
                    padding: 1.5rem;
                    border: 1px solid var(--border-light);
                    box-shadow: var(--card-shadow);
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                    transition: all 0.2s;
                }
                .submission-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.06);
                    border-color: #CBD5E1;
                }
                .submission-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 1.5rem;
                }
                .meta-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .receipt-preview-box {
                    max-width: 100%;
                    max-height: 60vh;
                    overflow: auto;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border-radius: 12px;
                    background: #F1F5F9;
                    padding: 1rem;
                    border: 1px solid #E2E8F0;
                }
                .preview-image {
                    max-width: 100%;
                    height: auto;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                }
                .btn-group {
                    display: flex;
                    gap: 0.5rem;
                }
                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    padding: 0.25rem 0.75rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .status-badge.pending { background: #FEF9C3; color: #A16207; }
                .status-badge.approved { background: #DCFCE7; color: #15803D; }
                .status-badge.rejected { background: #FEE2E2; color: #B91C1C; }
            `}</style>

            <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
                    <h2 style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: '800', 
                        color: '#343C6A', 
                        margin: 0, 
                        fontFamily: '"Sora", "Outfit", sans-serif',
                        letterSpacing: '-0.5px',
                    }}>
                        Payment Submissions
                    </h2>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div className="search-box">
                            <Search size={18} />
                            <input type="text" placeholder="Search tenant..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="tab-bar">
                <button className={`tab-item ${activeTab === 'Pending' ? 'active' : ''}`} onClick={() => setActiveTab('Pending')}>
                    Pending Approval ({allSubmissions.filter(s => s.status === 'Pending').length})
                </button>
                <button className={`tab-item ${activeTab === 'Approved' ? 'active' : ''}`} onClick={() => setActiveTab('Approved')}>
                    Approved Submissions ({allSubmissions.filter(s => s.status === 'Approved').length})
                </button>
                <button className={`tab-item ${activeTab === 'Rejected' ? 'active' : ''}`} onClick={() => setActiveTab('Rejected')}>
                    Rejected ({allSubmissions.filter(s => s.status === 'Rejected').length})
                </button>
            </div>

            {filteredSubmissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#B1B1B1' }}>
                    No payment submissions found matching filters.
                </div>
            ) : (
                <div className="submission-grid">
                    {filteredSubmissions.map(submission => {
                        const tenant = state.tenants.find(t => String(t.id) === String(submission.tenantId));
                        const apartment = tenant ? state.apartments.find(a => String(a.id) === String(tenant.apartmentId)) : null;
                        const property = apartment ? state.properties.find(p => String(p.id) === String(apartment.propertyId)) : null;

                        return (
                            <div key={submission.id} className="submission-card animate-slide-in">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #E7EDFF' }}>
                                            <img src={`https://robohash.org/${encodeURIComponent(tenant?.name || 'User')}?set=set4`} style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#F5F7FA' }} alt="Avatar" />
                                        </div>
                                        <div>
                                            {tenant ? (
                                                <h4 className="clickable-tenant" style={{ margin: 0, fontWeight: '700', fontSize: '0.95rem' }} onClick={() => showTenantHistory(tenant.id)}>
                                                    {tenant.name}
                                                </h4>
                                            ) : (
                                                <h4 style={{ margin: 0, color: '#343C6A', fontWeight: '700', fontSize: '0.95rem' }}>Unknown Tenant</h4>
                                            )}
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {property ? property.name : 'Unknown Property'} {apartment ? `• Unit ${apartment.unitNumber}` : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`status-badge ${submission.status.toLowerCase()}`}>
                                        {submission.status}
                                    </span>
                                </div>

                                <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '1rem', border: '1px solid #F1F5F9' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Type</span>
                                        <span style={{ fontSize: '0.85rem', color: '#343C6A', fontWeight: '800' }}>
                                            {submission.type} {
                                                submission.type === 'Rent'
                                                    ? (submission.monthList && submission.monthList.length > 0 
                                                        ? `(${submission.monthList.map(m => formatMonth(m, lang)).join(', ')})`
                                                        : (submission.monthPaid ? `(${formatMonth(submission.monthPaid, lang)})` : ''))
                                                    : submission.type === 'Deposit'
                                                    ? `(${submission.depositMonths || 1} Month${Number(submission.depositMonths || 1) > 1 ? 's' : ''})`
                                                    : ''
                                            }
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Amount</span>
                                        <span style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: '800' }}>
                                            {Number(submission.amount).toLocaleString()} {state.settings.currency}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Submitted Date</span>
                                        <span style={{ fontSize: '0.85rem', color: '#343C6A', fontWeight: 600 }}>{submission.date}</span>
                                    </div>
                                </div>

                                {submission.note && (
                                    <div style={{ fontSize: '0.8rem', color: '#718EBF', background: '#F1F5F9', padding: '0.75rem', borderRadius: '8px', fontStyle: 'italic' }}>
                                        "{submission.note}"
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
                                    <button 
                                        className="btn btn-secondary" 
                                        style={{ flex: 1, padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
                                        onClick={() => openPreview(submission, tenant)}
                                    >
                                        <Eye size={16} /> View Receipt
                                    </button>

                                    {submission.status === 'Pending' && (
                                        <div className="btn-group" style={{ flex: 1 }}>
                                            <button 
                                                className="btn" 
                                                style={{ flex: 1, padding: '0.5rem', backgroundColor: 'var(--error)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: actionLoading ? 'not-allowed' : 'pointer' }}
                                                onClick={() => handleReject(submission.id)}
                                                disabled={actionLoading}
                                            >
                                                <XCircle size={16} /> Reject
                                            </button>
                                            <button 
                                                className="btn" 
                                                style={{ flex: 1, padding: '0.5rem', backgroundColor: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: actionLoading ? 'not-allowed' : 'pointer' }}
                                                onClick={() => handleApprove(submission.id)}
                                                disabled={actionLoading}
                                            >
                                                <CheckCircle2 size={16} /> Approve
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ══ Receipt File Preview Modal ══ */}
            {previewFile && (
                <div className="modal-overlay active" onClick={() => setPreviewFile(null)}>
                    <div className="modal animate-pop-in" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>Document: {previewFile.name}</h3>
                            <button className="btn-close" onClick={() => setPreviewFile(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
                            {previewFile.type === 'application/pdf' ? (
                                <div style={{ width: '100%', textAlign: 'center', padding: '2rem 1rem' }}>
                                    <FileText size={64} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                    <h4 style={{ color: '#343C6A', marginBottom: '0.5rem' }}>PDF Receipt Attachment</h4>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                                        Browsers block embedding large local base64 PDFs directly. Download or open in a new browser window to inspect.
                                    </p>
                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                        <a href={previewFile.file} download={`${previewFile.name}.pdf`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
                                            <Download size={18} /> Download PDF
                                        </a>
                                        <a href={previewFile.file} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                                            Open in New Window
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="receipt-preview-box">
                                    <img src={previewFile.file} className="preview-image" alt="Receipt Preview" />
                                </div>
                            )}
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setPreviewFile(null)}>Close Preview</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Submissions;
