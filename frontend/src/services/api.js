import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor tự động gắn JWT Token vào Header nếu đã đăng nhập
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.url !== '/auth/login') {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Chỉ bóc response một lần và xử lý token bị từ chối.
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const currentToken = localStorage.getItem('token');
    const sentAuthorization = error.config?.headers?.Authorization;

    if (
      error.response?.status === 401 &&
      error.config?.url !== '/auth/login' &&
      currentToken &&
      sentAuthorization === `Bearer ${currentToken}`
    ) {
      localStorage.removeItem('token');

      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      const publicPaths = ['/login', '/register', '/portal', '/customer-portal'];

      if (!publicPaths.includes(path)) {
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  },
);

export default api;
