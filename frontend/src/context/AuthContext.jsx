import { createContext, useState, useContext, useCallback, useRef } from 'react';
import AdminPasswordDialog from '../components/AdminPasswordDialog';

const AuthContext = createContext(null);

const withJsonErrorBody = (response, message) => {
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'application/json');
  headers.delete('Content-Length');
  return new Response(JSON.stringify({ message }), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem('ceb_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [adminPasswordPrompt, setAdminPasswordPrompt] = useState(null);
  const adminPasswordResolver = useRef(null);
  const adminPasswordPromptQueue = useRef(Promise.resolve());

  const requestAdminPassword = useCallback((message = '') => {
    const prompt = adminPasswordPromptQueue.current.then(() => new Promise(resolve => {
      adminPasswordResolver.current = resolve;
      setAdminPasswordPrompt({ message });
    }));
    adminPasswordPromptQueue.current = prompt.then(() => undefined);
    return prompt;
  }, []);

  const resolveAdminPasswordPrompt = (password) => {
    const resolve = adminPasswordResolver.current;
    adminPasswordResolver.current = null;
    setAdminPasswordPrompt(null);
    resolve?.(password);
  };

  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    
    // Auto-setup database on first launch if users are empty
    try {
      await fetch('http://localhost:8080/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
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
      setError(err.message || 'Connection error. Make sure backend is running.');
      setLoading(false);
      return { error: err.message || 'Connection error. Make sure backend is running.' };
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

    const send = (adminPassword) => {
      const requestHeaders = { ...headers };
      if (adminPassword) requestHeaders['X-Admin-Password'] = adminPassword;
      return fetch(`http://localhost:8080${url}`, {
        ...options,
        headers: requestHeaders
      });
    };

    let response = await send();

    if (response.status === 401) {
      logout();
      throw new Error('Your session has expired. Please login again.');
    }

    if (user?.role === 'OFFICER' && response.status === 428) {
      let adminPassword = await requestAdminPassword();
      let cancelled = adminPassword === null;
      while (adminPassword !== null) {
        response = await send(adminPassword);
        adminPassword = null;

        if (response.status === 403) {
          const responseText = await response.clone().text();
          let responseData = null;
          if (responseText.trim()) {
            try {
              responseData = JSON.parse(responseText);
            } catch {
              responseData = null;
            }
          }

          if (responseData?.code === 'ADMIN_PASSWORD_INVALID' || !responseText.trim()) {
            adminPassword = await requestAdminPassword(
              responseData?.message || 'Admin password verification failed. Check the password and try again.'
            );
            cancelled = adminPassword === null;
          }
        }
      }

      if (cancelled) {
        return new Response(JSON.stringify({ code: 'ADMIN_PASSWORD_CANCELLED', message: 'Action cancelled.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (!response.ok && !response.bodyUsed) {
      const responseText = await response.clone().text();
      let isJson = false;
      if (responseText.trim()) {
        try {
          JSON.parse(responseText);
          isJson = true;
        } catch {
          isJson = false;
        }
      }

      if (!isJson) {
        return withJsonErrorBody(
          response,
          response.status === 403 && !responseText.trim()
            ? 'Access denied. The operation was not completed; verify the Admin password and your account permissions.'
            : `The request failed with status ${response.status}.`
        );
      }
    }

    return response;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, authFetch, loading, error, setError }}>
      {children}
      {adminPasswordPrompt && (
        <AdminPasswordDialog
          error={adminPasswordPrompt.message}
          onSubmit={resolveAdminPasswordPrompt}
          onCancel={() => resolveAdminPasswordPrompt(null)}
        />
      )}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
