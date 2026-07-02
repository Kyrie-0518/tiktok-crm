import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { navigate } from '../utils/navigation';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Request interceptor - attach JWT
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // 清除 store 状态
      useAuthStore.getState().logout();
      // 保存当前路径，登录后跳转回来
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        sessionStorage.setItem('redirect_after_login', currentPath);
      }
      // 跳转到登录页
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
