import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';
const AUTH_URL = 'http://localhost:5000/auth';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

// Interceptor to attach Authorization header if token exists in localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401 Unauthorized errors & automatically rotate refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshResponse = await axios.post(
          `${AUTH_URL}/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data?.accessToken;
        if (newAccessToken) {
          localStorage.setItem('token', newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Session refresh failed:', refreshError);
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Upload a CSV, XLSX, or XLS file
 */
export async function uploadDatasetApi(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/datasets', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
}

/**
 * List all datasets uploaded by user
 */
export async function listDatasetsApi() {
  const response = await api.get('/datasets');
  return response.data;
}

/**
 * Fetch dataset metadata & 10 sample rows
 */
export async function getDatasetProfileApi(datasetId) {
  const response = await api.get(`/datasets/${datasetId}/profile`);
  return response.data;
}

/**
 * Send natural language question about a dataset
 */
export async function askQuestionApi(datasetId, question, history = []) {
  const response = await api.post(`/datasets/${datasetId}/ask`, { question, history });
  return response.data;
}
