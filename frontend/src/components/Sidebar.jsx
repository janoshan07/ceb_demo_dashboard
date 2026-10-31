import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileSpreadsheet, 
  ShieldCheck, 
  CreditCard, 
  BarChart3, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Upload
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import edlLogo from '../assets/edl_logo.jpg';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  if (!user) return null;

  const getRoleLabel = (role) => {
    switch(role) {
      case 'ADMIN':   return 'Administrator';
      case 'OFFICER': return 'Billing Officer';
      case 'USER':    return 'Solar Customer';
      case 'VIEWER':  return 'Viewer';
      default:        return role;
    }
  };

  const toggleCollapse = () => setIsCollapsed(prev => !prev);

  /* ─── Nav Item Component ─── */
  const NavItem = ({ to, icon: Icon, label, exact }) => {
    const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);
    return (
      <li>
        <NavLink
          to={to}
          className={() => `sidebar-item-link ${isActive ? 'active' : ''}`}
          title={label}
          end={exact}
        >
          <Icon size={17} className="sidebar-icon" />
          {!isCollapsed && <span>{label}</span>}
          {!isCollapsed && isActive && <span className="active-green-dot" />}
        </NavLink>
      </li>
    );
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>

      {/* ── Branding Header ── */}
      <div className="sidebar-header">
        <div className="sidebar-brand-wrapper">
          <div className="sidebar-logo-box">
            <img src={edlLogo} alt="EDL Logo" className="sidebar-logo-img" />
          </div>
          {!isCollapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-title">EDL</span>
              <span className="sidebar-brand-subtitle">Smart Solar Dashboard</span>
            </div>
          )}
        </div>

        <button
          className="sidebar-collapse-btn"
          onClick={toggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* ── Navigation ── */}
      <div className="sidebar-content">

        {/* GENERAL */}
        <div className="sidebar-group">
          {!isCollapsed && <div className="sidebar-group-header">General</div>}
          {isCollapsed && <div className="sidebar-group-divider" />}
          <ul className="sidebar-menu">
            <NavItem to="/" icon={LayoutDashboard} label="Dashboard" exact />

            {user.role !== 'USER' && (
              <>
                <NavItem to="/customers" icon={Users} label="Customer Directory" />
                <NavItem to="/monthly-directory" icon={FileSpreadsheet} label="Monthly Billing" />
              </>
            )}
          </ul>
        </div>

        {/* OPERATIONS */}
        {user.role !== 'USER' && (
          <div className="sidebar-group">
            {!isCollapsed && <div className="sidebar-group-header">Operations</div>}
            {isCollapsed && <div className="sidebar-group-divider" />}
            <ul className="sidebar-menu">
              {user.role === 'ADMIN' && (
                <NavItem to="/admin" icon={ShieldCheck} label="Import Approvals" />
              )}
              <NavItem to="/payments" icon={CreditCard} label="Payment Control" />
              {user.role !== 'USER' && (
                <NavItem to="/upload" icon={Upload} label="Upload Data" />
              )}
            </ul>
          </div>
        )}

        {/* ANALYTICS */}
        {user.role !== 'USER' && (
          <div className="sidebar-group">
            {!isCollapsed && <div className="sidebar-group-header">Analytics</div>}
            {isCollapsed && <div className="sidebar-group-divider" />}
            <ul className="sidebar-menu">
              <NavItem to="/reports" icon={BarChart3} label="Reports" />
            </ul>
          </div>
        )}

        {/* SYSTEM (admin only) */}
        {user.role === 'ADMIN' && (
          <div className="sidebar-group">
            {!isCollapsed && <div className="sidebar-group-header">System</div>}
            {isCollapsed && <div className="sidebar-group-divider" />}
            <ul className="sidebar-menu">
              <NavItem to="/admin" icon={Settings} label="Settings" />
            </ul>
          </div>
        )}
      </div>

      {/* ── User Profile & Logout ── */}
      <div className="sidebar-footer">
        <div className="user-profile-widget" title={`${user.username} (${getRoleLabel(user.role)})`}>
          <div className="user-avatar">
            {user.username.substring(0, 2).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="user-info">
              <span className="user-name">{user.username}</span>
              <span className="user-role-badge">{getRoleLabel(user.role)}</span>
            </div>
          )}
        </div>

        <button className="btn-logout" onClick={logout} title="Logout">
          <LogOut size={15} />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
