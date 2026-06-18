import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileSpreadsheet, 
  TrendingUp, 
  ShieldAlert, 
  LogOut, 
  Zap 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();

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

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo-icon">
          <Zap size={20} fill="currentColor" />
        </div>
        <div className="sidebar-title">CEB Billing</div>
      </div>
      
      <nav style={{ flex: 1 }}>
        <ul className="sidebar-menu">
          <li>
            <NavLink 
              to="/" 
              className={({ isActive }) => `sidebar-item-link ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </NavLink>
          </li>
          
          {/* Officers and Admins only */}
          {user.role !== 'USER' && (
            <>
              <li>
                <NavLink 
                  to="/customers" 
                  className={({ isActive }) => `sidebar-item-link ${isActive ? 'active' : ''}`}
                >
                  <Users size={20} />
                  <span>Customers</span>
                </NavLink>
              </li>

              <li>
                <NavLink 
                  to="/reports" 
                  className={({ isActive }) => `sidebar-item-link ${isActive ? 'active' : ''}`}
                >
                  <TrendingUp size={20} />
                  <span>Reports</span>
                </NavLink>
              </li>
            </>
          )}

          {/* Billing Officer & Admin can Upload Excel */}
          {(user.role === 'ADMIN' || user.role === 'OFFICER') && (
            <li>
              <NavLink 
                to="/upload" 
                className={({ isActive }) => `sidebar-item-link ${isActive ? 'active' : ''}`}
              >
                <FileSpreadsheet size={20} />
                <span>Upload Billing</span>
              </NavLink>
            </li>
          )}

          {/* Admin only */}
          {user.role === 'ADMIN' && (
            <li>
              <NavLink 
                to="/admin" 
                className={({ isActive }) => `sidebar-item-link ${isActive ? 'active' : ''}`}
              >
                <ShieldAlert size={20} />
                <span>Admin Panel</span>
              </NavLink>
            </li>
          )}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-widget">
          <div className="user-avatar">
            {user.username.substring(0, 2).toUpperCase()}
          </div>
          <div className="user-info">
            <span className="user-name">{user.username}</span>
            <span className="user-role-badge">{getRoleLabel(user.role)}</span>
          </div>
        </div>
        <button className="btn-logout" onClick={logout}>
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
