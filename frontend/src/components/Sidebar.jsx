import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileSpreadsheet, 
  UploadCloud, 
  ShieldCheck, 
  CreditCard, 
  BarChart3, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight
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
      case 'ADMIN': return 'Administrator';
      case 'OFFICER': return 'Billing Officer';
      case 'USER': return 'Solar Customer';
      case 'VIEWER': return 'Viewer';
      default: return role;
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(prev => !prev);
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* 4. BRANDING */}
      <div className="sidebar-header">
        <div className="sidebar-brand-wrapper">
          <div className="sidebar-logo-box">
            <img src={edlLogo} alt="EDL Logo" className="sidebar-logo-img" />
          </div>
          {!isCollapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-title">
                EDL
                <span 
                  style={{ 
                    display: 'inline-block', 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%', 
                    backgroundColor: '#16A34A' 
                  }} 
                  title="Live Grid Connected" 
                />
              </span>
              <span className="sidebar-brand-subtitle">Smart Solar Dashboard</span>
            </div>
          )}
        </div>

        <button 
          className="sidebar-collapse-btn" 
          onClick={toggleCollapse}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* 3. SIDEBAR STRUCTURE & NAVIGATION ITEMS */}
      <div className="sidebar-content">
        {/* MAIN GROUP */}
        <div className="sidebar-group">
          <div className="sidebar-group-header">MAIN</div>
          {isCollapsed && <div className="sidebar-group-divider" />}

          <ul className="sidebar-menu">
            <li>
              <NavLink 
                to="/" 
                className={({ isActive }) => `sidebar-item-link ${isActive ? 'active' : ''}`}
                title="Dashboard"
              >
                <LayoutDashboard size={19} className="sidebar-icon" />
                <span>Dashboard</span>
                {location.pathname === '/' && <span className="active-green-dot" />}
              </NavLink>
            </li>

            {user.role !== 'USER' && (
              <>
                <li>
                  <NavLink 
                    to="/customers" 
                    className={({ isActive }) => `sidebar-item-link ${isActive ? 'active' : ''}`}
                    title="Customer Directory"
                  >
                    <Users size={19} className="sidebar-icon" />
                    <span>Customer Directory</span>
                    {location.pathname === '/customers' && <span className="active-green-dot" />}
                  </NavLink>
                </li>

                <li>
                  <NavLink 
                    to="/monthly-directory" 
                    className={({ isActive }) => `sidebar-item-link ${isActive ? 'active' : ''}`}
                    title="Monthly Billing"
                  >
                    <FileSpreadsheet size={19} className="sidebar-icon" />
                    <span>Monthly Billing</span>
                    {location.pathname === '/monthly-directory' && <span className="active-green-dot" />}
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </div>

        {/* OPERATIONS GROUP */}
        {user.role !== 'USER' && (
          <div className="sidebar-group">
            <div className="sidebar-group-header">OPERATIONS</div>
            {isCollapsed && <div className="sidebar-group-divider" />}

            <ul className="sidebar-menu">
              <li>
                <NavLink 
                  to="/upload" 
                  className={({ isActive }) => `sidebar-item-link ${isActive ? 'active' : ''}`}
                  title="File Upload"
                >
                  <UploadCloud size={19} className="sidebar-icon" />
                  <span>File Upload</span>
                  {location.pathname === '/upload' && <span className="active-green-dot" />}
                </NavLink>
              </li>

              {user.role === 'ADMIN' && (
                <li>
                  <NavLink 
                    to="/admin" 
                    className={({ isActive }) => `sidebar-item-link ${isActive ? 'active' : ''}`}
                    title="Import Approvals"
                  >
                    <ShieldCheck size={19} className="sidebar-icon" />
                    <span>Import Approvals</span>
                    {location.pathname === '/admin' && <span className="active-green-dot" />}
                  </NavLink>
                </li>
              )}

              <li>
                <NavLink 
                  to="/payments" 
                  className={({ isActive }) => `sidebar-item-link ${isActive ? 'active' : ''}`}
                  title="Payment Control Center"
                >
                  <CreditCard size={19} className="sidebar-icon" />
                  <span>Payment Control Center</span>
                  {location.pathname === '/payments' && <span className="active-green-dot" />}
                </NavLink>
              </li>
            </ul>
          </div>
        )}

        {/* ANALYTICS GROUP */}
        {user.role !== 'USER' && (
          <div className="sidebar-group">
            <div className="sidebar-group-header">ANALYTICS</div>
            {isCollapsed && <div className="sidebar-group-divider" />}

            <ul className="sidebar-menu">
              <li>
                <NavLink 
                  to="/reports" 
                  className={({ isActive }) => `sidebar-item-link ${isActive ? 'active' : ''}`}
                  title="Reports"
                >
                  <BarChart3 size={19} className="sidebar-icon" />
                  <span>Reports</span>
                  {location.pathname === '/reports' && <span className="active-green-dot" />}
                </NavLink>
              </li>
            </ul>
          </div>
        )}

        {/* SYSTEM GROUP */}
        {user.role === 'ADMIN' && (
          <div className="sidebar-group">
            <div className="sidebar-group-header">SYSTEM</div>
            {isCollapsed && <div className="sidebar-group-divider" />}

            <ul className="sidebar-menu">
              <li>
                <NavLink 
                  to="/admin" 
                  className={({ isActive }) => `sidebar-item-link ${location.pathname === '/admin' ? 'active' : ''}`}
                  title="Settings"
                >
                  <Settings size={19} className="sidebar-icon" />
                  <span>Settings</span>
                  {location.pathname === '/admin' && <span className="active-green-dot" />}
                </NavLink>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 10. USER PROFILE AREA */}
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
          <LogOut size={16} />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
