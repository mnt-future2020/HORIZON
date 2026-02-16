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

export const slotLockAPI = {
  lock: (data) => api.post("/slots/lock", data),
  unlock: (data) => api.post("/slots/unlock", data),
  extendLock: (data) => api.post("/slots/extend-lock", data),
  myLocks: () => api.get("/slots/my-locks"),
  status: (params) => api.get("/slots/lock-status", { params }),
};

export const splitAPI = {
  getInfo: (token) => api.get(`/split/${token}`),
  pay: (token, data) => api.post(`/split/${token}/pay`, data),
  verifyPayment: (token, data) => api.post(`/split/${token}/verify-payment`, data),
};

export const matchAPI = {
  list: (params) => api.get("/matchmaking", { params }),
  create: (data) => api.post("/matchmaking", data),
  join: (id) => api.post(`/matchmaking/${id}/join`),
};

export const mercenaryAPI = {
  list: (params) => api.get("/mercenary", { params }),
  myPosts: () => api.get("/mercenary/my-posts"),
  create: (data) => api.post("/mercenary", data),
  apply: (id) => api.post(`/mercenary/${id}/apply`),
  accept: (postId, applicantId) => api.post(`/mercenary/${postId}/accept/${applicantId}`),
  reject: (postId, applicantId) => api.post(`/mercenary/${postId}/reject/${applicantId}`),
  pay: (id) => api.post(`/mercenary/${id}/pay`),
  verifyPayment: (id, data) => api.post(`/mercenary/${id}/verify-payment`, data),
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

export const notificationAPI = {
  subscribe: (data) => api.post("/notifications/subscribe", data),
  unsubscribe: (data) => api.delete("/notifications/subscribe", { data }),
  list: () => api.get("/notifications"),
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put("/notifications/read-all"),
  mySubscriptions: (params) => api.get("/notifications/subscriptions", { params }),
};

export const adminAPI = {
  dashboard: () => api.get("/admin/dashboard"),
  users: (params) => api.get("/admin/users", { params }),
  approveUser: (id) => api.put(`/admin/users/${id}/approve`),
  rejectUser: (id) => api.put(`/admin/users/${id}/reject`),
  suspendUser: (id) => api.put(`/admin/users/${id}/suspend`),
  activateUser: (id) => api.put(`/admin/users/${id}/activate`),
  setUserPlan: (id, data) => api.put(`/admin/users/${id}/set-plan`, data),
  venues: () => api.get("/admin/venues"),
  suspendVenue: (id) => api.put(`/admin/venues/${id}/suspend`),
  activateVenue: (id) => api.put(`/admin/venues/${id}/activate`),
  bookings: () => api.get("/admin/bookings"),
  getSettings: () => api.get("/admin/settings"),
  updateSettings: (data) => api.put("/admin/settings", data),
  changePassword: (data) => api.put("/admin/change-password", data),
};

export const paymentAPI = {
  gatewayInfo: () => api.get("/payment/gateway-info"),
  verifyPayment: (bookingId, data) => api.post(`/bookings/${bookingId}/verify-payment`, data),
};

export const subscriptionAPI = {
  myPlan: () => api.get("/subscription/my-plan"),
  upgrade: (data) => api.put("/subscription/upgrade", data),
};

export const seedAPI = {
  seed: () => api.post("/seed"),
};

export default api;
