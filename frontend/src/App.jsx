import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages & Components
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CustomerDetails from './pages/CustomerDetails';
import Reports from './pages/Reports';
import UploadPage from './pages/UploadPage';
import Admin from './pages/Admin';

const ProtectedLayout = ({ children }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

const RoleGuard = ({ allowedRoles, children }) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const App = () => {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/login" 
          element={user ? <Navigate to="/" replace /> : <Login />} 
        />

        {/* Private Protected Routes */}
        <Route 
          path="/" 
          element={
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          } 
        />
        <Route 
          path="/customers" 
          element={
            <ProtectedLayout>
              <RoleGuard allowedRoles={['ADMIN', 'OFFICER']}>
                <CustomerDetails />
              </RoleGuard>
            </ProtectedLayout>
          } 
        />
        <Route 
          path="/reports" 
          element={
            <ProtectedLayout>
              <RoleGuard allowedRoles={['ADMIN', 'OFFICER']}>
                <Reports />
              </RoleGuard>
            </ProtectedLayout>
          } 
        />
        
        {/* Billing Officer & Admin Only */}
        <Route 
          path="/upload" 
          element={
            <ProtectedLayout>
              <RoleGuard allowedRoles={['ADMIN', 'OFFICER']}>
                <UploadPage />
              </RoleGuard>
            </ProtectedLayout>
          } 
        />

        {/* Admin Only */}
        <Route 
          path="/admin" 
          element={
            <ProtectedLayout>
              <RoleGuard allowedRoles={['ADMIN']}>
                <Admin />
              </RoleGuard>
            </ProtectedLayout>
          } 
        />

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
