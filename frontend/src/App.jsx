import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StateProvider } from './context/StateContext';
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

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const { token } = useAuth();

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
