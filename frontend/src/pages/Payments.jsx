import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useAppState } from '../context/StateContext';
import { formatMonth } from '../utils';
import { Receipt, PlusCircle, Building2, ChevronDown, MapPin, Printer, Trash2, X, CheckCircle2, Lock, CalendarDays } from 'lucide-react';


const TODAY      = new Date().toISOString().split('T')[0];
const THIS_MONTH = TODAY.slice(0, 7);

// Returns the last day of a YYYY-MM string
const lastDay = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m, 0).getDate();
};

// Given agreed payment day and a YYYY-MM month, return the resolved due date as "D MMM"
// If agreed day > days in month, use the last day of that month (the day before the next month)
const getDueDateLabel = (agreedDay, ym) => {
    const last      = lastDay(ym);
    const resolvedD = Math.min(agreedDay, last);
    const [y, m]    = ym.split('-').map(Number);
    const date      = new Date(y, m - 1, resolvedD);
    const dayStr    = String(resolvedD);
    const monthStr  = date.toLocaleString('default', { month: 'short' });
    return { line1: dayStr, line2: monthStr, capped: resolvedD < agreedDay };
};

// Generate a window of months: 6 past + current + 12 future = 19 months
const generateMonthWindow = () => {
    const months = [];
    const now    = new Date();
    for (let i = -6; i <= 12; i++) {
        const d   = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const fallbackLabel = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        months.push({ val, fallbackLabel, isFuture: val > THIS_MONTH, isCurrent: val === THIS_MONTH });
    }
    return months;
};

const MONTH_WINDOW = generateMonthWindow();

const btnBlue = (disabled) => ({
    backgroundColor: '#2D60FF', color: '#FFFFFF', border: 'none',
    padding: '0.75rem 1.75rem', borderRadius: '10px', fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
});
const selectStyle = {
    marginTop: '0.5rem', width: '100%', padding: '0.8rem 1rem',
    borderRadius: '10px', border: '1px solid #E6EFF5',
    background: '#FFFFFF', color: '#343C6A', fontSize: '0.95rem', outline: 'none',
};

const Payments = () => {
    const { state, setState, API_URL, loading } = useAppState();
    const [search, setSearch]           = useState('');
    const [expandedPanels, setExpandedPanels] = useState({});
    const lang = state.settings.lang || 'en';

    // ── Modal state ──────────────────────────────────────────────────
    const [showModal, setShowModal]   = useState(false);
    const [tenantId, setTenantId]     = useState('');
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [payDate, setPayDate]       = useState(TODAY);
    const [note, setNote]             = useState('');
    const [saving, setSaving]         = useState(false);
    const [error, setError]           = useState('');

    // ── Receipt state ─────────────────────────────────────────────────
    const [receipt, setReceipt] = useState(null);

    const openReceipt = useCallback((paymentGroup, tenant) => {
        setReceipt({ ...paymentGroup, tenant });
    }, []);

    // Opens a dedicated print window with the receipt HTML — most reliable cross-browser
    const printReceipt = (receiptData) => {
        const apt  = receiptData.tenant ? state.apartments.find(a => String(a.id) === String(receiptData.tenant.apartmentId)) : null;
        const prop = apt ? state.properties.find(p => String(p.id) === String(apt.propertyId)) : null;
        const receiptNo  = `RCP-${receiptData.id?.replace('pay','').slice(-6) || Date.now()}`;
        const monthsStr  = receiptData.monthList
            ? receiptData.monthList.map(m => formatMonth(m, lang)).join(', ')
            : formatMonth(receiptData.monthPaid, lang);
        const total = (receiptData.totalAmount || receiptData.amount || 0).toLocaleString();
        const currency = state.settings.currency || '';

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt ${receiptNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #1a1a2e; background: white; }
    .page { padding: 2cm; max-width: 14cm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start;
              border-bottom: 2px solid #2D60FF; padding-bottom: 16px; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 900; color: #2D60FF; letter-spacing: -0.5px; }
    .subtitle { font-size: 11px; color: #718EBF; margin-top: 4px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.5px; }
    .receipt-no-label { font-size: 11px; color: #718EBF; font-weight: 600; text-align: right; }
    .receipt-no { font-size: 14px; font-weight: 800; text-align: right; }
    .date { font-size: 10px; color: #718EBF; text-align: right; margin-top: 4px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .info-box { background: #F5F7FA; border-radius: 10px; padding: 14px; }
    .info-label { font-size: 9px; color: #718EBF; font-weight: 700; text-transform: uppercase;
                  letter-spacing: 0.5px; margin-bottom: 6px; }
    .info-name { font-size: 15px; font-weight: 800; }
    .info-sub { font-size: 11px; color: #718EBF; margin-top: 3px; }
    .info-unit { font-size: 12px; font-weight: 700; color: #2D60FF; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    thead tr { background: #2D60FF; color: white; }
    th { padding: 10px 12px; text-align: left; font-weight: 700; }
    th:last-child { text-align: right; }
    td { padding: 12px; border-bottom: 1px solid #E6EFF5; }
    td:last-child { text-align: right; font-weight: 800; color: #2D60FF; }
    tfoot td { background: #F5F7FA; font-weight: 800; font-size: 14px; border-bottom: none; }
    tfoot td:last-child { font-size: 18px; font-weight: 900; }
    .footer { border-top: 1px dashed #E6EFF5; padding-top: 14px;
              display: flex; justify-content: space-between; align-items: center; }
    .footer-note { font-size: 10px; color: #B1B1B1; }
    .footer-status { font-size: 10px; color: #2D60FF; font-weight: 700; }
    @media print { @page { margin: 1.5cm; size: A5 portrait; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="title">RENT RECEIPT</div>
        <div class="subtitle">Payment Confirmation</div>
      </div>
      <div>
        <div class="receipt-no-label">Receipt No.</div>
        <div class="receipt-no">${receiptNo}</div>
        <div class="date">Date: ${receiptData.date}</div>
      </div>
    </div>

    <div class="grid2">
      <div class="info-box">
        <div class="info-label">Received From</div>
        <div class="info-name">${receiptData.tenant?.name || 'Unknown'}</div>
        ${receiptData.tenant?.phone ? `<div class="info-sub">&#128222; ${receiptData.tenant.phone}</div>` : ''}
        ${receiptData.tenant?.email ? `<div class="info-sub">&#9993; ${receiptData.tenant.email}</div>` : ''}
      </div>
      <div class="info-box">
        <div class="info-label">Property / Unit</div>
        <div class="info-name">${prop?.name || '—'}</div>
        ${prop?.address ? `<div class="info-sub">${prop.address}</div>` : ''}
        <div class="info-unit">Unit: ${apt?.unitNumber || '—'} (${apt?.type || '—'})</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Period</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Monthly Rent</td>
          <td style="color:#718EBF">${monthsStr}</td>
          <td>${total} ${currency}</td>
        </tr>
        ${receiptData.note ? `<tr><td colspan="3" style="color:#718EBF;font-style:italic">Note: ${receiptData.note}</td></tr>` : ''}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2">TOTAL PAID</td>
          <td>${total} ${currency}</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      <div class="footer-note">Computer-generated receipt &mdash; no signature required.</div>
      <div class="footer-status">&#10003; PAYMENT CONFIRMED</div>
    </div>
  </div>
  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }<\/script>
</body></html>`;

        const win = window.open('', '_blank', 'width=600,height=800');
        if (win) { win.document.write(html); win.document.close(); }
        else { alert('Please allow pop-ups for this site to print receipts.'); }
    };

    // Derived: months this tenant has already paid for
    const paidMonths = useMemo(() => {
        if (!tenantId) return new Set();
        return new Set(
            state.payments
                .filter(p => String(p.tenantId) === String(tenantId))
                .map(p => p.monthPaid)
        );
    }, [tenantId, state.payments]);

    const selectedTenant = state.tenants.find(t => String(t.id) === String(tenantId));
    const selectedApt    = selectedTenant ? state.apartments.find(a => String(a.id) === String(selectedTenant.apartmentId)) : null;
    const selectedProp   = selectedApt ? state.properties.find(p => String(p.id) === String(selectedApt.propertyId)) : null;

    // Active contract for selected tenant (for agreed payment day)
    const tenantContract = useMemo(() => {
        if (!tenantId || !state.contracts) return null;
        return state.contracts.find(c =>
            String(c.tenantId) === String(tenantId) && c.active !== false
        ) || null;
    }, [tenantId, state.contracts]);

    const agreedDay      = tenantContract?.agreedDay || selectedTenant?.dueDateDay || null;
    const rentPerMonth   = selectedTenant?.rentAmount || 0;
    const totalAmount    = selectedMonths.length * rentPerMonth;

    const handleTenantChange = (id) => {
        setTenantId(id);
        setSelectedMonths([]);
        setError('');
    };

    const toggleMonth = (month) => {
        if (paidMonths.has(month)) return; // already paid — block it
        setSelectedMonths(prev =>
            prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
        );
    };

    const openModal = () => {
        const first = state.tenants[0];
        setTenantId(first?.id || '');
        setSelectedMonths([]);
        setPayDate(TODAY);
        setNote('');
        setError('');
        setShowModal(true);
    };

    const closeModal = () => { setShowModal(false); setError(''); };

    const handleSave = async () => {
        if (!tenantId)              { setError('Please select a tenant.'); return; }
        if (selectedMonths.length === 0) { setError('Select at least one month.'); return; }
        if (!payDate)               { setError('Payment date is required.'); return; }

        setSaving(true); setError('');
        try {
            const newPayments = selectedMonths.map(month => ({
                id:        `pay${Date.now()}-${month}`,
                tenantId,
                monthPaid: month,
                date:      payDate,
                amount:    rentPerMonth,
                note:      note.trim(),
            }));

            // Post all selected months
            await Promise.all(newPayments.map(p => axios.post(`${API_URL}/payments`, p)));

            // Update lastPaidMonth on the tenant (highest selected month if newer)
            const latestSelected = [...selectedMonths].sort().pop();
            if (selectedTenant && (!selectedTenant.lastPaidMonth || latestSelected > selectedTenant.lastPaidMonth)) {
                await axios.put(`${API_URL}/tenants/${tenantId}`, { lastPaidMonth: latestSelected });
                setState(prev => ({
                    ...prev,
                    payments: [...prev.payments, ...newPayments],
                    tenants: prev.tenants.map(t =>
                        String(t.id) === String(tenantId) ? { ...t, lastPaidMonth: latestSelected } : t
                    ),
                }));
            } else {
                setState(prev => ({ ...prev, payments: [...prev.payments, ...newPayments] }));
            }

            closeModal();
        } catch { setError('Failed to register payment. Please try again.'); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="loader">Loading payments...</div>;

    const togglePanel = (id) => setExpandedPanels(prev => ({ ...prev, [id]: !prev[id] }));

    const filteredPayments = state.payments.filter(pay => {
        const tenant = state.tenants.find(t => String(t.id) === String(pay.tenantId));
        return tenant && tenant.name.toLowerCase().includes(search.toLowerCase());
    });

    const renderPaymentTable = (payments) => {
        const grouped = payments.reduce((acc, p) => {
            const key = `${p.tenantId}-${p.date}`;
            if (!acc[key]) acc[key] = { ...p, monthList: [p.monthPaid], totalAmount: p.amount };
            else { acc[key].monthList.push(p.monthPaid); acc[key].totalAmount += p.amount; }
            return acc;
        }, {});

        return (
            <table className="data-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                    <tr>
                        <th style={{ borderBottom: '1px solid var(--border-light)', padding: '1rem 0', textAlign: 'left' }}>Tenant</th>
                        <th style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>Month(s) Covered</th>
                        <th style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>Payment Date</th>
                        <th style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>Amount</th>
                        <th style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'right' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)).map(p => {
                        const tenant = state.tenants.find(t => String(t.id) === String(p.tenantId));
                        const monthDisplay = p.monthList.map(m => formatMonth(m, lang)).reverse().join(', ');
                        return (
                            <tr key={p.id} className="payment-row">
                                <td style={{ fontWeight: '600', color: '#343C6A', padding: '1rem 0' }}>{tenant ? tenant.name : 'Unknown'}</td>
                                <td><span className="status-pill" style={{ fontSize: '0.75rem', background: '#F5F7FA', color: 'var(--secondary)', minWidth: 'auto' }}>{monthDisplay}</span></td>
                                <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.date}</td>
                                <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>{p.totalAmount.toLocaleString()} {state.settings.currency}</td>
                                <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                        <button className="btn-icon" title="Print Receipt"
                                            style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                                            onClick={() => openReceipt(p, tenant)}>
                                            <Printer size={14}/>
                                        </button>
                                        <button className="btn-icon" title="Delete" style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14}/></button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    return (
        <div className="animate-fade-in">
            {/* ── Header ── */}
            <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#343C6A', margin: 0, fontFamily: 'Outfit' }}>Payment Ledger History</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div className="search-box">
                        <input type="text" placeholder="Filter by tenant..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <button className="btn" style={btnBlue(false)} onClick={openModal}>
                        <PlusCircle size={18} /> Register Payment
                    </button>
                </div>
            </div>

            {/* ── Payment panels ── */}
            {state.payments.length === 0 ? (
                <div className="stat-card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                    <Receipt size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>No payments recorded yet. Click <strong>Register Payment</strong> to add the first one.</p>
                </div>
            ) : (
                <>
                    {state.properties.map(prop => {
                        const propPayments = filteredPayments.filter(pay => {
                            const tenant = state.tenants.find(t => String(t.id) === String(pay.tenantId));
                            const apt    = tenant ? state.apartments.find(a => String(a.id) === String(tenant.apartmentId)) : null;
                            return apt && String(apt.propertyId) === String(prop.id);
                        });
                        if (!propPayments.length) return null;
                        const total      = propPayments.reduce((sum, p) => sum + p.amount, 0);
                        const isExpanded = expandedPanels[prop.id];
                        return (
                            <div key={prop.id} className="animate-slide-in" style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '20px', overflow: 'hidden', marginBottom: '1rem', boxShadow: 'var(--card-shadow)' }}>
                                <div onClick={() => togglePanel(prop.id)} style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2D60FF' }}>
                                            <Building2 size={22} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#343C6A' }}>{prop.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}><MapPin size={10} style={{ marginRight: '4px' }} />{prop.address}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Total Revenue</div>
                                            <div style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '1.1rem' }}>{total.toLocaleString()} {state.settings.currency}</div>
                                        </div>
                                        <ChevronDown size={20} style={{ color: 'var(--secondary)', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border-light)' }}>
                                        {renderPaymentTable(propPayments)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </>
            )}

            {/* ══ Register Payment Modal ══ */}
            {showModal && (
                <div className="modal-overlay active">
                    <div className="modal animate-pop-in" style={{ maxWidth: '580px' }}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}><CalendarDays size={22} style={{ color: '#2D60FF' }} /> Register Payment</h3>
                            <button className="btn-close" onClick={closeModal}><X size={20} /></button>
                        </div>

                        <div className="modal-body">
                            {error && (
                                <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', marginBottom: '1.25rem' }}>
                                    {error}
                                </div>
                            )}

                            {/* Tenant selector */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label>Tenant *</label>
                                <select value={tenantId} onChange={e => handleTenantChange(e.target.value)} style={selectStyle}>
                                    <option value="">— Select tenant —</option>
                                    {state.tenants.map(t => {
                                        const apt  = state.apartments.find(a => String(a.id) === String(t.apartmentId));
                                        const prop = apt ? state.properties.find(p => String(p.id) === String(apt.propertyId)) : null;
                                        return (
                                            <option key={t.id} value={t.id}>
                                                {t.name}{prop ? ` — ${prop.name}` : ''}{apt ? ` / ${apt.unitNumber}` : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* Tenant info strip */}
                            {selectedTenant && (
                                <div style={{ background: '#F5F7FA', borderRadius: '12px', padding: '0.9rem 1.1rem', marginBottom: '1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Property</div>
                                        <div style={{ fontWeight: '700', color: '#343C6A', fontSize: '0.88rem' }}>{selectedProp?.name || '—'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unit</div>
                                        <div style={{ fontWeight: '700', color: '#343C6A', fontSize: '0.88rem' }}>{selectedApt?.unitNumber || '—'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rent / Month</div>
                                        <div style={{ fontWeight: '800', color: '#2D60FF', fontSize: '0.88rem' }}>{rentPerMonth.toLocaleString()} {state.settings.currency}</div>
                                    </div>
                                </div>
                            )}

                            {/* Month grid */}
                            {selectedTenant && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <label style={{ margin: 0, fontWeight: '700', color: '#343C6A', fontSize: '0.9rem' }}>Select Month(s) *</label>
                                        <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.72rem', fontWeight: '600', color: '#718EBF' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#DCFCE7', border: '1px solid #15803D', display: 'inline-block' }} /> Paid</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#EFF6FF', border: '1px solid #2D60FF', display: 'inline-block' }} /> Selected</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#FEF9C3', border: '1px solid #A16207', display: 'inline-block' }} /> Advance</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
                                        {MONTH_WINDOW.map(({ val, fallbackLabel, isFuture, isCurrent }) => {
                                            const isPaid     = paidMonths.has(val);
                                            const isSelected = selectedMonths.includes(val);

                                            // Compute due date label
                                            const dueLabelObj = agreedDay ? getDueDateLabel(agreedDay, val) : null;

                                            let bg, border, color, cursor, titleText;
                                            if (isPaid) {
                                                bg = '#DCFCE7'; border = '1.5px solid #16a34a'; color = '#15803D'; cursor = 'not-allowed'; titleText = 'Already paid';
                                            } else if (isSelected && isFuture) {
                                                bg = '#FEF9C3'; border = '1.5px solid #A16207'; color = '#92400E'; cursor = 'pointer'; titleText = 'Advance payment selected';
                                            } else if (isSelected) {
                                                bg = '#EFF6FF'; border = '1.5px solid #2D60FF'; color = '#2D60FF'; cursor = 'pointer'; titleText = 'Selected';
                                            } else if (isFuture) {
                                                bg = '#FAFAFA'; border = '1.5px dashed #D1D5DB'; color = '#9CA3AF'; cursor = 'pointer'; titleText = 'Click to pay in advance';
                                            } else if (isCurrent) {
                                                bg = '#F8FAFF'; border = '1.5px solid #93C5FD'; color = '#343C6A'; cursor = 'pointer'; titleText = 'Current month';
                                            } else {
                                                bg = '#F9FAFB'; border = '1.5px solid #E5E7EB'; color = '#6B7280'; cursor = 'pointer'; titleText = 'Click to select';
                                            }

                                            return (
                                                <button key={val} title={titleText} onClick={() => toggleMonth(val)} disabled={isPaid}
                                                    style={{ background: bg, border, borderRadius: '8px', padding: '0.45rem 0.2rem', cursor, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', transition: 'all 0.15s ease', position: 'relative', minHeight: '52px', justifyContent: 'center' }}>
                                                    {dueLabelObj ? (
                                                        <>
                                                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color, lineHeight: 1 }}>{dueLabelObj.line1}</span>
                                                            <span style={{ fontSize: '0.62rem', fontWeight: '600', color, opacity: 0.85 }}>{dueLabelObj.line2}</span>
                                                            {dueLabelObj.capped && (
                                                                <span style={{ fontSize: '0.55rem', color: '#A16207', fontWeight: '700', lineHeight: 1 }}>last day</span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color }}>{fallbackLabel}</span>
                                                    )}
                                                    {isPaid && <CheckCircle2 size={11} color="#16a34a" />}
                                                    {isPaid && <Lock size={9} color="#16a34a" style={{ position: 'absolute', top: '3px', right: '3px' }} />}
                                                    {isSelected && !isPaid && <CheckCircle2 size={11} color={isFuture ? '#92400E' : '#2D60FF'} />}
                                                    {isCurrent && !isPaid && !isSelected && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#2D60FF', display: 'inline-block' }} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Summary + date + note */}
                            {selectedTenant && selectedMonths.length > 0 && (
                                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#2D60FF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{selectedMonths.length} month{selectedMonths.length > 1 ? 's' : ''} selected</div>
                                        <div style={{ fontSize: '0.8rem', color: '#343C6A', marginTop: '2px', fontWeight: '500' }}>
                                            {[...selectedMonths].sort().map(m => formatMonth(m, lang)).join(', ')}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#718EBF', fontWeight: '600' }}>Total Due</div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#2D60FF', fontFamily: 'Outfit' }}>{totalAmount.toLocaleString()} {state.settings.currency}</div>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                <div>
                                    <label>Payment Date *</label>
                                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                                        style={{ marginTop: '0.5rem', width: '100%', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #E6EFF5', background: '#FFFFFF', color: '#343C6A', fontSize: '0.95rem', outline: 'none' }} />
                                </div>
                                <div>
                                    <label>Note (optional)</label>
                                    <input type="text" placeholder="e.g. Partial, cash" value={note}
                                        onChange={e => setNote(e.target.value)}
                                        style={{ marginTop: '0.5rem', width: '100%', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #E6EFF5', background: '#FFFFFF', color: '#343C6A', fontSize: '0.95rem', outline: 'none' }} />
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
                            <button className="btn" style={btnBlue(saving || selectedMonths.length === 0)} onClick={handleSave}
                                disabled={saving || selectedMonths.length === 0}>
                                {saving ? 'Saving...' : `Register${selectedMonths.length > 0 ? ` (${selectedMonths.length} month${selectedMonths.length > 1 ? 's' : ''})` : ''}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        {/* ══ Receipt Preview & Print ══ */}
        {receipt && (() => {
            const apt  = receipt.tenant ? state.apartments.find(a => String(a.id) === String(receipt.tenant.apartmentId)) : null;
            const prop = apt ? state.properties.find(p => String(p.id) === String(apt.propertyId)) : null;
            const receiptNo = `RCP-${receipt.id?.replace('pay','').slice(-6) || Date.now()}`;
            const monthsStr = receipt.monthList
                ? receipt.monthList.map(m => formatMonth(m, lang)).join(', ')
                : formatMonth(receipt.monthPaid, lang);

            return (
                <>
                    {/* Print-only root (hidden until window.print()) */}
                    <div id="print-receipt-root">
                        <div style={{ fontFamily: 'Arial, sans-serif', padding: '1.5cm', maxWidth: '14cm', margin: '0 auto', color: '#1a1a2e' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #2D60FF', paddingBottom: '16px', marginBottom: '20px' }}>
                                <div>
                                    <div style={{ fontSize: '22px', fontWeight: '900', color: '#2D60FF', letterSpacing: '-0.5px' }}>RENT RECEIPT</div>
                                    <div style={{ fontSize: '11px', color: '#718EBF', marginTop: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Confirmation</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '11px', color: '#718EBF', fontWeight: '600' }}>Receipt No.</div>
                                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#1a1a2e' }}>{receiptNo}</div>
                                    <div style={{ fontSize: '10px', color: '#718EBF', marginTop: '4px' }}>Date: {receipt.date}</div>
                                </div>
                            </div>

                            {/* Tenant + Property info */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                                <div style={{ background: '#F5F7FA', borderRadius: '10px', padding: '14px' }}>
                                    <div style={{ fontSize: '9px', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Received From</div>
                                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#1a1a2e' }}>{receipt.tenant?.name || 'Unknown Tenant'}</div>
                                    {receipt.tenant?.phone && <div style={{ fontSize: '11px', color: '#718EBF', marginTop: '3px' }}>📞 {receipt.tenant.phone}</div>}
                                    {receipt.tenant?.email && <div style={{ fontSize: '11px', color: '#718EBF' }}>✉ {receipt.tenant.email}</div>}
                                </div>
                                <div style={{ background: '#F5F7FA', borderRadius: '10px', padding: '14px' }}>
                                    <div style={{ fontSize: '9px', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Property / Unit</div>
                                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#1a1a2e' }}>{prop?.name || '—'}</div>
                                    <div style={{ fontSize: '11px', color: '#718EBF', marginTop: '3px' }}>{prop?.address || ''}</div>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#2D60FF', marginTop: '4px' }}>Unit: {apt?.unitNumber || '—'} ({apt?.type || '—'})</div>
                                </div>
                            </div>

                            {/* Payment details table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12px' }}>
                                <thead>
                                    <tr style={{ background: '#2D60FF', color: 'white' }}>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', borderRadius: '8px 0 0 0' }}>Description</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700' }}>Period</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', borderRadius: '0 8px 0 0' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #E6EFF5' }}>
                                        <td style={{ padding: '12px', color: '#343C6A', fontWeight: '600' }}>Monthly Rent</td>
                                        <td style={{ padding: '12px', color: '#718EBF' }}>{monthsStr}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: '#2D60FF' }}>
                                            {(receipt.totalAmount || receipt.amount || 0).toLocaleString()} {state.settings.currency}
                                        </td>
                                    </tr>
                                    {receipt.note && (
                                        <tr style={{ borderBottom: '1px solid #E6EFF5' }}>
                                            <td style={{ padding: '12px', color: '#718EBF', fontStyle: 'italic' }} colSpan={3}>Note: {receipt.note}</td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: '#F5F7FA' }}>
                                        <td colSpan={2} style={{ padding: '14px 12px', fontWeight: '800', fontSize: '14px', color: '#343C6A' }}>TOTAL PAID</td>
                                        <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: '900', fontSize: '18px', color: '#2D60FF' }}>
                                            {(receipt.totalAmount || receipt.amount || 0).toLocaleString()} {state.settings.currency}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* Footer */}
                            <div style={{ borderTop: '1px dashed #E6EFF5', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '10px', color: '#B1B1B1' }}>This receipt is computer-generated and requires no signature.</div>
                                <div style={{ fontSize: '10px', color: '#2D60FF', fontWeight: '700' }}>✓ PAYMENT CONFIRMED</div>
                            </div>
                        </div>
                    </div>

                    {/* Screen preview modal */}
                    <div className="modal-overlay active">
                        <div className="modal animate-pop-in" style={{ maxWidth: '600px', padding: 0, overflow: 'hidden', borderRadius: '20px' }}>
                            {/* Modal header */}
                            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E6EFF5' }}>
                                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.05rem' }}>
                                    <Receipt size={20} style={{ color: '#2D60FF' }} /> Payment Receipt
                                </h3>
                                <button className="btn-close" onClick={() => setReceipt(null)}><X size={20} /></button>
                            </div>

                            {/* Receipt preview */}
                            <div style={{ background: '#F5F7FA', padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
                                <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', fontFamily: 'Arial, sans-serif' }}>
                                    {/* Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #2D60FF', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                                        <div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#2D60FF', letterSpacing: '-0.5px' }}>RENT RECEIPT</div>
                                            <div style={{ fontSize: '0.7rem', color: '#718EBF', marginTop: '2px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Confirmation</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#718EBF', fontWeight: '600' }}>Receipt No.</div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#343C6A' }}>{receiptNo}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#718EBF', marginTop: '2px' }}>Date: {receipt.date}</div>
                                        </div>
                                    </div>

                                    {/* Tenant + Property */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                        <div style={{ background: '#F5F7FA', borderRadius: '10px', padding: '1rem' }}>
                                            <div style={{ fontSize: '0.65rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Received From</div>
                                            <div style={{ fontSize: '1rem', fontWeight: '800', color: '#343C6A' }}>{receipt.tenant?.name || '—'}</div>
                                            {receipt.tenant?.phone && <div style={{ fontSize: '0.78rem', color: '#718EBF', marginTop: '3px' }}>📞 {receipt.tenant.phone}</div>}
                                            {receipt.tenant?.email && <div style={{ fontSize: '0.78rem', color: '#718EBF' }}>✉ {receipt.tenant.email}</div>}
                                        </div>
                                        <div style={{ background: '#F5F7FA', borderRadius: '10px', padding: '1rem' }}>
                                            <div style={{ fontSize: '0.65rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Property / Unit</div>
                                            <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#343C6A' }}>{prop?.name || '—'}</div>
                                            {prop?.address && <div style={{ fontSize: '0.75rem', color: '#718EBF', marginTop: '2px' }}>{prop.address}</div>}
                                            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#2D60FF', marginTop: '4px' }}>Unit: {apt?.unitNumber || '—'} ({apt?.type || '—'})</div>
                                        </div>
                                    </div>

                                    {/* Payment line-items */}
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ background: '#2D60FF' }}>
                                                <th style={{ padding: '0.7rem 1rem', textAlign: 'left', color: 'white', fontWeight: '700', borderRadius: '8px 0 0 0' }}>Description</th>
                                                <th style={{ padding: '0.7rem 1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Period</th>
                                                <th style={{ padding: '0.7rem 1rem', textAlign: 'right', color: 'white', fontWeight: '700', borderRadius: '0 8px 0 0' }}>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr style={{ borderBottom: '1px solid #E6EFF5' }}>
                                                <td style={{ padding: '0.8rem 1rem', fontWeight: '600', color: '#343C6A' }}>Monthly Rent</td>
                                                <td style={{ padding: '0.8rem 1rem', color: '#718EBF' }}>{monthsStr}</td>
                                                <td style={{ padding: '0.8rem 1rem', textAlign: 'right', fontWeight: '800', color: '#2D60FF' }}>
                                                    {(receipt.totalAmount || receipt.amount || 0).toLocaleString()} {state.settings.currency}
                                                </td>
                                            </tr>
                                            {receipt.note && (
                                                <tr>
                                                    <td colSpan={3} style={{ padding: '0.5rem 1rem', color: '#718EBF', fontStyle: 'italic', fontSize: '0.78rem' }}>Note: {receipt.note}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ background: '#F5F7FA' }}>
                                                <td colSpan={2} style={{ padding: '0.9rem 1rem', fontWeight: '800', fontSize: '0.95rem', color: '#343C6A' }}>TOTAL PAID</td>
                                                <td style={{ padding: '0.9rem 1rem', textAlign: 'right', fontWeight: '900', fontSize: '1.25rem', color: '#2D60FF' }}>
                                                    {(receipt.totalAmount || receipt.amount || 0).toLocaleString()} {state.settings.currency}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>

                                    {/* Footer note */}
                                    <div style={{ borderTop: '1px dashed #E6EFF5', paddingTop: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#B1B1B1' }}>Computer-generated receipt — no signature required.</div>
                                        <div style={{ fontSize: '0.72rem', color: '#15803D', fontWeight: '700' }}>✓ PAYMENT CONFIRMED</div>
                                    </div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="modal-footer" style={{ padding: '1rem 1.5rem' }}>
                                <button className="btn btn-secondary" onClick={() => setReceipt(null)}>Close</button>
                                <button className="btn" style={{ backgroundColor: '#2D60FF', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                                    onClick={() => printReceipt(receipt)}>
                                    <Printer size={16} /> Print Receipt
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            );
        })()}
        </div>
    );
};

export default Payments;
