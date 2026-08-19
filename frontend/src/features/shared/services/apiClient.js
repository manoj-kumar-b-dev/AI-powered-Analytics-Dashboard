const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Refresh access token using cookie-stored refresh token.
 */
export async function refreshToken() {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem('token', data.accessToken);
        return data.accessToken;
      }
    }
  } catch (err) {
    console.error('Refresh Token Error:', err);
  }
  return null;
}

/**
 * Centralized fetch wrapper with auto Authorization header and 401 token refresh retry logic.
 */
export async function apiFetch(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;

  let res;
  try {
    res = await fetch(fullUrl, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (err) {
    console.error(`API Fetch Error [${fullUrl}]:`, err);
    throw err;
  }

  if (res.status === 401 && token) {
    const newToken = await refreshToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(fullUrl, {
        ...options,
        headers,
        credentials: 'include',
      });
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('activeOrgId');
    }
  }

  return res;
}
