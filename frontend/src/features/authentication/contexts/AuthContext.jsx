import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [organisations, setOrganisations] = useState([]);
  const [activeOrgId, setActiveOrgId] = useState(localStorage.getItem('activeOrgId') || null);
  const [loading, setLoading] = useState(true);

  const API_URL = 'http://localhost:5000';

  // Helper: Request with Auth Header
  const apiRequest = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${url}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (res.status === 401 && token) {
      // Try to refresh
      const refreshed = await performRefresh();
      if (refreshed) {
        // Retry once
        headers['Authorization'] = `Bearer ${refreshed}`;
        return fetch(`${API_URL}${url}`, {
          ...options,
          headers,
          credentials: 'include',
        });
      } else {
        handleLogoutState();
      }
    }

    return res;
  };

  const performRefresh = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.accessToken);
        localStorage.setItem('token', data.accessToken);
        return data.accessToken;
      }
    } catch (err) {
      console.error('Refresh Token Error:', err);
    }
    return null;
  };

  const handleLogoutState = () => {
    setUser(null);
    setToken(null);
    setOrganisations([]);
    setActiveOrgId(null);
    localStorage.removeItem('token');
    localStorage.removeItem('activeOrgId');
  };

  const fetchProfile = async (currentToken) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

      let res = await fetch(`${API_URL}/auth/me`, { headers, credentials: 'include' });

      if (res.status === 401 && currentToken) {
        const refreshed = await performRefresh();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${refreshed}`;
          res = await fetch(`${API_URL}/auth/me`, { headers, credentials: 'include' });
        }
      }

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setOrganisations(data.organisations || []);
        if (data.user?.orgId) {
          setActiveOrgId(data.user.orgId);
          localStorage.setItem('activeOrgId', data.user.orgId);
        }
      } else {
        handleLogoutState();
      }
    } catch (err) {
      console.error('Fetch Profile Error:', err);
      handleLogoutState();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      setToken(data.accessToken);
      localStorage.setItem('token', data.accessToken);
      await fetchProfile(data.accessToken);
      return true;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Registration failed');
      }

      setToken(data.accessToken);
      localStorage.setItem('token', data.accessToken);
      await fetchProfile(data.accessToken);
      return true;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      handleLogoutState();
    }
  };

  const switchOrg = async (orgId) => {
    try {
      const res = await apiRequest('/auth/switch-org', {
        method: 'PUT',
        body: JSON.stringify({ orgId }),
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.accessToken);
        localStorage.setItem('token', data.accessToken);
        setActiveOrgId(orgId);
        localStorage.setItem('activeOrgId', orgId);
        await fetchProfile(data.accessToken);
        return true;
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || 'Failed to switch organization');
      }
    } catch (err) {
      console.error('Switch Org Error:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        organisations,
        activeOrgId,
        loading,
        login,
        register,
        logout,
        switchOrg,
        apiRequest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
