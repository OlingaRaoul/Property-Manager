import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

import { X } from 'lucide-react';
import { formatMonth } from './utils';

function TenantHistoryModal() {
  const { activeTenantHistoryId, setActiveTenantHistoryId, state } = useAppState();
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
          <button className="btn-close" onClick={() => setActiveTenantHistoryId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#718EBF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </button>
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
                    </tr>
                  );
                })}
                {sortedGrouped.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {lang === 'fr' ? 'Aucun paiement enregistré pour ce locataire.' : 'No payments registered for this tenant.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
