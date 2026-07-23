import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StateProvider, useAppState } from './context/StateContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import Tenants from './pages/Tenants';
import Payments from './pages/Payments';
import Submissions from './pages/Submissions';
import Utilities from './pages/Utilities';
import Settings from './pages/Settings';
import Contracts from './pages/Contracts';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import TenantPaymentSubmit from './pages/TenantPaymentSubmit';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

import { X, Printer, Edit, Trash2, CalendarDays, Receipt } from 'lucide-react';
import axios from 'axios';
import { formatMonth, getMonthsDifference } from './utils';

function TenantHistoryModal() {
  const { activeTenantHistoryId, setActiveTenantHistoryId, state, setState, API_URL } = useAppState();
  const navigate = useNavigate();
  const [previewReceipt, setPreviewReceipt] = useState(null);

  if (!activeTenantHistoryId) return null;

  const tenantObj = state.tenants.find(t => String(t.id) === String(activeTenantHistoryId));
  if (!tenantObj) return null;

  const apartment = state.apartments.find(a => String(a.id) === String(tenantObj.apartmentId));
  const property = apartment ? state.properties.find(p => String(p.id) === String(apartment.propertyId)) : null;

  const lang = state.settings.lang || 'en';
  const currency = state.settings.currency || 'CFA';

  // 1. Total rent paid
  const tenantPayments = state.payments.filter(p => String(p.tenantId) === String(tenantObj.id));
  const totalRentPaid = tenantPayments.filter(p => p.type === 'Rent').reduce((sum, p) => sum + p.amount, 0);

  // 2. Next payment due date
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

  const getDueDateForMonth = (dueDateDay, monthStr) => {
      if (!monthStr || !monthStr.includes('-')) return '';
      const [y, m] = monthStr.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const cappedDay = Math.min(dueDateDay || 1, daysInMonth);
      return `${monthStr}-${String(cappedDay).padStart(2, '0')}`;
  };

  const nextUnpaidMonth = getNextMonth(tenantObj.lastPaidMonth);
  const nextDueDate = tenantObj.isAssigned !== false ? getDueDateForMonth(tenantObj.dueDateDay, nextUnpaidMonth) : (lang === 'fr' ? 'Contrat terminé' : 'Contract Finished');

  const getMonthsInRange = (start, end) => {
      const startYear = parseInt(start.split('-')[0]);
      const startMonth = parseInt(start.split('-')[1]);
      const endYear = parseInt(end.split('-')[0]);
      const endMonth = parseInt(end.split('-')[1]);
      
      const months = [];
      let currYear = startYear;
      let currMonth = startMonth;
      
      while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
          months.push(`${currYear}-${String(currMonth).padStart(2, '0')}`);
          currMonth++;
          if (currMonth > 12) {
              currMonth = 1;
              currYear++;
          }
      }
      return months;
  };

  const getUnpaidMonthsList = (tenant) => {
      const today = new Date();
      const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
      let startDateStr = '';
      
      const tenantContracts = state.contracts.filter(c => String(c.tenantId) === String(tenant.id));
      if (tenantContracts.length > 0) {
          const sortedContracts = [...tenantContracts].sort((a, b) => a.startDate.localeCompare(b.startDate));
          startDateStr = sortedContracts[0].startDate.slice(0, 7);
      } else {
          const tenantPayments = state.payments.filter(p => String(p.tenantId) === String(tenant.id));
          if (tenantPayments.length > 0) {
              const sortedPayments = [...tenantPayments].sort((a, b) => a.date.localeCompare(b.date));
              startDateStr = sortedPayments[0].date.slice(0, 7);
          } else {
              startDateStr = `${today.getFullYear()}-01`;
          }
      }

      if (startDateStr > currentMonthStr) {
          return [];
      }

      const allMonths = getMonthsInRange(startDateStr, currentMonthStr);
      
      const paidMonths = state.payments
          .filter(p => String(p.tenantId) === String(tenant.id) && p.type === 'Rent')
          .reduce((acc, p) => {
              if (p.monthPaid) acc.add(p.monthPaid);
              if (p.monthList) p.monthList.forEach(m => acc.add(m));
              return acc;
          }, new Set());

      return allMonths.filter(m => !paidMonths.has(m));
  };

  const unpaidMonthsList = getUnpaidMonthsList(tenantObj);
  const totalAmountDue = unpaidMonthsList.length * (tenantObj.rentAmount || 0);

  // Group payments for the history table
  const grouped = tenantPayments.reduce((acc, p) => {
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

  const sortedGrouped = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));

  const handlePrintTenantPDF = () => {
      const signature = state.settings.signature || '';
      const rentTotal = tenantPayments.filter(p => p.type === 'Rent').reduce((sum, p) => sum + p.amount, 0);
      const depositTotal = tenantPayments.filter(p => p.type === 'Deposit').reduce((sum, p) => sum + p.amount, 0);
      const grandTotal = rentTotal + depositTotal;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
          alert("Popup blocker prevented opening the print window. Please allow popups.");
          return;
      }

      let htmlContent = `
          <html>
          <head>
              <title>Tenant Ledger - ${tenantObj.name}</title>
              <style>
                  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
                  @page {
                      size: A4;
                      margin: 10mm 15mm 10mm 15mm;
                  }
                  body {
                      font-family: 'Outfit', sans-serif;
                      color: #343C6A;
                      padding: 0;
                      margin: 0;
                      background: #fff;
                      font-size: 11px;
                      line-height: 1.35;
                  }
                  .header {
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      border-bottom: 1.5px solid #E6EFF5;
                      padding-bottom: 8px;
                      margin-bottom: 12px;
                  }
                  .title h1 {
                      font-size: 16px;
                      font-weight: 800;
                      margin: 0;
                      color: #2D60FF;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                  }
                  .title p {
                      font-size: 11px;
                      color: #718EBF;
                      margin: 3px 0 0;
                      font-weight: 600;
                  }
                  .meta {
                      text-align: right;
                      font-size: 10px;
                      color: #718EBF;
                      font-weight: 600;
                  }
                  .meta strong {
                      color: #343C6A;
                  }
                  .summary-grid {
                      display: grid;
                      grid-template-columns: repeat(3, 1fr);
                      gap: 12px;
                      margin-bottom: 15px;
                  }
                  .summary-card {
                      background: #F5F7FA;
                      border: 1px solid #E6EFF5;
                      border-radius: 8px;
                      padding: 8px 12px;
                  }
                  .summary-card.accent {
                      background: rgba(45, 96, 255, 0.05);
                      border-color: rgba(45, 96, 255, 0.15);
                  }
                  .summary-card span {
                      font-size: 8px;
                      color: #718EBF;
                      font-weight: 700;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      display: block;
                      margin-bottom: 3px;
                  }
                  .summary-card h3 {
                      font-size: 13px;
                      font-weight: 800;
                      margin: 0;
                      color: #343C6A;
                  }
                  .summary-card.accent h3 {
                      color: #2D60FF;
                  }
                  .table-title {
                      font-size: 11px;
                      font-weight: 800;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      margin-bottom: 8px;
                      color: #343C6A;
                  }
                  table {
                      width: 100%;
                      border-collapse: collapse;
                      margin-bottom: 15px;
                  }
                  th {
                      background: #F5F7FA;
                      color: #718EBF;
                      font-size: 9px;
                      font-weight: 700;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      text-align: left;
                      padding: 6px 8px;
                      border-bottom: 1px solid #E6EFF5;
                  }
                  td {
                      padding: 6px 8px;
                      font-size: 10px;
                      border-bottom: 1px solid #E6EFF5;
                      color: #343C6A;
                      font-weight: 500;
                  }
                  tr:last-child td {
                      border-bottom: none;
                  }
                  .pill {
                      display: inline-block;
                      padding: 2px 6px;
                      border-radius: 12px;
                      font-size: 9px;
                      font-weight: 700;
                  }
                  .pill.rent {
                      background: #E7EDFF;
                      color: #2D60FF;
                  }
                  .pill.deposit {
                      background: #E6F4EA;
                      color: #10B981;
                  }
                  .amount {
                      font-weight: 700;
                      text-align: right;
                  }
                  .right-align {
                      text-align: right;
                  }
                  .footer {
                      font-size: 9px;
                      color: #718EBF;
                      text-align: center;
                      margin-top: 20px;
                      border-top: 1px solid #E6EFF5;
                      padding-top: 10px;
                      font-weight: 600;
                  }
                  @media print {
                      body {
                          padding: 0;
                          margin: 0;
                      }
                  }
              </style>
          </head>
          <body>
              <div class="header">
                  <div class="title">
                      <h1>Tenant Ledger Report</h1>
                      <p>${tenantObj.name}</p>
                  </div>
                  <div class="meta">
                      Property: <strong>${property ? property.name : '—'}</strong><br>
                      Unit: <strong>${apartment ? `Apt ${apartment.unitNumber}` : '—'}</strong><br>
                      Generated: <strong>${new Date().toLocaleDateString()}</strong>
                  </div>
              </div>

              <div class="summary-grid">
                  <div class="summary-card">
                      <span>Rent Paid</span>
                      <h3>${rentTotal.toLocaleString()} ${currency}</h3>
                  </div>
                  <div class="summary-card">
                      <span>Deposit Paid</span>
                      <h3>${depositTotal.toLocaleString()} ${currency}</h3>
                  </div>
                  <div class="summary-card accent">
                      <span>Total Paid</span>
                      <h3>${grandTotal.toLocaleString()} ${currency}</h3>
                  </div>
              </div>

              <div class="table-title">Transaction History</div>
              <table>
                  <thead>
                      <tr>
                          <th>Payment Date</th>
                          <th>Type</th>
                          <th>Period Covered</th>
                          <th class="right-align">Amount</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${sortedGrouped.map(p => {
                          let typeLabel = 'Rent';
                          if (p.types.has('Rent') && p.types.has('Deposit')) {
                              typeLabel = 'Rent & Deposit';
                          } else if (p.types.has('Deposit')) {
                              typeLabel = 'Deposit';
                          }
                          const monthDisplay = p.monthList.length > 0 
                              ? p.monthList.map(m => formatMonth(m, lang)).reverse().join(', ') 
                              : '—';
                          return `
                              <tr>
                                  <td>${p.date}</td>
                                  <td>
                                      <span class="pill ${typeLabel.includes('Deposit') ? 'deposit' : 'rent'}">
                                          ${typeLabel}
                                      </span>
                                  </td>
                                  <td>${monthDisplay}</td>
                                  <td class="amount">${p.totalAmount.toLocaleString()} ${currency}</td>
                              </tr>
                          `;
                      }).join('')}
                      ${sortedGrouped.length === 0 ? `
                          <tr>
                              <td colspan="4" style="text-align: center; color: #718EBF; padding: 15px;">
                                  No payments recorded.
                              </td>
                          </tr>
                      ` : ''}
                  </tbody>
              </table>

              <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; margin-bottom: 15px; border-top: 1px dashed #E6EFF5; padding-top: 12px;">
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
                  <div class="signature-container" style="text-align: right; padding-top: 20px;">
                      <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px dashed #B1B1B1; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Tenant Signature</div>
                  </div>
              </div>

              <div class="footer" style="display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: bold; color: #718EBF;">
                  <img src="/favicon.png" style="height: 12px; width: auto;" alt="App Logo" />
                  Powered by Property Manager Suite — Tenant Account Statement
              </div>

              <script>
                  window.onload = function() {
                      setTimeout(function() {
                          window.print();
                          window.close();
                      }, 500);
                  };
              </script>
          </body>
          </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
  };

  const printReceipt = (receiptData) => {
      const tenant = receiptData.tenant || state.tenants.find(t => String(t.id) === String(receiptData.tenantId || tenantObj?.id));
      const apt  = tenant ? state.apartments.find(a => String(a.id) === String(tenant.apartmentId)) : null;
      const prop = apt ? state.properties.find(p => String(p.id) === String(apt.propertyId)) : null;
      const receiptNo  = `RCP-${receiptData.id?.replace('pay','').slice(-6) || Date.now()}`;
      const monthsStr  = receiptData.type === 'Deposit' 
          ? '—'
          : (receiptData.monthList
              ? receiptData.monthList.map(m => formatMonth(m, lang)).join(', ')
              : formatMonth(receiptData.monthPaid, lang));
      const total = (receiptData.totalAmount || receiptData.amount || 0).toLocaleString();
      const signature = state.settings.signature || '';

      // Fetch individual payment records for this group
      const groupPayments = state.payments.filter(pay => 
          String(pay.tenantId) === String(receiptData.tenantId || tenant?.id) && 
          pay.date === receiptData.date
      );

      // Security Deposit calculations
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
        <div class="info-name">${tenant?.name || 'Unknown'}</div>
        ${tenant?.phone ? `<div class="info-sub">&#128222; ${tenant.phone}</div>` : ''}
        ${tenant?.email ? `<div class="info-sub">&#9993; ${tenant.email}</div>` : ''}
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

  const handleEditPaymentGroup = (group) => {
      setActiveTenantHistoryId(null);
      navigate('/payments', { 
          state: { 
              editPaymentGroupDate: group.date, 
              editPaymentGroupTenantId: tenantObj.id 
          } 
      });
  };

  const handleDeletePaymentGroup = async (group) => {
      if (!confirm('Are you sure you want to delete this payment group?')) return;
      try {
          const groupPayments = state.payments.filter(p => 
              String(p.tenantId) === String(tenantObj.id) && 
              p.date === group.date
          );
          
          await Promise.all(groupPayments.map(p => axios.delete(`${API_URL}/payments/${p.id}`)));
          
          const tenantId = tenantObj.id;
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

  return (
    <div className="modal-overlay active" onClick={() => setActiveTenantHistoryId(null)} style={{ zIndex: 9999 }}>
      <div className="modal animate-pop-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', width: '92%' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E6EFF5', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #E7EDFF', background: '#F5F7FA' }}>
              <img src={`https://robohash.org/${encodeURIComponent(tenantObj.name)}?set=set4`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            </div>
            <div>
              <h3 style={{ margin: 0, color: '#343C6A', fontSize: '1.2rem', fontWeight: '800' }}>{tenantObj.name}</h3>
              <div style={{ fontSize: '0.8rem', color: '#718EBF', fontWeight: '500' }}>
                {tenantObj.isAssigned !== false ? (
                    `${property ? property.name : '—'} • Room ${apartment ? apartment.unitNumber : '—'}`
                ) : (
                    <span style={{ color: '#D97706', fontWeight: '600' }}>
                        ⚠️ Previously: {property ? property.name : '—'} • Room {apartment ? apartment.unitNumber : '—'}
                    </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
                onClick={handlePrintTenantPDF}
                className="btn-primary"
                style={{ 
                    padding: '0.4rem 0.8rem', 
                    fontSize: '0.72rem', 
                    borderRadius: '8px', 
                    fontWeight: '700', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    cursor: 'pointer',
                    border: 'none',
                    background: '#2D60FF',
                    color: '#fff',
                    boxShadow: '0 4px 10px rgba(45, 96, 255, 0.2)'
                }}
            >
                <Printer size={12} />
                Print Financial Report
            </button>
            <button className="btn-close" onClick={() => setActiveTenantHistoryId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#718EBF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: '1.5rem 0' }}>
          {/* Top Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {/* Stat 1: Total Rent Paid */}
            <div style={{ background: '#EDF9F0', border: '1px solid #DEF7EC', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#03543F', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {lang === 'fr' ? 'Loyer Total Payé' : 'Total Rent Paid'}
              </span>
              <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#03543F' }}>
                {totalRentPaid.toLocaleString()} {currency}
              </span>
            </div>

            {/* Stat 2: Next Due Date */}
            <div style={{ background: '#FEF08A', border: '1px solid #FEF08A', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#713F12', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {lang === 'fr' ? 'Prochain Échéance' : 'Next Payment Due'}
              </span>
              <span style={{ fontSize: '1.15rem', fontWeight: '800', color: '#713F12' }}>
                {nextDueDate}
              </span>
            </div>

            {/* Stat 3: Deposit Information */}
            <div style={{ background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#1E40AF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {lang === 'fr' ? 'Dépôt de Garantie' : 'Security Deposit'}
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1E40AF' }}>
                {tenantObj.depositMonthsPaid || 0} / {tenantObj.depositMonths || 0} Mo. Paid
              </span>
              <span style={{ fontSize: '0.7rem', color: '#1E40AF', fontWeight: '600' }}>
                Paid Amount: {(tenantObj.depositPaidAmount || 0).toLocaleString()} {currency}
              </span>
            </div>

            {/* Stat 4: Unpaid Months & Arrears */}
            <div style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#991B1B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {lang === 'fr' ? 'Impayés / Arriérés' : 'Arrears / Unpaid Rent'}
              </span>
              <span style={{ fontSize: '1.25rem', fontWeight: '850', color: '#DC2626' }}>
                {totalAmountDue.toLocaleString()} {currency}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#374151', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={unpaidMonthsList.length > 0 ? unpaidMonthsList.map(m => formatMonth(m, lang)).join(', ') : ''}>
                {unpaidMonthsList.length > 0 
                  ? `${lang === 'fr' ? 'Mois' : 'Due'}: ${unpaidMonthsList.map(m => formatMonth(m, lang)).join(', ')}`
                  : (lang === 'fr' ? 'Aucun impayé' : 'No unpaid months')}
              </span>
            </div>
          </div>

          {/* Payment History Table */}
          <h4 style={{ color: '#343C6A', fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.75rem' }}>
            {lang === 'fr' ? 'Historique des Paiements' : 'Payment History Ledger'}
          </h4>
          
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid var(--border-light)', padding: '0.75rem 0', textAlign: 'left', fontSize: '0.8rem' }}>Tenant</th>
                  <th style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', fontSize: '0.8rem' }}>Room</th>
                  <th style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', fontSize: '0.8rem' }}>Type</th>
                  <th style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', fontSize: '0.8rem' }}>Period Covered</th>
                  <th style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', fontSize: '0.8rem' }}>Payment Date</th>
                  <th style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', fontSize: '0.8rem' }}>Amount</th>
                  <th style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'right', fontSize: '0.8rem', paddingRight: '0.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedGrouped.map(p => {
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
                      <td style={{ fontWeight: '600', color: '#343C6A', padding: '0.85rem 0', fontSize: '0.85rem' }}>{tenantObj.name}</td>
                      <td style={{ fontWeight: '600', color: '#343C6A', fontSize: '0.85rem' }}>{apartment ? apartment.unitNumber : '—'}</td>
                      <td>
                        <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            background: typeBg,
                            color: typeColor,
                            border: typeBorder
                        }}>
                          {typeLabel}
                        </span>
                      </td>
                      <td>
                        <span className="status-pill" style={{ fontSize: '0.7rem', background: '#F5F7FA', color: 'var(--secondary)', minWidth: 'auto', padding: '0.2rem 0.4rem' }}>
                          {monthDisplay}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.date}</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '0.85rem' }}>{p.totalAmount.toLocaleString()} {currency}</td>
                      <td style={{ textAlign: 'right', paddingRight: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn-icon" title="Print Receipt"
                              style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                              onClick={() => setPreviewReceipt(p)}>
                              <Printer size={14}/>
                          </button>
                          <button className="btn-icon" title="Edit"
                              style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                              onClick={() => handleEditPaymentGroup(p)}>
                              <Edit size={14}/>
                          </button>
                          <button className="btn-icon" title="Delete" 
                              style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}
                              onClick={() => handleDeletePaymentGroup(p)}>
                              <Trash2 size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedGrouped.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {lang === 'fr' ? 'Aucun paiement enregistré pour ce locataire.' : 'No payments registered for this tenant.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {previewReceipt && (() => {
            const apt = apartment;
            const prop = property;
            const receiptNo = `RCP-${previewReceipt.id?.replace('pay','').slice(-6) || Date.now()}`;
            const monthsStr = previewReceipt.type === 'Deposit' 
                ? '—'
                : (previewReceipt.monthList
                    ? previewReceipt.monthList.map(m => formatMonth(m, lang)).join(', ')
                    : formatMonth(previewReceipt.monthPaid, lang));

            // Fetch individual payment records for this group
            const groupPayments = state.payments.filter(pay => 
                String(pay.tenantId) === String(tenantObj.id) && 
                pay.date === previewReceipt.date
            );

            // Security Deposit calculations
            const rentAmount = Number(tenantObj.rentAmount || 0);
            const depositMonths = Number(tenantObj.depositMonths || 0);
            const reqDeposit = depositMonths * rentAmount;

            const tenantPayments = state.payments.filter(p => 
                String(p.tenantId) === String(tenantObj.id) && 
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
                <div className="modal-overlay active" style={{ zIndex: 10000 }} onClick={() => setPreviewReceipt(null)}>
                    <div className="modal animate-pop-in" style={{ maxWidth: '600px', padding: 0, overflow: 'hidden', borderRadius: '20px' }} onClick={e => e.stopPropagation()}>
                        {/* Modal header */}
                        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E6EFF5' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.05rem', color: '#343C6A' }}>
                                <Receipt size={20} style={{ color: '#2D60FF' }} /> Payment Receipt
                            </h3>
                            <button className="btn-close" onClick={() => setPreviewReceipt(null)}><X size={20} /></button>
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
                                        <div style={{ fontSize: '0.72rem', color: '#718EBF', marginTop: '2px' }}>Date: {previewReceipt.date}</div>
                                    </div>
                                </div>

                                {/* Tenant + Property */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div style={{ background: '#F5F7FA', borderRadius: '10px', padding: '1rem' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Received From</div>
                                        <div style={{ fontSize: '1rem', fontWeight: '800', color: '#343C6A' }}>{tenantObj.name}</div>
                                        {tenantObj.phone && <div style={{ fontSize: '0.78rem', color: '#718EBF', marginTop: '3px' }}>📞 {tenantObj.phone}</div>}
                                        {tenantObj.email && <div style={{ fontSize: '0.78rem', color: '#718EBF' }}>✉ {tenantObj.email}</div>}
                                        {(depositMonths > 0 || paidDeposit > 0) && (
                                            <>
                                                <div style={{ borderTop: '1px solid #E6EFF5', marginTop: '8px', paddingTop: '8px', fontSize: '11px', color: '#343C6A' }}>
                                                    <strong>Deposit:</strong> {depositMonthsPaid}/{depositMonths} paid
                                                </div>
                                                <div style={{ fontSize: '11px', color: outstandingBalance < 0 ? '#EF4444' : '#10B981' }}>
                                                    <strong>Outstanding Deposit:</strong> {outstandingBalance.toLocaleString()} {currency}
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
                                                            {pay.amount.toLocaleString()} {currency}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr style={{ borderBottom: '1px solid #E6EFF5' }}>
                                                <td style={{ padding: '0.8rem 1rem', fontWeight: '600', color: '#343C6A' }}>
                                                    {previewReceipt.types?.has('Rent') && previewReceipt.types?.has('Deposit') ? 'Monthly Rent & Security Deposit' : (previewReceipt.types?.has('Deposit') ? 'Security Deposit' : 'Monthly Rent')}
                                                </td>
                                                <td style={{ padding: '0.8rem 1rem', color: '#718EBF' }}>{monthsStr}</td>
                                                <td style={{ padding: '0.8rem 1rem', textAlign: 'right', fontWeight: '800', color: '#2D60FF' }}>
                                                    {(previewReceipt.totalAmount || previewReceipt.amount || 0).toLocaleString()} {currency}
                                                </td>
                                            </tr>
                                        )}
                                        {previewReceipt.note && (
                                            <tr>
                                                <td colSpan={3} style={{ padding: '0.5rem 1rem', color: '#718EBF', fontStyle: 'italic', fontSize: '0.78rem' }}>Note: {previewReceipt.note}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: '#F5F7FA' }}>
                                            <td colSpan={2} style={{ padding: '0.9rem 1rem', fontWeight: '800', fontSize: '0.95rem', color: '#343C6A' }}>TOTAL PAID</td>
                                            <td style={{ padding: '0.9rem 1rem', textAlign: 'right', fontWeight: '900', fontSize: '1.25rem', color: '#2D60FF' }}>
                                                {(previewReceipt.totalAmount || previewReceipt.amount || 0).toLocaleString()} {currency}
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
                                                <span style={{ fontSize: '0.6rem', color: '#718EBF', display: 'block', marginTop: '1px' }}>(Required: {reqDeposit.toLocaleString()} {currency})</span>
                                            </div>
                                            <div style={{ flex: 1, borderLeft: '1px solid #E6EFF5', paddingLeft: '1rem' }}>
                                                <span style={{ fontSize: '0.6rem', color: '#718EBF', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Deposit Held (Current)</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#2D60FF', display: 'block', marginTop: '2px' }}>
                                                    {paidDeposit.toLocaleString()} {currency}
                                                </span>
                                            </div>
                                            <div style={{ flex: 1, borderLeft: '1px solid #E6EFF5', paddingLeft: '1rem' }}>
                                                <span style={{ fontSize: '0.6rem', color: '#718EBF', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Outstanding Balance</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: outstandingBalance < 0 ? '#EF4444' : '#10B981', display: 'block', marginTop: '2px' }}>
                                                    {outstandingBalance.toLocaleString()} {currency}
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
                                <div style={{ borderTop: '1px dashed #E6EFF5', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', marginTop: '10px' }}>
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
                            <button className="btn btn-secondary" onClick={() => setPreviewReceipt(null)}>Close</button>
                            <button className="btn" style={{ backgroundColor: '#2D60FF', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                                onClick={() => printReceipt(previewReceipt)}>
                                <Printer size={16} /> Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            );
        })()}
      </div>
    </div>
  );
}

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const { token } = useAuth();
  const { activeTenantHistoryId } = useAppState();

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={token ? <Navigate to="/" replace /> : <Signup />} />
        <Route path="/forgot-password" element={token ? <Navigate to="/" replace /> : <ForgotPassword />} />
        <Route path="/reset-password" element={token ? <Navigate to="/" replace /> : <ResetPassword />} />
        <Route path="/pay/:token" element={<TenantPaymentSubmit />} />

        {/* Protected Landlord Layout & Routes */}
        <Route path="/*" element={
          token ? (
            <div className="app-container">
              <div 
                className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} 
                onClick={() => setSidebarOpen(false)} 
              />
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
              <main className="main-content">
                <Header onMenuClick={toggleSidebar} />
                <div className="container">
                  <Routes>
                    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/properties" element={<ProtectedRoute><Properties /></ProtectedRoute>} />
                    <Route path="/tenants" element={<ProtectedRoute><Tenants /></ProtectedRoute>} />
                    <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
                    <Route path="/submissions" element={<ProtectedRoute><Submissions /></ProtectedRoute>} />
                    <Route path="/utilities" element={<ProtectedRoute><Utilities /></ProtectedRoute>} />
                    <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </div>
              </main>
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        } />
      </Routes>
      {activeTenantHistoryId && <TenantHistoryModal />}
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <StateProvider>
        <AppContent />
      </StateProvider>
    </AuthProvider>
  );
}

export default App;
