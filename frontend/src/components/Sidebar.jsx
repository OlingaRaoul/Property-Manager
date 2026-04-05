import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, CreditCard, Settings, Zap, FileText } from 'lucide-react';

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="logo">
        <div style={{ width: '32px', height: '32px', flexShrink: 0, background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.1rem' }}>A</div>
        <span className="logo-text">Property Manager Admin</span>
      </div>

      <nav className="nav-menu">
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={22} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/properties" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Building2 size={22} />
          <span>Properties</span>
        </NavLink>
        <NavLink to="/tenants" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Users size={22} />
          <span>Tenants</span>
        </NavLink>
        <NavLink to="/payments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <CreditCard size={22} />
          <span>Payments</span>
        </NavLink>
        <NavLink to="/utilities" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Zap size={22} />
          <span>utilities</span>
        </NavLink>
        <NavLink to="/contracts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <FileText size={22} />
          <span>Contracts</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Settings size={22} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
