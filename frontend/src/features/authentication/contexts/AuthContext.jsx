import React, { createContext, useState, useEffect, useContext } from 'react';
import { apiFetch, refreshToken } from '../../shared/services/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [organisations, setOrganisations] = useState([]);
  const [activeOrgId, setActiveOrgId] = useState(localStorage.getItem('activeOrgId') || null);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Helper: Request with Auth Header
  const apiRequest = async (url, options = {}) => {
    const res = await apiFetch(url, options);
    // Sync token state if apiFetch auto-refreshed it
    const updatedToken = localStorage.getItem('token');
    if (updatedToken && updatedToken !== token) {
      setToken(updatedToken);
    }
    // Only force logout if auth is truly gone (refresh also failed → still 401)
    if (res.status === 401) {
      // Check if we still have a valid token in storage (apiFetch may have refreshed it)
      const currentToken = localStorage.getItem('token');
      if (!currentToken) {
        handleLogoutState();
      }
    }
    return res;
  };

  const performRefresh = async () => {
    const refreshed = await refreshToken();
    if (refreshed) {
      setToken(refreshed);
    }
    return refreshed;
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
        const savedAvatar = localStorage.getItem('userAvatarUrl');
        const userData = {
          ...data.user,
          avatarUrl: data.user?.avatarUrl || savedAvatar || ''
        };
        setUser(userData);
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

  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const updated = prev ? { ...prev, ...updatedFields } : updatedFields;
      if (updatedFields.avatarUrl !== undefined) {
        if (updatedFields.avatarUrl) {
          localStorage.setItem('userAvatarUrl', updatedFields.avatarUrl);
        } else {
          localStorage.removeItem('userAvatarUrl');
        }
      }
      return updated;
    });
  };

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      let res;
      try {
        res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });
      } catch (networkErr) {
        throw new Error('Unable to connect to server. Please check your connection or backend status.');
      }

      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error(`Server returned invalid response (Status ${res.status}). Please try again later.`);
      }

      if (!res.ok) {
        const msg = data.error?.message || data.message || (res.status === 401 ? 'Invalid email or password' : 'Login failed');
        throw new Error(msg);
      }

      setToken(data.accessToken);
      localStorage.setItem('token', data.accessToken);
      await fetchProfile(data.accessToken);
      return { success: true, user: data.user };
    } catch (err) {
      throw err;
    }
  };

  const register = async (name, email, password) => {
    try {
      let res;
      try {
        res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, email, password }),
        });
      } catch (networkErr) {
        throw new Error('Unable to connect to server. Please check your connection or backend status.');
      }

      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error(`Server returned invalid response (Status ${res.status}). Please try again later.`);
      }

      if (!res.ok) {
        const msg = data.error?.message || data.message || (res.status === 400 ? 'Invalid registration information' : 'Registration failed');
        throw new Error(msg);
      }

      setToken(data.accessToken);
      localStorage.setItem('token', data.accessToken);
      await fetchProfile(data.accessToken);
      return { success: true, user: data.user };
    } catch (err) {
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

  const forgotPassword = async (email) => {
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error?.message || data.message || 'Failed to process request';
        throw new Error(msg);
      }

      return data;
    } catch (err) {
      console.error('Forgot Password API Error:', err);
      throw err;
    }
  };

  const resetPassword = async (token, newPassword) => {
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error?.message || data.message || 'Failed to reset password';
        throw new Error(msg);
      }

      return data;
    } catch (err) {
      console.error('Reset Password API Error:', err);
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
        forgotPassword,
        resetPassword,
        apiRequest,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
