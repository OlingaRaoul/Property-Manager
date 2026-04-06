import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, CreditCard, Settings, Zap, FileText, X } from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-profile">
          <button className="close-sidebar-btn" onClick={onClose} style={{ top: '10px', right: '10px' }}>
            <X size={20} />
          </button>
          <div className="profile-avatar">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Bardia" alt="Profile" />
          </div>
          <div className="profile-info">
            <h3>Bardia Adibi</h3>
            <p>bardiaadibi@gmail.com</p>
          </div>
      </div>

      <nav className="nav-menu">
        <div className="nav-divider" />
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <LayoutDashboard size={20} />
          <span>Learn and earn</span>
        </NavLink>
        <NavLink to="/properties" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Building2 size={20} />
          <span>Properties</span>
        </NavLink>
        <NavLink to="/tenants" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Users size={20} />
          <span>Invite friends</span>
        </NavLink>
        <NavLink to="/payments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CreditCard size={20} />
                <span>Send a gift</span>
            </div>
            <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: '#FFBB38', borderRadius: '6px', color: 'black', fontWeight: 'bold' }}>$10</span>
          </div>
        </NavLink>
        <NavLink to="/utilities" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Zap size={20} />
          <span>Get wallet</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Settings size={20} />
          <span>Setting</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer" style={{ padding: '1.5rem' }}>
        <button className="btn-signout">Sign out</button>
      </div>
    </aside>
  );
};

export default Sidebar;
