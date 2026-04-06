import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, CreditCard, Settings, Zap, FileText, X } from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="logo" style={{ position: 'relative' }}>
          <div style={{ width: '32px', height: '32px', flexShrink: 0, background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.1rem' }}>A</div>
          <span className="logo-text">Property Manager Admin</span>
          
          <button className="close-sidebar-btn" onClick={onClose}>
            <X size={24} />
          </button>
      </div>

      <nav className="nav-menu">
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <LayoutDashboard size={22} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/properties" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Building2 size={22} />
          <span>Properties</span>
        </NavLink>
        <NavLink to="/tenants" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Users size={22} />
          <span>Tenants</span>
        </NavLink>
        <NavLink to="/payments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <CreditCard size={22} />
          <span>Payments</span>
        </NavLink>
        <NavLink to="/utilities" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Zap size={22} />
          <span>utilities</span>
        </NavLink>
        <NavLink to="/contracts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <FileText size={22} />
          <span>Contracts</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
          <Settings size={22} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
