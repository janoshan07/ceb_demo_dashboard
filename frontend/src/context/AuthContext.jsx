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
        throw new Error(data.message || 'Authentication failed. Please verify your credentials.');
      }

      setLoading(false);

      // Handle 2FA OTP requirement
      if (data.otpRequired) {
        return {
          otpRequired: true,
          otpSessionId: data.otpSessionId,
          maskedPhone: data.maskedPhone,
          expiresInSeconds: data.expiresInSeconds || 300,
          resendCooldownSeconds: data.resendCooldownSeconds || 60,
          message: data.message
        };
      }

      // Fallback in case direct token is returned
      const userDetails = {
        username: data.username,
        role: data.role,
        token: data.token
      };

      setUser(userDetails);
      sessionStorage.setItem('ceb_user', JSON.stringify(userDetails));
      return { success: true };
    } catch (err) {
      setError(err.message || 'Connection error. Make sure backend is running.');
      setLoading(false);
      return { error: err.message || 'Connection error. Make sure backend is running.' };
    }
  };

  const verifyOtp = async (otpSessionId, otp) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8080/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpSessionId, otp })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid or expired verification code');
      }

      const userDetails = {
        username: data.username,
        role: data.role,
        token: data.token
      };

      setUser(userDetails);
      sessionStorage.setItem('ceb_user', JSON.stringify(userDetails));
      setLoading(false);
      return { success: true, user: userDetails };
    } catch (err) {
      const msg = err.message || 'OTP verification failed';
      setError(msg);
      setLoading(false);
      return { error: msg };
    }
  };

  const resendOtp = async (otpSessionId) => {
    setError(null);
    try {
      const response = await fetch('http://localhost:8080/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpSessionId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to resend verification code');
      }

      return {
        success: true,
        otpSessionId: data.otpSessionId,
        maskedPhone: data.maskedPhone,
        expiresInSeconds: data.expiresInSeconds || 300,
        resendCooldownSeconds: data.resendCooldownSeconds || 60,
        message: data.message
      };
    } catch (err) {
      const msg = err.message || 'Failed to resend code';
      return { error: msg };
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
    <AuthContext.Provider value={{ user, login, verifyOtp, resendOtp, logout, authFetch, loading, error, setError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
