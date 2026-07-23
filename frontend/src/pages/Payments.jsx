import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useAppState } from '../context/StateContext';
import { formatMonth } from '../utils';
import { Receipt, PlusCircle, Building2, ChevronDown, MapPin, Printer, Trash2, X, CheckCircle2, Lock, CalendarDays, Edit, Search } from 'lucide-react';


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
    const { state, setState, API_URL, loading, showTenantHistory } = useAppState();
    const [search, setSearch]           = useState('');
    const [expandedPanels, setExpandedPanels] = useState({});
    const lang = state.settings.lang || 'en';

    const [sortField, setSortField] = useState('date'); // 'name' | 'room' | 'date' | 'type'
    const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            if (field === 'room') {
                setSortDirection('asc');
            } else if (field === 'date') {
                setSortDirection('desc');
            } else {
                setSortDirection('asc');
            }
        }
    };

    // ── Modal state ──────────────────────────────────────────────────
    const [showModal, setShowModal]   = useState(false);
    const [tenantId, setTenantId]     = useState('');
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [payDate, setPayDate]       = useState(TODAY);
    const [note, setNote]             = useState('');
    const [saving, setSaving]         = useState(false);
    const [error, setError]           = useState('');

    // ── Edit Payment Group Modal state ────────────────────────────────
    const [editGroup, setEditGroup] = useState(null); // null | paymentGroupObj
    const [paymentMode, setPaymentMode] = useState('Rent'); // 'Rent' | 'Deposit'
    const [depositAmountMonths, setDepositAmountMonths] = useState(0);
    const [activeYear, setActiveYear] = useState(new Date().getFullYear());
    const [currentPages, setCurrentPages] = useState({});

    const scrollContainerRef = useRef(null);

    const scrollOneYear = (direction) => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const card = container.querySelector('.month-scroll-card');
            const cardWidth = card ? card.getBoundingClientRect().width + 8 : 84; // card (76) + gap (8)
            const scrollAmount = cardWidth * 12;
            container.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

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
        const monthsStr  = receiptData.type === 'Deposit' 
            ? '—'
            : (receiptData.monthList
                ? receiptData.monthList.map(m => formatMonth(m, lang)).join(', ')
                : formatMonth(receiptData.monthPaid, lang));
        const total = (receiptData.totalAmount || receiptData.amount || 0).toLocaleString();
        const currency = state.settings.currency || '';
        const signature = state.settings.signature || '';

        // Fetch individual payment records for this group
        const groupPayments = state.payments.filter(pay => 
            String(pay.tenantId) === String(receiptData.tenantId || receiptData.tenant?.id) && 
            pay.date === receiptData.date
        );

        // Security Deposit calculations
        const tenant = receiptData.tenant || state.tenants.find(t => String(t.id) === String(receiptData.tenantId));
        const rentAmount = Number(tenant?.rentAmount || 0);
        const depositMonths = Number(tenant?.depositMonths || 0);
        const reqDeposit = depositMonths * rentAmount;

        const tenantPayments = state.payments.filter(p => 
            String(p.tenantId) === String(tenant?.id) && 
            p.type === 'Deposit' &&
            (p.status === 'Approved' || !p.status)
        );
        const paidDeposit = tenantPayments.reduce((sum, p) => sum + p.amount, 0);
        const depositMonthsPaid = tenantPayments.reduce((sum, p) => 
            sum + (p.depositMonths || (rentAmount > 0 ? Math.round(p.amount / rentAmount) : 1)), 
            0
        );
        const outstandingBalance = paidDeposit - reqDeposit;

        const itemsHtml = groupPayments.length > 0
            ? groupPayments.map(pay => {
                let desc = 'Monthly Rent';
                let period = '—';
                if (pay.type === 'Deposit') {
                    desc = 'Security Deposit';
                    const mCount = pay.depositMonths || 0;
                    period = `${mCount} Month${mCount !== 1 ? 's' : ''}`;
                } else if (pay.type === 'Rent') {
                    desc = 'Monthly Rent';
                    period = pay.monthList
                        ? pay.monthList.map(m => formatMonth(m, lang)).join(', ')
                        : formatMonth(pay.monthPaid, lang);
                } else if (pay.type) {
                    desc = pay.type === 'Utility' ? 'Utility Bill' : pay.type;
                    if (pay.utilityId) {
                        desc += ` (${pay.utilityId})`;
                    }
                    period = '—';
                }
                return `
                  <tr style="border-bottom: 1px solid #E6EFF5;">
                    <td style="padding: 12px; color: #343C6A; font-weight: 600;">${desc}</td>
                    <td style="padding: 12px; color: #718EBF;">${period}</td>
                    <td style="padding: 12px; text-align: right; font-weight: 800; color: #2D60FF;">${pay.amount.toLocaleString()} ${currency}</td>
                  </tr>
                `;
            }).join('')
            : `
              <tr style="border-bottom: 1px solid #E6EFF5;">
                <td style="padding: 12px; color: #343C6A; font-weight: 600;">${
                    receiptData.types?.has('Rent') && receiptData.types?.has('Deposit') 
                        ? 'Monthly Rent & Security Deposit' 
                        : (receiptData.types?.has('Deposit') ? 'Security Deposit' : 'Monthly Rent')
                }</td>
                <td style="padding: 12px; color: #718EBF;">${monthsStr}</td>
                <td style="padding: 12px; text-align: right; font-weight: 800; color: #2D60FF;">${total} ${currency}</td>
              </tr>
            `;

        const depositDetailInfoHtml = (depositMonths > 0 || paidDeposit > 0)
            ? `
            <div style="border-top: 1px solid #E6EFF5; margin-top: 8px; padding-top: 8px; font-size: 11px; color: #343C6A;">
              <strong>Deposit:</strong> ${depositMonthsPaid}/${depositMonths} paid
            </div>
            <div style="font-size: 11px; color: ${outstandingBalance < 0 ? '#EF4444' : '#10B981'};">
              <strong>Outstanding Deposit:</strong> ${outstandingBalance.toLocaleString()} ${currency}
            </div>
            `
            : '';

        let depositInfoHtml = '';
        if (depositMonths > 0 || paidDeposit > 0) {
            depositInfoHtml = `
              <div class="deposit-section" style="margin-top: 10px; margin-bottom: 10px; background: #F5F7FA; border-radius: 12px; padding: 10px 12px; border: 1px solid #E6EFF5;">
                <div style="font-size: 10px; color: #718EBF; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; text-align: left;">Security Deposit Status</div>
                <div style="display: flex; justify-content: space-between; gap: 15px; text-align: left;">
                  <div style="flex: 1;">
                    <span style="font-size: 8px; color: #718EBF; text-transform: uppercase; display: block; font-weight: 600;">Deposit Progress</span>
                    <span style="font-size: 11px; font-weight: 800; color: #343C6A; display: block; margin-top: 1px;">
                      ${depositMonthsPaid} / ${depositMonths} paid
                    </span>
                    <span style="font-size: 8px; color: #718EBF; display: block; margin-top: 0px;">(Required: ${reqDeposit.toLocaleString()} ${currency})</span>
                  </div>
                  <div style="flex: 1; border-left: 1px solid #E6EFF5; padding-left: 15px;">
                    <span style="font-size: 8px; color: #718EBF; text-transform: uppercase; display: block; font-weight: 600;">Deposit Held (Current)</span>
                    <span style="font-size: 11px; font-weight: 800; color: #2D60FF; display: block; margin-top: 1px;">
                      ${paidDeposit.toLocaleString()} ${currency}
                    </span>
                  </div>
                  <div style="flex: 1; border-left: 1px solid #E6EFF5; padding-left: 15px;">
                    <span style="font-size: 8px; color: #718EBF; text-transform: uppercase; display: block; font-weight: 600;">Outstanding Balance</span>
                    ${outstandingBalance < 0 
                      ? `<span style="font-size: 11px; font-weight: 800; color: #EF4444; display: block; margin-top: 1px;">${outstandingBalance.toLocaleString()} ${currency}</span>`
                      : `<span style="font-size: 11px; font-weight: 800; color: #10B981; display: block; margin-top: 1px;">${outstandingBalance.toLocaleString()} ${currency}</span>`
                    }
                  </div>
                </div>
              </div>
            `;
        } else {
            depositInfoHtml = `
              <div class="deposit-section" style="margin-top: 10px; margin-bottom: 10px; background: #F5F7FA; border-radius: 12px; padding: 10px 12px; border: 1px solid #E6EFF5;">
                <div style="font-size: 10px; color: #718EBF; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; text-align: left;">Security Deposit Status</div>
                <div style="font-size: 11px; color: #718EBF; font-weight: 600; font-style: italic; text-align: left;">No security deposit required or held for this tenancy.</div>
              </div>
            `;
        }

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt ${receiptNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #1a1a2e; background: white; }
    .page { padding: 0.8cm; max-width: 14cm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start;
              border-bottom: 2px solid #2D60FF; padding-bottom: 10px; margin-bottom: 12px; }
    .title { font-size: 20px; font-weight: 900; color: #2D60FF; letter-spacing: -0.5px; }
    .subtitle { font-size: 10px; color: #718EBF; margin-top: 2px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.5px; }
    .receipt-no-label { font-size: 10px; color: #718EBF; font-weight: 600; text-align: right; }
    .receipt-no { font-size: 13px; font-weight: 800; text-align: right; }
    .date { font-size: 9px; color: #718EBF; text-align: right; margin-top: 2px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    .info-box { background: #F5F7FA; border-radius: 10px; padding: 8px 12px; }
    .info-label { font-size: 8px; color: #718EBF; font-weight: 700; text-transform: uppercase;
                  letter-spacing: 0.5px; margin-bottom: 3px; }
    .info-name { font-size: 13px; font-weight: 800; }
    .info-sub { font-size: 10px; color: #718EBF; margin-top: 2px; }
    .info-unit { font-size: 11px; font-weight: 700; color: #2D60FF; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
    thead tr { background: #2D60FF; color: white; }
    th { padding: 6px 8px; text-align: left; font-weight: 700; }
    th:last-child { text-align: right; }
    td { padding: 8px; border-bottom: 1px solid #E6EFF5; }
    td:last-child { text-align: right; font-weight: 800; color: #2D60FF; }
    tfoot td { background: #F5F7FA; font-weight: 800; font-size: 12px; border-bottom: none; padding: 8px; }
    tfoot td:last-child { font-size: 15px; font-weight: 900; }
    .footer { border-top: 1px dashed #E6EFF5; padding-top: 8px;
              display: flex; justify-content: space-between; align-items: center; }
    .footer-note { font-size: 10px; color: #B1B1B1; }
    .footer-status { font-size: 10px; color: #2D60FF; font-weight: 700; }
    @media print { @page { margin: 0.6cm; size: A5 portrait; } }
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
        ${depositDetailInfoHtml}
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
        ${itemsHtml}
        ${receiptData.note ? `<tr><td colspan="3" style="color:#718EBF;font-style:italic">Note: ${receiptData.note}</td></tr>` : ''}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2">TOTAL PAID</td>
          <td>${total} ${currency}</td>
        </tr>
      </tfoot>
    </table>

    ${depositInfoHtml}

    <div class="footer" style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px dashed #E6EFF5; padding-top: 8px; margin-top: 15px;">
      ${signature ? `
        <div class="signature-container" style="text-align: left;">
          <img src="${signature}" style="max-height: 40px; max-width: 150px; display: block; margin-bottom: 2px;" alt="Landlord Signature" />
          <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px solid #E6EFF5; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Landlord Signature</div>
        </div>
      ` : `
        <div class="signature-container" style="text-align: left; padding-top: 20px;">
          <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px dashed #B1B1B1; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Landlord Signature</div>
        </div>
      `}
      <div class="footer-status" style="font-size: 10px; color: #2D60FF; font-weight: 700; padding-bottom: 5px;">&#10003; PAYMENT CONFIRMED</div>
      <div class="signature-container" style="text-align: right; padding-top: 20px;">
        <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px dashed #B1B1B1; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Tenant Signature</div>
      </div>
    </div>
    <div style="display: flex; align-items: center; justify-content: center; gap: 4px; border-top: 1px dashed #E6EFF5; padding-top: 8px; margin-top: 12px; font-size: 8px; font-weight: bold; color: #718EBF;">
      <img src="/favicon.png" style="height: 12px; width: auto;" alt="App Logo" />
      Powered by Property Manager Suite
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
        const groupPaymentIds = editGroup 
            ? new Set(
                state.payments
                    .filter(p => String(p.tenantId) === String(editGroup.tenantId) && p.date === editGroup.date)
                    .map(p => p.id)
              )
            : new Set();
        return new Set(
            state.payments
                .filter(p => String(p.tenantId) === String(tenantId) && !groupPaymentIds.has(p.id))
                .map(p => p.monthPaid)
        );
    }, [tenantId, state.payments, editGroup]);

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

    // Oldest contract (representing date of entry)
    const oldestContract = useMemo(() => {
        if (!tenantId || !state.contracts) return null;
        const tenantContracts = state.contracts.filter(c => String(c.tenantId) === String(tenantId));
        if (tenantContracts.length === 0) return null;
        return [...tenantContracts].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    }, [tenantId, state.contracts]);

    const entryMonth = useMemo(() => {
        return oldestContract?.startDate ? oldestContract.startDate.slice(0, 7) : null;
    }, [oldestContract]);

    const monthsToRender = useMemo(() => {
        const baseMonth = entryMonth || THIS_MONTH;
        const [baseY, baseM] = baseMonth.split('-').map(Number);
        
        // Go 12 months before the base month
        const startDateObj = new Date(baseY, baseM - 1 - 12, 1);
        
        // Go 24 months after the current month
        const [currY, currM] = THIS_MONTH.split('-').map(Number);
        const endDateObj = new Date(currY, currM - 1 + 24, 1);
        
        const list = [];
        let temp = new Date(startDateObj);
        while (temp <= endDateObj) {
            const val = `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}`;
            const fallbackLabel = temp.toLocaleString('default', { month: 'short', year: '2-digit' });
            list.push({
                val,
                fallbackLabel,
                isFuture: val > THIS_MONTH,
                isCurrent: val === THIS_MONTH
            });
            temp.setMonth(temp.getMonth() + 1);
        }
        return list;
    }, [entryMonth]);

    const yearsToRender = useMemo(() => {
        const startYear = entryMonth ? parseInt(entryMonth.split('-')[0]) - 1 : new Date().getFullYear() - 1;
        const endYear = new Date().getFullYear() + 2;
        const years = [];
        for (let y = startYear; y <= endYear; y++) {
            years.push(y);
        }
        return years;
    }, [entryMonth]);

    const scrollYear = (direction) => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const width = container.clientWidth;
            container.scrollBy({
                left: direction === 'prev' ? -width : width,
                behavior: 'smooth'
            });
        }
    };

    const handleScroll = (e) => {
        const scrollLeft = e.target.scrollLeft;
        const width = e.target.clientWidth;
        if (width > 0) {
            const index = Math.round(scrollLeft / width);
            if (yearsToRender[index] && yearsToRender[index] !== activeYear) {
                setActiveYear(yearsToRender[index]);
            }
        }
    };

    // Automatically scroll to the current year when a tenant is loaded
    useEffect(() => {
        if (tenantId && scrollContainerRef.current) {
            const todayYear = new Date().getFullYear();
            const targetIndex = yearsToRender.indexOf(todayYear);
            if (targetIndex !== -1) {
                const container = scrollContainerRef.current;
                setTimeout(() => {
                    if (container) {
                        container.scrollLeft = targetIndex * container.clientWidth;
                        setActiveYear(todayYear);
                    }
                }, 100);
            }
        }
    }, [tenantId, yearsToRender]);

    const agreedDay      = tenantContract?.agreedDay || selectedTenant?.dueDateDay || null;
    const rentPerMonth   = selectedTenant?.rentAmount || 0;
    const totalAmount    = selectedMonths.length * rentPerMonth;

    // Derived: previously paid deposit months excluding current edit group
    const revertedDepositMonthsPaid = useMemo(() => {
        if (!selectedTenant) return 0;
        if (!editGroup) return selectedTenant.depositMonthsPaid || 0;
        
        const groupPayments = state.payments.filter(p => 
            String(p.tenantId) === String(editGroup.tenantId) && 
            p.date === editGroup.date
        );
        const remainingPayments = state.payments.filter(p => !groupPayments.some(gp => gp.id === p.id));
        const tenantPayments = remainingPayments.filter(p => String(p.tenantId) === String(tenantId));
        return tenantPayments
            .filter(p => p.type === 'Deposit')
            .reduce((sum, p) => sum + (p.depositMonths || 0), 0);
    }, [selectedTenant, editGroup, state.payments, tenantId]);

    // Derived: list of deposit payments for the selected tenant
    const tenantDepositPayments = useMemo(() => {
        if (!tenantId) return [];
        return state.payments.filter(p => String(p.tenantId) === String(tenantId) && p.type === 'Deposit');
    }, [tenantId, state.payments]);

    // Derived: maximum deposit months that can be registered for the selected tenant
    const maxDepositMonthsSelectable = useMemo(() => {
        if (!selectedTenant) return 0;
        const depositMonthsRequired = selectedTenant.depositMonths || 0;
        return Math.max(0, depositMonthsRequired - revertedDepositMonthsPaid);
    }, [selectedTenant, revertedDepositMonthsPaid]);

    const handleTenantChange = (id) => {
        setTenantId(id);
        setSelectedMonths([]);
        setDepositAmountMonths(0);
        setError('');
    };

    const toggleMonth = (month) => {
        if (paidMonths.has(month)) return; // already paid — block it
        if (entryMonth && month < entryMonth) return; // before entry month — block it
        setSelectedMonths(prev =>
            prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
        );
    };

    const openModal = () => {
        const first = state.tenants.find(t => t.isAssigned !== false);
        setTenantId(first?.id || '');
        setSelectedMonths([]);
        setPayDate(TODAY);
        setNote('');
        setError('');
        setEditGroup(null);
        setPaymentMode('Rent');
        setDepositAmountMonths(0);
        setActiveYear(new Date().getFullYear());
        setShowModal(true);
    };

    const closeModal = () => { 
        setShowModal(false); 
        setTenantId('');
        setSelectedMonths([]);
        setPayDate(TODAY);
        setNote('');
        setError('');
        setEditGroup(null);
        setPaymentMode('Rent');
        setDepositAmountMonths(0);
        setActiveYear(new Date().getFullYear());
    };

    const handleSave = async () => {
        if (!tenantId) { setError('Please select a tenant.'); return; }
        
        const hasRent = selectedMonths.length > 0;
        const hasDeposit = depositAmountMonths > 0;
        if (!hasRent && !hasDeposit) {
            setError('Please select at least one month for rent payment or a valid deposit period.');
            return;
        }
        if (!payDate) { setError('Payment date is required.'); return; }

        setSaving(true); setError('');
        try {
            let currentDepositPaid = selectedTenant.depositPaidAmount || 0;
            
            if (editGroup) {
                const groupPayments = state.payments.filter(p => 
                    String(p.tenantId) === String(editGroup.tenantId) && 
                    p.date === editGroup.date
                );
                await Promise.all(groupPayments.map(p => axios.delete(`${API_URL}/payments/${p.id}`)));
                
                const remainingPayments = state.payments.filter(p => !groupPayments.some(gp => gp.id === p.id));
                const tenantPayments = remainingPayments.filter(p => String(p.tenantId) === String(tenantId));
                
                currentDepositPaid = tenantPayments
                    .filter(p => p.type === 'Deposit')
                    .reduce((sum, p) => sum + p.amount, 0);
            }

            const timestamp = Date.now();
            const newPayments = [];

            // Preserve metadata if editing a tenant payment submission
            const status = editGroup?.status || 'Approved';
            const proofFile = editGroup?.proofFile;
            const proofFileType = editGroup?.proofFileType;

            if (hasDeposit) {
                const depAmt = depositAmountMonths * rentPerMonth;
                newPayments.push({
                    id:        `pay${timestamp}-deposit`,
                    tenantId,
                    apartmentId: selectedTenant.apartmentId,
                    amount:    depAmt,
                    date:      payDate,
                    monthPaid: '',
                    type:      'Deposit',
                    note:      note.trim() || 'Security Deposit Payment',
                    depositMonths: depositAmountMonths,
                    status,
                    proofFile,
                    proofFileType
                });
            }

            if (hasRent) {
                const sortedMonths = [...selectedMonths].sort();
                sortedMonths.forEach((month, idx) => {
                    newPayments.push({
                        id:        `pay${timestamp}-${month}-${idx}`,
                        tenantId,
                        apartmentId: selectedTenant.apartmentId,
                        amount:    rentPerMonth,
                        date:      payDate,
                        monthPaid: month,
                        type:      'Rent',
                        note:      note.trim(),
                        status,
                        proofFile,
                        proofFileType
                    });
                });
            }

            // Post all created payments (deposit and rent) to backend
            await Promise.all(newPayments.map(p => axios.post(`${API_URL}/payments`, p)));

            // Recalculate tenant properties based on the next payments list
            const remainingPayments = state.payments.filter(p => {
                if (editGroup) {
                    return !(String(p.tenantId) === String(editGroup.tenantId) && p.date === editGroup.date);
                }
                return true;
            });
            const allPayments = [...remainingPayments, ...newPayments].filter(p => String(p.tenantId) === String(tenantId));
            const allRentPayments = allPayments.filter(p => p.type === 'Rent');
            const allDepositPayments = allPayments.filter(p => p.type === 'Deposit');
            
            const finalLastPaidMonth = allRentPayments.map(p => p.monthPaid).sort().pop() || '';
            const newDepositPaidAmount = allDepositPayments.reduce((sum, p) => sum + p.amount, 0);
            const newDepositMonthsPaid = allDepositPayments.reduce((sum, p) => sum + (p.depositMonths || 0), 0);
            
            const updatedFields = {
                depositPaidAmount: newDepositPaidAmount,
                depositMonthsPaid: newDepositMonthsPaid,
                lastPaidMonth: finalLastPaidMonth
            };

            await axios.put(`${API_URL}/tenants/${tenantId}`, updatedFields);

            // Update state locally
            setState(prev => {
                const filteredPayments = editGroup
                    ? prev.payments.filter(p => !(String(p.tenantId) === String(editGroup.tenantId) && p.date === editGroup.date))
                    : prev.payments;
                
                return {
                    ...prev,
                    payments: [...filteredPayments, ...newPayments],
                    tenants: prev.tenants.map(t =>
                        String(t.id) === String(tenantId) 
                            ? { ...t, ...updatedFields } 
                            : t
                    ),
                };
            });

            closeModal();
        } catch (err) { 
            console.error(err);
            setError('Failed to save payment. Please try again.'); 
        } finally { setSaving(false); }
    };

    // Edit and Delete payment group logic
    const handleDeleteGroup = async (group) => {
        if (!confirm('Are you sure you want to delete this payment group?')) return;
        try {
            const groupPayments = state.payments.filter(p => 
                String(p.tenantId) === String(group.tenantId) && 
                p.date === group.date
            );
            
            await Promise.all(groupPayments.map(p => axios.delete(`${API_URL}/payments/${p.id}`)));
            
            const tenantId = group.tenantId;
            setState(prev => {
                const remainingPayments = prev.payments.filter(p => !groupPayments.some(gp => gp.id === p.id));
                const tenantPayments = remainingPayments.filter(p => String(p.tenantId) === String(tenantId));
                
                const newDepositPaidAmount = tenantPayments
                    .filter(p => p.type === 'Deposit')
                    .reduce((sum, p) => sum + p.amount, 0);
                
                const newDepositMonthsPaid = tenantPayments
                    .filter(p => p.type === 'Deposit')
                    .reduce((sum, p) => sum + (p.depositMonths || 0), 0);
                
                const remainingRentPayments = tenantPayments.filter(p => p.type !== 'Deposit');
                const latestMonth = remainingRentPayments.map(p => p.monthPaid).sort().pop() || '';

                return {
                    ...prev,
                    payments: remainingPayments,
                    tenants: prev.tenants.map(t => 
                        String(t.id) === String(tenantId)
                            ? { ...t, depositPaidAmount: newDepositPaidAmount, depositMonthsPaid: newDepositMonthsPaid, lastPaidMonth: latestMonth }
                            : t
                    )
                };
            });
            
        } catch (err) {
            console.error(err);
            alert('Failed to delete payments. Please try again.');
        }
    };

    const openEditGroup = (group) => {
        setTenantId(group.tenantId);
        
        const tenant = state.tenants.find(t => String(t.id) === String(group.tenantId));
        const currentRentPerMonth = tenant?.rentAmount || 0;
        
        const groupPayments = state.payments.filter(p => 
            String(p.tenantId) === String(group.tenantId) && 
            p.date === group.date
        );
        
        // Resolve rent months from the group
        const rentMonths = groupPayments.filter(p => p.type === 'Rent').map(p => p.monthPaid).filter(Boolean);
        setSelectedMonths(rentMonths);
        
        // Resolve deposit months from the group
        const depositPayment = groupPayments.find(p => p.type === 'Deposit');
        if (depositPayment) {
            const totalAmt = depositPayment.amount;
            const savedMonths = depositPayment.depositMonths;
            const months = savedMonths || (currentRentPerMonth > 0 ? Math.round(totalAmt / currentRentPerMonth) : 1);
            setDepositAmountMonths(months);
        } else {
            setDepositAmountMonths(0);
        }
        
        // Default to Deposit tab only if it's a deposit-only group
        const hasRent = groupPayments.some(p => p.type === 'Rent');
        const hasDeposit = groupPayments.some(p => p.type === 'Deposit');
        if (hasDeposit && !hasRent) {
            setPaymentMode('Deposit');
        } else {
            setPaymentMode('Rent');
        }
        
        setPayDate(group.date);
        setNote(group.note || '');
        setError('');
        setEditGroup(group);
        setShowModal(true);
    };

    const location = useLocation();
    useEffect(() => {
        if (location.state && location.state.editPaymentGroupDate && location.state.editPaymentGroupTenantId) {
            const groupPayments = state.payments.filter(p =>
                String(p.tenantId) === String(location.state.editPaymentGroupTenantId) &&
                p.date === location.state.editPaymentGroupDate
            );
            if (groupPayments.length > 0) {
                const group = {
                    tenantId: location.state.editPaymentGroupTenantId,
                    date: location.state.editPaymentGroupDate,
                    note: groupPayments[0].note || ''
                };
                openEditGroup(group);
                window.history.replaceState({}, document.title);
            }
        }
    }, [location.state, state.payments]);

    if (loading) return <div className="loader">Loading payments...</div>;

    const togglePanel = (id) => setExpandedPanels(prev => ({ ...prev, [id]: !prev[id] }));

    const filteredPayments = state.payments.filter(pay => {
        const tenant = state.tenants.find(t => String(t.id) === String(pay.tenantId));
        return tenant && tenant.name.toLowerCase().includes(search.toLowerCase());
    });

    const renderPaymentTable = (payments, propId) => {
        const grouped = payments.reduce((acc, p) => {
            const key = `${p.tenantId}-${p.date}`;
            if (!acc[key]) {
                acc[key] = { 
                    ...p, 
                    monthList: p.monthPaid ? [p.monthPaid] : [], 
                    totalAmount: p.amount,
                    types: new Set([p.type])
                };
            } else {
                if (p.monthPaid) acc[key].monthList.push(p.monthPaid);
                acc[key].totalAmount += p.amount;
                acc[key].types.add(p.type);
            }
            return acc;
        }, {});

        const groupedArray = Object.values(grouped).map(p => {
            const tenant = state.tenants.find(t => String(t.id) === String(p.tenantId));
            const apartment = state.apartments.find(a => String(a.id) === String(p.apartmentId || tenant?.apartmentId));
            
            let typeLabel = 'Rent';
            if (p.types.has('Rent') && p.types.has('Deposit')) {
                typeLabel = 'Rent & Deposit';
            } else if (p.types.has('Deposit')) {
                typeLabel = 'Deposit';
            }

            return {
                ...p,
                tenantName: tenant ? tenant.name : 'Unknown',
                roomNumber: apartment ? apartment.unitNumber : '',
                typeLabel
            };
        });

        const sortedPayments = [...groupedArray].sort((a, b) => {
            let valA, valB;
            if (sortField === 'name') {
                valA = a.tenantName.toLowerCase();
                valB = b.tenantName.toLowerCase();
            } else if (sortField === 'room') {
                const numA = parseInt(a.roomNumber.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.roomNumber.replace(/\D/g, '')) || 0;
                if (numA !== numB) {
                    valA = numA;
                    valB = numB;
                } else {
                    valA = a.roomNumber.toLowerCase();
                    valB = b.roomNumber.toLowerCase();
                }
            } else if (sortField === 'type') {
                valA = a.typeLabel.toLowerCase();
                valB = b.typeLabel.toLowerCase();
            } else { // default to 'date'
                valA = a.date;
                valB = b.date;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        const PAGE_SIZE = 10;
        const currentPage = currentPages[propId] || 1;
        const totalPages = Math.ceil(sortedPayments.length / PAGE_SIZE) || 1;
        const paginatedPayments = sortedPayments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

        return (
            <div style={{ paddingBottom: '0.75rem' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                        <tr>
                            <th 
                                style={{ borderBottom: '1px solid var(--border-light)', padding: '1rem 0', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('name')}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    Tenant
                                    <span style={{ fontSize: '10px', opacity: sortField === 'name' ? 1 : 0.4 }}>
                                        {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                    </span>
                                </span>
                            </th>
                            <th 
                                style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('room')}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    {lang === 'fr' ? 'Chambre' : 'Room'}
                                    <span style={{ fontSize: '10px', opacity: sortField === 'room' ? 1 : 0.4 }}>
                                        {sortField === 'room' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                    </span>
                                </span>
                            </th>
                            <th 
                                style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('type')}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    Type
                                    <span style={{ fontSize: '10px', opacity: sortField === 'type' ? 1 : 0.4 }}>
                                        {sortField === 'type' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                    </span>
                                </span>
                            </th>
                            <th style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>Month(s) Covered</th>
                            <th 
                                style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('date')}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    Payment Date
                                    <span style={{ fontSize: '10px', opacity: sortField === 'date' ? 1 : 0.4 }}>
                                        {sortField === 'date' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                    </span>
                                </span>
                            </th>
                            <th style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>Amount</th>
                            <th style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedPayments.map(p => {
                            const tenant = state.tenants.find(t => String(t.id) === String(p.tenantId));
                            const apartment = state.apartments.find(a => String(a.id) === String(p.apartmentId || tenant?.apartmentId));
                            
                            // Determine payment types display
                            let typeLabel = 'Rent';
                            let typeBg = '#EFF6FF';
                            let typeColor = '#1D4ED8';
                            let typeBorder = '1px solid #DBEAFE';
                            
                            if (p.types.has('Rent') && p.types.has('Deposit')) {
                                typeLabel = 'Rent & Deposit';
                                typeBg = '#F5F3FF';
                                typeColor = '#6D28D9';
                                typeBorder = '1px solid #EDE9FE';
                            } else if (p.types.has('Deposit')) {
                                typeLabel = 'Deposit';
                                typeBg = '#EEF2FF';
                                typeColor = '#4F46E5';
                                typeBorder = '1px solid #E0E7FF';
                            }

                            const monthDisplay = p.monthList.length > 0 
                                ? p.monthList.map(m => formatMonth(m, lang)).reverse().join(', ') 
                                : '—';
                            return (
                                <tr key={p.id} className="payment-row">
                                    <td style={{ padding: '1rem 0' }}>
                                        {tenant ? (
                                            <span className="clickable-tenant" style={{ fontWeight: '600' }} onClick={() => showTenantHistory(tenant.id)}>
                                                {tenant.name}
                                            </span>
                                        ) : (
                                            <span style={{ fontWeight: '600', color: '#343C6A' }}>Unknown</span>
                                        )}
                                    </td>
                                    <td style={{ fontWeight: '600', color: '#343C6A' }}>{apartment ? apartment.unitNumber : '—'}</td>
                                    <td>
                                        <span style={{ 
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            background: typeBg,
                                            color: typeColor,
                                            border: typeBorder
                                        }}>
                                            {typeLabel}
                                        </span>
                                    </td>
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
                                            <button className="btn-icon" title="Edit"
                                                style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                                                onClick={() => openEditGroup(p)}>
                                                <Edit size={14}/>
                                            </button>
                                            <button className="btn-icon" title="Delete" 
                                                style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}
                                                onClick={() => handleDeleteGroup(p)}>
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.5rem 0', flexWrap: 'wrap', gap: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Page {currentPage} of {totalPages} ({sortedPayments.length} records)
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                                className="btn-secondary" 
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPages(prev => ({ ...prev, [propId]: currentPage - 1 }))}
                            >
                                Previous
                            </button>
                            <button 
                                className="btn-secondary" 
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPages(prev => ({ ...prev, [propId]: currentPage + 1 }))}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="animate-fade-in view-container" style={{ paddingTop: '0.25rem', paddingBottom: '4rem' }}>
            {/* ── Header ── */}
            <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#343C6A', margin: 0, fontFamily: 'Outfit' }}>Payment Ledger History</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div className="search-box">
                        <Search size={18} />
                        <input type="text" placeholder="Filter by tenant..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <button className="btn" style={{ ...btnBlue(false), whiteSpace: 'nowrap' }} onClick={openModal}>
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
                                        {renderPaymentTable(propPayments, prop.id)}
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
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}><CalendarDays size={22} style={{ color: '#2D60FF' }} /> {editGroup ? 'Edit Payment' : 'Register Payment'}</h3>
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
                                <select value={tenantId} onChange={e => handleTenantChange(e.target.value)} style={selectStyle} disabled={!!editGroup}>
                                    <option value="">— Select tenant —</option>
                                    {state.tenants.map(t => {
                                        const apt  = state.apartments.find(a => String(a.id) === String(t.apartmentId));
                                        const prop = apt ? state.properties.find(p => String(p.id) === String(apt.propertyId)) : null;
                                        return (
                                            <option key={t.id} value={t.id}>
                                                {t.name}{t.isAssigned === false ? ' (Contract Finished)' : ''}{prop ? ` — ${prop.name}` : ''}{apt ? ` / ${apt.unitNumber}` : ''}
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
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deposit Paid</div>
                                        <div style={{ fontWeight: '800', color: '#10B981', fontSize: '0.88rem' }}>{selectedTenant.depositMonthsPaid || 0} / {selectedTenant.depositMonths || 0} Month{(selectedTenant.depositMonths || 0) !== 1 ? 's' : ''}</div>
                                    </div>
                                </div>
                            )}

                            {/* Payment Type Toggle */}
                            {selectedTenant && (
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label>Payment Type *</label>
                                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                        <button 
                                            type="button"
                                            onClick={() => setPaymentMode('Rent')}
                                            style={{
                                                flex: 1,
                                                padding: '0.75rem',
                                                borderRadius: '10px',
                                                border: paymentMode === 'Rent' ? '2px solid #2D60FF' : '1px solid #E6EFF5',
                                                background: paymentMode === 'Rent' ? '#F0F5FF' : '#FFFFFF',
                                                color: paymentMode === 'Rent' ? '#2D60FF' : '#718EBF',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            Rent Payment
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setPaymentMode('Deposit')}
                                            style={{
                                                flex: 1,
                                                padding: '0.75rem',
                                                borderRadius: '10px',
                                                border: paymentMode === 'Deposit' ? '2px solid #2D60FF' : '1px solid #E6EFF5',
                                                background: paymentMode === 'Deposit' ? '#F0F5FF' : '#FFFFFF',
                                                color: paymentMode === 'Deposit' ? '#2D60FF' : '#718EBF',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            Security Deposit
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Month grid (Rent Payment Mode) */}
                            {selectedTenant && paymentMode === 'Rent' && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <label style={{ margin: 0, fontWeight: '700', color: '#343C6A', fontSize: '0.9rem' }}>Select Month(s) *</label>
                                        <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.72rem', fontWeight: '600', color: '#718EBF' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#DCFCE7', border: '1px solid #15803D', display: 'inline-block' }} /> Paid</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#EFF6FF', border: '1px solid #2D60FF', display: 'inline-block' }} /> Selected</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#FEF9C3', border: '1px solid #A16207', display: 'inline-block' }} /> Advance</span>
                                        </div>
                                    </div>

                                    {/* Year Navigation Header */}
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        gap: '1.5rem', 
                                        marginBottom: '0.85rem',
                                        background: 'var(--bg-body)',
                                        padding: '0.45rem 1rem',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border-light)'
                                    }}>
                                        <button 
                                            type="button" 
                                            onClick={() => scrollYear('prev')} 
                                            style={{ 
                                                border: 'none', 
                                                background: 'none', 
                                                color: '#2D60FF', 
                                                fontSize: '1.1rem', 
                                                cursor: 'pointer', 
                                                fontWeight: 'bold',
                                                padding: '2px 8px',
                                                userSelect: 'none'
                                            }}
                                        >
                                            ◀
                                        </button>
                                        <span style={{ fontWeight: '800', fontSize: '1.05rem', color: '#343C6A', letterSpacing: '0.5px' }}>
                                            {activeYear}
                                        </span>
                                        <button 
                                            type="button" 
                                            onClick={() => scrollYear('next')} 
                                            style={{ 
                                                border: 'none', 
                                                background: 'none', 
                                                color: '#2D60FF', 
                                                fontSize: '1.1rem', 
                                                cursor: 'pointer', 
                                                fontWeight: 'bold',
                                                padding: '2px 8px',
                                                userSelect: 'none'
                                            }}
                                        >
                                            ▶
                                        </button>
                                    </div>

                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <div 
                                            ref={scrollContainerRef}
                                            onScroll={handleScroll}
                                            className="months-scroll-container"
                                            style={{ 
                                                display: 'flex', 
                                                overflowX: 'auto', 
                                                width: '100%', 
                                                scrollSnapType: 'x mandatory',
                                                scrollBehavior: 'smooth',
                                                scrollbarWidth: 'none',
                                                msOverflowStyle: 'none',
                                                padding: '4px 0'
                                            }}
                                        >
                                            <style>{`
                                                .months-scroll-container::-webkit-scrollbar {
                                                    display: none;
                                                }
                                            `}</style>
                                            {yearsToRender.map(year => {
                                                const yearMonths = Array.from({ length: 12 }, (_, i) => {
                                                    const m = i + 1;
                                                    return `${year}-${String(m).padStart(2, '0')}`;
                                                });

                                                return (
                                                    <div 
                                                        key={year}
                                                        style={{
                                                            flex: '0 0 100%',
                                                            width: '100%',
                                                            scrollSnapAlign: 'start',
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(6, 1fr)',
                                                            gap: '0.5rem',
                                                            boxSizing: 'border-box'
                                                        }}
                                                    >
                                                        {yearMonths.map(val => {
                                                            const isPaid       = paidMonths.has(val);
                                                            const isSelected   = selectedMonths.includes(val);
                                                            const isBeforeEntry = entryMonth ? val < entryMonth : false;

                                                            // Extract month abbreviation
                                                            const [_, mStr] = val.split('-');
                                                            const monthIndex = parseInt(mStr) - 1;
                                                            const fallbackLabel = new Date(year, monthIndex, 1).toLocaleString('default', { month: 'short' });

                                                            // Compute due date label
                                                            const dueLabelObj = agreedDay ? getDueDateLabel(agreedDay, val) : null;

                                                            let bg, border, color, cursor, titleText, isDisabled;
                                                            if (isBeforeEntry) {
                                                                bg = '#F3F4F6'; border = '1.5px solid #E5E7EB'; color = '#9CA3AF'; cursor = 'not-allowed'; titleText = 'Before entry date'; isDisabled = true;
                                                            } else if (isPaid) {
                                                                bg = '#DCFCE7'; border = '1.5px solid #16a34a'; color = '#15803D'; cursor = 'not-allowed'; titleText = 'Already paid'; isDisabled = true;
                                                            } else if (isSelected && val > THIS_MONTH) {
                                                                bg = '#FEF9C3'; border = '1.5px solid #A16207'; color = '#92400E'; cursor = 'pointer'; titleText = 'Advance payment selected'; isDisabled = false;
                                                            } else if (isSelected) {
                                                                bg = '#EFF6FF'; border = '1.5px solid #2D60FF'; color = '#2D60FF'; cursor = 'pointer'; titleText = 'Selected'; isDisabled = false;
                                                            } else if (val > THIS_MONTH) {
                                                                bg = '#FAFAFA'; border = '1.5px dashed #D1D5DB'; color = '#9CA3AF'; cursor = 'pointer'; titleText = 'Click to pay in advance'; isDisabled = false;
                                                            } else if (val === THIS_MONTH) {
                                                                bg = '#F8FAFF'; border = '1.5px solid #93C5FD'; color = '#343C6A'; cursor = 'pointer'; titleText = 'Current month'; isDisabled = false;
                                                            } else {
                                                                bg = '#F9FAFB'; border = '1.5px solid #E5E7EB'; color = '#6B7280'; cursor = 'pointer'; titleText = 'Click to select'; isDisabled = false;
                                                            }

                                                            return (
                                                                <button 
                                                                    key={val} 
                                                                    title={titleText} 
                                                                    onClick={() => toggleMonth(val)} 
                                                                    disabled={isDisabled}
                                                                    style={{ 
                                                                        background: bg, 
                                                                        border, 
                                                                        borderRadius: '8px', 
                                                                        padding: '0.45rem 0.2rem', 
                                                                        cursor, 
                                                                        display: 'flex', 
                                                                        flexDirection: 'column', 
                                                                        alignItems: 'center', 
                                                                        gap: '2px', 
                                                                        transition: 'all 0.15s ease', 
                                                                        position: 'relative', 
                                                                        minHeight: '56px', 
                                                                        justifyContent: 'center',
                                                                        width: '100%',
                                                                        boxSizing: 'border-box'
                                                                    }}
                                                                >
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
                                                                    {isBeforeEntry && <Lock size={9} color="#9CA3AF" style={{ position: 'absolute', top: '3px', right: '3px' }} />}
                                                                    {isPaid && <CheckCircle2 size={11} color="#16a34a" />}
                                                                    {isPaid && <Lock size={9} color="#16a34a" style={{ position: 'absolute', top: '3px', right: '3px' }} />}
                                                                    {isSelected && !isPaid && <CheckCircle2 size={11} color={val > THIS_MONTH ? '#92400E' : '#2D60FF'} />}
                                                                    {val === THIS_MONTH && !isPaid && !isSelected && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#2D60FF', display: 'inline-block' }} />}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Deposit Period (Deposit Mode) */}
                            {selectedTenant && paymentMode === 'Deposit' && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label>Deposit Period (Months) *</label>
                                    <div style={{ fontSize: '0.8rem', color: '#718EBF', marginBottom: '0.75rem', fontWeight: '600' }}>
                                        {editGroup ? (
                                            <>
                                                Current Paid Deposit (excluding this payment): <span style={{ color: '#10B981', fontWeight: '800' }}>{revertedDepositMonthsPaid} / {selectedTenant.depositMonths || 0} Month{revertedDepositMonthsPaid !== 1 ? 's' : ''}</span>
                                            </>
                                        ) : (
                                            <>
                                                Current Paid Deposit: <span style={{ color: '#10B981', fontWeight: '800' }}>{selectedTenant.depositMonthsPaid || 0} / {selectedTenant.depositMonths || 0} Month{selectedTenant.depositMonthsPaid !== 1 ? 's' : ''}</span>
                                            </>
                                        )}
                                    </div>
                                    <select 
                                        value={depositAmountMonths} 
                                        onChange={e => setDepositAmountMonths(Number(e.target.value))} 
                                        style={selectStyle}
                                        disabled={maxDepositMonthsSelectable === 0 && !editGroup}
                                    >
                                        <option value="0">— Select number of months —</option>
                                        {Array.from({ length: Math.max(1, maxDepositMonthsSelectable, depositAmountMonths, selectedTenant?.depositMonths || 3) }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={m}>
                                                {m} Month{m > 1 ? 's' : ''} ({ (m * rentPerMonth).toLocaleString() } {state.settings.currency})
                                            </option>
                                        ))}
                                    </select>
                                    {maxDepositMonthsSelectable === 0 && (
                                        <div style={{ color: 'var(--success)', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: '600' }}>
                                            ✓ Security deposit of {selectedTenant.depositMonths || 0} month(s) has been fully paid.
                                        </div>
                                    )}

                                    {/* Security Deposit Payment History */}
                                    {tenantDepositPayments.length > 0 && (
                                        <div style={{ marginTop: '1.5rem' }}>
                                            <label style={{ fontSize: '0.85rem', color: '#343C6A', fontWeight: '700', display: 'block', marginBottom: '0.5rem' }}>Deposit Payment History</label>
                                            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #E6EFF5', borderRadius: '10px', padding: '0.5rem' }}>
                                                {tenantDepositPayments.map(p => {
                                                    const isCurrentlyEditing = editGroup && p.date === editGroup.date && String(p.tenantId) === String(editGroup.tenantId);
                                                    return (
                                                        <div 
                                                            key={p.id} 
                                                            style={{ 
                                                                display: 'flex', 
                                                                justifyContent: 'space-between', 
                                                                alignItems: 'center', 
                                                                padding: '0.6rem 0.8rem', 
                                                                borderRadius: '8px', 
                                                                marginBottom: '0.4rem', 
                                                                border: isCurrentlyEditing ? '1.5px solid #2D60FF' : '1px dashed #E6EFF5',
                                                                background: isCurrentlyEditing ? '#F0F5FF' : '#F8F9FB',
                                                                fontSize: '0.8rem'
                                                            }}
                                                        >
                                                            <div>
                                                                <span style={{ fontWeight: '700', color: '#343C6A' }}>{p.depositMonths || 0} Month{p.depositMonths !== 1 ? 's' : ''} Paid</span>
                                                                <div style={{ fontSize: '0.7rem', color: '#718EBF', marginTop: '2px' }}>
                                                                    Date: {p.date} {p.note ? `| Note: ${p.note}` : ''}
                                                                </div>
                                                            </div>
                                                            <div style={{ fontWeight: '800', color: isCurrentlyEditing ? '#2D60FF' : '#10B981' }}>
                                                                {p.amount.toLocaleString()} {state.settings.currency}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Summary + date + note (Rent Payment Mode) */}
                            {selectedTenant && paymentMode === 'Rent' && selectedMonths.length > 0 && (
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

                            {/* Summary + date + note (Deposit Mode) */}
                            {selectedTenant && paymentMode === 'Deposit' && depositAmountMonths > 0 && (
                                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#2D60FF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Description</div>
                                        <div style={{ fontSize: '0.8rem', color: '#343C6A', marginTop: '2px', fontWeight: '500' }}>
                                            Security Deposit Payment ({depositAmountMonths} Month{depositAmountMonths > 1 ? 's' : ''})
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#718EBF', fontWeight: '600' }}>Total Amount</div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#2D60FF', fontFamily: 'Outfit' }}>{(depositAmountMonths * rentPerMonth).toLocaleString()} {state.settings.currency}</div>
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
                            <button className="btn" 
                                style={btnBlue(saving || (selectedMonths.length === 0 && depositAmountMonths === 0))} 
                                onClick={handleSave}
                                disabled={saving || (selectedMonths.length === 0 && depositAmountMonths === 0)}
                            >
                                {saving ? 'Saving...' : editGroup ? 'Save Changes' : 'Register Payment'}
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
            const monthsStr = receipt.type === 'Deposit' 
                ? '—'
                : (receipt.monthList
                    ? receipt.monthList.map(m => formatMonth(m, lang)).join(', ')
                    : formatMonth(receipt.monthPaid, lang));

            // Fetch individual payment records for this group
            const groupPayments = state.payments.filter(pay => 
                String(pay.tenantId) === String(receipt.tenantId || receipt.tenant?.id) && 
                pay.date === receipt.date
            );

            // Security Deposit calculations
            const tenant = receipt.tenant || state.tenants.find(t => String(t.id) === String(receipt.tenantId));
            const rentAmount = Number(tenant?.rentAmount || 0);
            const depositMonths = Number(tenant?.depositMonths || 0);
            const reqDeposit = depositMonths * rentAmount;

            const tenantPayments = state.payments.filter(p => 
                String(p.tenantId) === String(tenant?.id) && 
                p.type === 'Deposit' &&
                (p.status === 'Approved' || !p.status)
            );
            const paidDeposit = tenantPayments.reduce((sum, p) => sum + p.amount, 0);
            const depositMonthsPaid = tenantPayments.reduce((sum, p) => 
                sum + (p.depositMonths || (rentAmount > 0 ? Math.round(p.amount / rentAmount) : 1)), 
                0
            );
            const outstandingBalance = paidDeposit - reqDeposit;

            return (
                <>
                    {/* Print-only root (hidden until window.print()) */}
                    <div id="print-receipt-root">
                        <div style={{ fontFamily: 'Arial, sans-serif', padding: '0.8cm', maxWidth: '14cm', margin: '0 auto', color: '#1a1a2e' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #2D60FF', paddingBottom: '10px', marginBottom: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#2D60FF', letterSpacing: '-0.5px' }}>RENT RECEIPT</div>
                                    <div style={{ fontSize: '10px', color: '#718EBF', marginTop: '2px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Confirmation</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '10px', color: '#718EBF', fontWeight: '600' }}>Receipt No.</div>
                                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#1a1a2e' }}>{receiptNo}</div>
                                    <div style={{ fontSize: '9px', color: '#718EBF', marginTop: '2px' }}>Date: {receipt.date}</div>
                                </div>
                            </div>

                            {/* Tenant + Property info */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                                <div style={{ background: '#F5F7FA', borderRadius: '10px', padding: '8px 12px' }}>
                                    <div style={{ fontSize: '8px', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>Received From</div>
                                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#1a1a2e' }}>{receipt.tenant?.name || 'Unknown Tenant'}</div>
                                    {receipt.tenant?.phone && <div style={{ fontSize: '10px', color: '#718EBF', marginTop: '2px' }}>📞 {receipt.tenant.phone}</div>}
                                    {receipt.tenant?.email && <div style={{ fontSize: '10px', color: '#718EBF' }}>✉ {receipt.tenant.email}</div>}
                                    {(depositMonths > 0 || paidDeposit > 0) && (
                                        <>
                                            <div style={{ borderTop: '1px solid #E6EFF5', marginTop: '8px', paddingTop: '8px', fontSize: '11px', color: '#343C6A' }}>
                                                <strong>Deposit:</strong> {depositMonthsPaid}/{depositMonths} paid
                                            </div>
                                            <div style={{ fontSize: '11px', color: outstandingBalance < 0 ? '#EF4444' : '#10B981' }}>
                                                <strong>Outstanding Deposit:</strong> {outstandingBalance.toLocaleString()} {state.settings.currency}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div style={{ background: '#F5F7FA', borderRadius: '10px', padding: '8px 12px' }}>
                                    <div style={{ fontSize: '8px', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>Property / Unit</div>
                                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#1a1a2e' }}>{prop?.name || '—'}</div>
                                    <div style={{ fontSize: '10px', color: '#718EBF', marginTop: '2px' }}>{prop?.address || ''}</div>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#2D60FF', marginTop: '2px' }}>Unit: {apt?.unitNumber || '—'} ({apt?.type || '—'})</div>
                                </div>
                            </div>

                            {/* Payment details table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '11px' }}>
                                <thead>
                                    <tr style={{ background: '#2D60FF', color: 'white' }}>
                                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '700', borderRadius: '8px 0 0 0' }}>Description</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '700' }}>Period</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', borderRadius: '0 8px 0 0' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupPayments.length > 0 ? (
                                        groupPayments.map(pay => {
                                            let desc = 'Monthly Rent';
                                            let period = '—';
                                            if (pay.type === 'Deposit') {
                                                desc = 'Security Deposit';
                                                const mCount = pay.depositMonths || 0;
                                                period = `${mCount} Month${mCount !== 1 ? 's' : ''}`;
                                            } else if (pay.type === 'Rent') {
                                                desc = 'Monthly Rent';
                                                period = pay.monthList
                                                    ? pay.monthList.map(m => formatMonth(m, lang)).join(', ')
                                                    : formatMonth(pay.monthPaid, lang);
                                            } else if (pay.type) {
                                                desc = pay.type === 'Utility' ? 'Utility Bill' : pay.type;
                                                if (pay.utilityId) {
                                                    desc += ` (${pay.utilityId})`;
                                                }
                                                period = '—';
                                            }
                                            return (
                                                <tr key={pay.id} style={{ borderBottom: '1px solid #E6EFF5' }}>
                                                    <td style={{ padding: '8px', color: '#343C6A', fontWeight: '600' }}>{desc}</td>
                                                    <td style={{ padding: '8px', color: '#718EBF' }}>{period}</td>
                                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#2D60FF' }}>
                                                        {pay.amount.toLocaleString()} {state.settings.currency}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr style={{ borderBottom: '1px solid #E6EFF5' }}>
                                            <td style={{ padding: '8px', color: '#343C6A', fontWeight: '600' }}>
                                                {receipt.types?.has('Rent') && receipt.types?.has('Deposit') ? 'Monthly Rent & Security Deposit' : (receipt.types?.has('Deposit') ? 'Security Deposit' : 'Monthly Rent')}
                                            </td>
                                            <td style={{ padding: '8px', color: '#718EBF' }}>{monthsStr}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: '800', color: '#2D60FF' }}>
                                                {(receipt.totalAmount || receipt.amount || 0).toLocaleString()} {state.settings.currency}
                                            </td>
                                        </tr>
                                    )}
                                    {receipt.note && (
                                        <tr style={{ borderBottom: '1px solid #E6EFF5' }}>
                                            <td style={{ padding: '8px', color: '#718EBF', fontStyle: 'italic' }} colSpan={3}>Note: {receipt.note}</td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: '#F5F7FA' }}>
                                        <td colSpan={2} style={{ padding: '8px', fontWeight: '800', fontSize: '12px', color: '#343C6A' }}>TOTAL PAID</td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '900', fontSize: '15px', color: '#2D60FF' }}>
                                            {(receipt.totalAmount || receipt.amount || 0).toLocaleString()} {state.settings.currency}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* Security Deposit Status */}
                            {(reqDeposit > 0 || paidDeposit > 0) ? (
                                <div style={{ marginTop: '10px', marginBottom: '10px', background: '#F5F7FA', borderRadius: '12px', padding: '10px 12px', border: '1px solid #E6EFF5' }}>
                                    <div style={{ fontSize: '10px', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', textAlign: 'left' }}>Security Deposit Status</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', textAlign: 'left' }}>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontSize: '8px', color: '#718EBF', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Deposit Progress</span>
                                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#343C6A', display: 'block', marginTop: '1px' }}>
                                                {depositMonthsPaid} / {depositMonths} paid
                                            </span>
                                            <span style={{ fontSize: '8px', color: '#718EBF', display: 'block', marginTop: '0px' }}>(Required: {reqDeposit.toLocaleString()} {state.settings.currency})</span>
                                        </div>
                                        <div style={{ flex: 1, borderLeft: '1px solid #E6EFF5', paddingLeft: '15px' }}>
                                            <span style={{ fontSize: '8px', color: '#718EBF', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Deposit Held (Current)</span>
                                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#2D60FF', display: 'block', marginTop: '1px' }}>
                                                {paidDeposit.toLocaleString()} {state.settings.currency}
                                            </span>
                                        </div>
                                        <div style={{ flex: 1, borderLeft: '1px solid #E6EFF5', paddingLeft: '15px' }}>
                                            <span style={{ fontSize: '8px', color: '#718EBF', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Outstanding Balance</span>
                                            <span style={{ fontSize: '11px', fontWeight: '800', color: outstandingBalance < 0 ? '#EF4444' : '#10B981', display: 'block', marginTop: '1px' }}>
                                                {outstandingBalance.toLocaleString()} {state.settings.currency}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ marginTop: '10px', marginBottom: '10px', background: '#F5F7FA', borderRadius: '12px', padding: '10px 12px', border: '1px solid #E6EFF5' }}>
                                    <div style={{ fontSize: '10px', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', textAlign: 'left' }}>Security Deposit Status</div>
                                    <div style={{ fontSize: '11px', color: '#718EBF', fontWeight: '600', fontStyle: 'italic', textAlign: 'left' }}>No security deposit required or held for this tenancy.</div>
                                </div>
                            )}

                            {/* Footer */}
                             <div style={{ borderTop: '1px dashed #E6EFF5', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                 {state.settings.signature ? (
                                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                         <img src={state.settings.signature} style={{ maxHeight: '40px', maxWidth: '150px', display: 'block', marginBottom: '2px' }} alt="Landlord Signature" />
                                         <div style={{ fontSize: '0.65rem', color: '#718EBF', textTransform: 'uppercase', borderTop: '1px solid #E6EFF5', display: 'inline-block', width: '120px', paddingTop: '1px', fontWeight: 'bold' }}>Landlord Signature</div>
                                     </div>
                                 ) : (
                                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingTop: '8px' }}>
                                         <div style={{ fontSize: '0.65rem', color: '#B1B1B1', textTransform: 'uppercase', borderTop: '1px dashed #B1B1B1', display: 'inline-block', width: '120px', paddingTop: '1px', fontWeight: 'bold' }}>Landlord Signature</div>
                                     </div>
                                 )}
                                 <div style={{ fontSize: '10px', color: '#2D60FF', fontWeight: '700', paddingBottom: '5px' }}>✓ PAYMENT CONFIRMED</div>
                                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingTop: '8px' }}>
                                     <div style={{ fontSize: '0.65rem', color: '#B1B1B1', textTransform: 'uppercase', borderTop: '1px dashed #B1B1B1', display: 'inline-block', width: '120px', paddingTop: '1px', fontWeight: 'bold', textAlign: 'right' }}>Tenant Signature</div>
                                 </div>
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
                                            {(depositMonths > 0 || paidDeposit > 0) && (
                                                <>
                                                    <div style={{ borderTop: '1px solid #E6EFF5', marginTop: '8px', paddingTop: '8px', fontSize: '11px', color: '#343C6A' }}>
                                                        <strong>Deposit:</strong> {depositMonthsPaid}/{depositMonths} paid
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: outstandingBalance < 0 ? '#EF4444' : '#10B981' }}>
                                                        <strong>Outstanding Deposit:</strong> {outstandingBalance.toLocaleString()} {state.settings.currency}
                                                    </div>
                                                </>
                                            )}
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
                                            {groupPayments.length > 0 ? (
                                                groupPayments.map(pay => {
                                                    let desc = 'Monthly Rent';
                                                    let period = '—';
                                                    if (pay.type === 'Deposit') {
                                                        desc = 'Security Deposit';
                                                        const mCount = pay.depositMonths || 0;
                                                        period = `${mCount} Month${mCount !== 1 ? 's' : ''}`;
                                                    } else if (pay.type === 'Rent') {
                                                        desc = 'Monthly Rent';
                                                        period = pay.monthList
                                                            ? pay.monthList.map(m => formatMonth(m, lang)).join(', ')
                                                            : formatMonth(pay.monthPaid, lang);
                                                    } else if (pay.type) {
                                                        desc = pay.type === 'Utility' ? 'Utility Bill' : pay.type;
                                                        if (pay.utilityId) {
                                                            desc += ` (${pay.utilityId})`;
                                                        }
                                                        period = '—';
                                                    }
                                                    return (
                                                        <tr key={pay.id} style={{ borderBottom: '1px solid #E6EFF5' }}>
                                                            <td style={{ padding: '0.8rem 1rem', fontWeight: '600', color: '#343C6A' }}>{desc}</td>
                                                            <td style={{ padding: '0.8rem 1rem', color: '#718EBF' }}>{period}</td>
                                                            <td style={{ padding: '0.8rem 1rem', textAlign: 'right', fontWeight: '800', color: '#2D60FF' }}>
                                                                {pay.amount.toLocaleString()} {state.settings.currency}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr style={{ borderBottom: '1px solid #E6EFF5' }}>
                                                    <td style={{ padding: '0.8rem 1rem', fontWeight: '600', color: '#343C6A' }}>
                                                        {receipt.types?.has('Rent') && receipt.types?.has('Deposit') ? 'Monthly Rent & Security Deposit' : (receipt.types?.has('Deposit') ? 'Security Deposit' : 'Monthly Rent')}
                                                    </td>
                                                    <td style={{ padding: '0.8rem 1rem', color: '#718EBF' }}>{monthsStr}</td>
                                                    <td style={{ padding: '0.8rem 1rem', textAlign: 'right', fontWeight: '800', color: '#2D60FF' }}>
                                                        {(receipt.totalAmount || receipt.amount || 0).toLocaleString()} {state.settings.currency}
                                                    </td>
                                                </tr>
                                            )}
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

                                    {/* Security Deposit Details */}
                                    {(reqDeposit > 0 || paidDeposit > 0) ? (
                                        <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem', background: '#F5F7FA', borderRadius: '12px', padding: '1rem', border: '1px solid #E6EFF5' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', textAlign: 'left' }}>Security Deposit Status</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', textAlign: 'left' }}>
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ fontSize: '0.6rem', color: '#718EBF', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Deposit Progress</span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#343C6A', display: 'block', marginTop: '2px' }}>
                                                        {depositMonthsPaid} / {depositMonths} paid
                                                    </span>
                                                    <span style={{ fontSize: '0.6rem', color: '#718EBF', display: 'block', marginTop: '1px' }}>(Required: {reqDeposit.toLocaleString()} {state.settings.currency})</span>
                                                </div>
                                                <div style={{ flex: 1, borderLeft: '1px solid #E6EFF5', paddingLeft: '1rem' }}>
                                                    <span style={{ fontSize: '0.6rem', color: '#718EBF', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Deposit Held (Current)</span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#2D60FF', display: 'block', marginTop: '2px' }}>
                                                        {paidDeposit.toLocaleString()} {state.settings.currency}
                                                    </span>
                                                </div>
                                                <div style={{ flex: 1, borderLeft: '1px solid #E6EFF5', paddingLeft: '1rem' }}>
                                                    <span style={{ fontSize: '0.6rem', color: '#718EBF', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Outstanding Balance</span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: outstandingBalance < 0 ? '#EF4444' : '#10B981', display: 'block', marginTop: '2px' }}>
                                                        {outstandingBalance.toLocaleString()} {state.settings.currency}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ marginTop: '1rem', marginBottom: '1rem', background: '#F5F7FA', borderRadius: '12px', padding: '0.75rem', border: '1px solid #E6EFF5' }}>
                                            <div style={{ fontSize: '0.65rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', textAlign: 'left' }}>Security Deposit Status</div>
                                            <div style={{ fontSize: '0.7rem', color: '#718EBF', fontWeight: '600', fontStyle: 'italic', textAlign: 'left' }}>No security deposit required or held for this tenancy.</div>
                                        </div>
                                    )}

                                    {/* Footer note / Signature */}
                                     <div style={{ borderTop: '1px dashed #E6EFF5', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                         {state.settings.signature ? (
                                             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                 <img src={state.settings.signature} style={{ maxHeight: '30px', maxWidth: '120px', display: 'block', marginBottom: '1px' }} alt="Landlord Signature" />
                                                 <div style={{ fontSize: '0.6rem', color: '#718EBF', textTransform: 'uppercase', borderTop: '1px solid #E6EFF5', display: 'inline-block', width: '100px', paddingTop: '1px', fontWeight: 'bold' }}>Landlord Signature</div>
                                             </div>
                                         ) : (
                                             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingTop: '5px' }}>
                                                 <div style={{ fontSize: '0.6rem', color: '#B1B1B1', textTransform: 'uppercase', borderTop: '1px dashed #B1B1B1', display: 'inline-block', width: '100px', paddingTop: '1px', fontWeight: 'bold' }}>Landlord Signature</div>
                                             </div>
                                         )}
                                         <div style={{ fontSize: '0.7rem', color: '#15803D', fontWeight: '700', paddingBottom: '3px' }}>✓ PAYMENT CONFIRMED</div>
                                         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingTop: '5px' }}>
                                             <div style={{ fontSize: '0.6rem', color: '#B1B1B1', textTransform: 'uppercase', borderTop: '1px dashed #B1B1B1', display: 'inline-block', width: '100px', paddingTop: '1px', fontWeight: 'bold', textAlign: 'right' }}>Tenant Signature</div>
                                         </div>
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
