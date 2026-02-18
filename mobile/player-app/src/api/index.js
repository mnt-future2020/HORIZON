import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://player-app-preview-1.preview.emergentagent.com/api';

const api = axios.create({ baseURL: BASE_URL });

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('horizon_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  updatePushToken: (token) => api.post('/auth/update-push-token', { push_token: token }),
};

export const venueAPI = {
  list: (params) => api.get('/venues', { params }),
  get: (id) => api.get(`/venues/${id}`),
  getSlots: (id, date) => api.get(`/venues/${id}/slots`, { params: { date } }),
  cities: () => api.get('/venues/cities'),
  areas: (city) => api.get('/venues/areas', { params: city ? { city } : {} }),
  amenities: () => api.get('/venues/amenities'),
  getReviews: (id) => api.get(`/venues/${id}/reviews`),
  getReviewSummary: (id) => api.get(`/venues/${id}/reviews/summary`),
  createReview: (id, data) => api.post(`/venues/${id}/reviews`, data),
  canReview: (id) => api.get(`/venues/${id}/reviews/can-review`),
};

export const bookingAPI = {
  create: (data) => api.post('/bookings', data),
  list: () => api.get('/bookings'),
  get: (id) => api.get(`/bookings/${id}`),
  cancel: (id) => api.post(`/bookings/${id}/cancel`),
  mockConfirm: (id) => api.post(`/bookings/${id}/mock-confirm`),
};

export const analyticsAPI = {
  player: () => api.get('/analytics/player'),
};

export const matchAPI = {
  list: (params) => api.get('/matchmaking', { params }),
  create: (data) => api.post('/matchmaking', data),
  join: (id) => api.post(`/matchmaking/${id}/join`),
  recommended: () => api.get('/matchmaking/recommended'),
  leaderboard: (params) => api.get('/leaderboard', { params }),
};

export const ratingAPI = {
  history: (userId, limit) => api.get(`/rating/history/${userId}`, { params: { limit } }),
};

export const uploadAPI = {
  image: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;
