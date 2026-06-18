import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem('ceb_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    
    // Auto-setup database on first launch if users are empty
    try {
      await fetch('http://localhost:8080/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      // Ignore network errors here; server will handle it
    }

    try {
      const response = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      const userDetails = {
        username: data.username,
        role: data.role,
        token: data.token
      };

      setUser(userDetails);
      sessionStorage.setItem('ceb_user', JSON.stringify(userDetails));
      setLoading(false);
      return true;
    } catch (err) {
      setError(err.message || 'Connection error. Make sure backend is running.');
      setLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('ceb_user');
  };

  const authFetch = async (url, options = {}) => {
    const token = user?.token;
    const headers = { ...options.headers };
    
    // Check if it's multipart upload (don't set application/json)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`http://localhost:8080${url}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      logout();
      throw new Error('Your session has expired. Please login again.');
    }

    return response;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, authFetch, loading, error, setError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
