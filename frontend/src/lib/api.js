import axios from "axios";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("horizon_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  getMe: () => api.get("/auth/me"),
  updateProfile: (data) => api.put("/auth/profile", data),
};

export const venueAPI = {
  list: (params) => api.get("/venues", { params }),
  get: (id) => api.get(`/venues/${id}`),
  create: (data) => api.post("/venues", data),
  update: (id, data) => api.put(`/venues/${id}`, data),
  getSlots: (id, date) => api.get(`/venues/${id}/slots`, { params: { date } }),
  getPricingRules: (id) => api.get(`/venues/${id}/pricing-rules`),
  createPricingRule: (id, data) => api.post(`/venues/${id}/pricing-rules`, data),
  getOwnerVenues: () => api.get("/owner/venues"),
};

export const bookingAPI = {
  create: (data) => api.post("/bookings", data),
  list: () => api.get("/bookings"),
  get: (id) => api.get(`/bookings/${id}`),
  cancel: (id) => api.post(`/bookings/${id}/cancel`),
};

export const splitAPI = {
  getInfo: (token) => api.get(`/split/${token}`),
  pay: (token, data) => api.post(`/split/${token}/pay`, data),
};

export const matchAPI = {
  list: (params) => api.get("/matchmaking", { params }),
  create: (data) => api.post("/matchmaking", data),
  join: (id) => api.post(`/matchmaking/${id}/join`),
};

export const mercenaryAPI = {
  list: (params) => api.get("/mercenary", { params }),
  create: (data) => api.post("/mercenary", data),
  apply: (id) => api.post(`/mercenary/${id}/apply`),
};

export const academyAPI = {
  list: () => api.get("/academies"),
  create: (data) => api.post("/academies", data),
  get: (id) => api.get(`/academies/${id}`),
  addStudent: (id, data) => api.post(`/academies/${id}/students`, data),
  removeStudent: (academyId, studentId) => api.delete(`/academies/${academyId}/students/${studentId}`),
};

export const analyticsAPI = {
  venue: (id) => api.get(`/analytics/venue/${id}`),
  player: () => api.get("/analytics/player"),
};

export const seedAPI = {
  seed: () => api.post("/seed"),
};

export default api;
