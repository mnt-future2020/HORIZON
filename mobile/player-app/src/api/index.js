import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use backend URL from environment or fallback to localhost for dev
const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL
  ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`
  : 'http://localhost:8000/api';

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
  getBySlug: (slug) => api.get(`/venues/slug/${slug}`),
  create: (data) => api.post('/venues', data),
  update: (id, data) => api.put(`/venues/${id}`, data),
  getSlots: (id, date) => api.get(`/venues/${id}/slots`, { params: { date } }),
  getPricingRules: (id) => api.get(`/venues/${id}/pricing-rules`),
  createPricingRule: (id, data) => api.post(`/venues/${id}/pricing-rules`, data),
  updatePricingRule: (ruleId, data) => api.put(`/pricing-rules/${ruleId}`, data),
  togglePricingRule: (ruleId) => api.put(`/pricing-rules/${ruleId}/toggle`),
  deletePricingRule: (ruleId) => api.delete(`/pricing-rules/${ruleId}`),
  getOwnerVenues: () => api.get('/owner/venues'),
  cities: () => api.get('/venues/cities'),
  areas: (city) => api.get('/venues/areas', { params: city ? { city } : {} }),
  amenities: () => api.get('/venues/amenities'),
  nearby: (lat, lng, radius_km) => api.get('/venues/nearby', { params: { lat, lng, radius_km } }),
  nearbyByDriveTime: (lat, lng, radius_km) => api.get('/venues/nearby/drive-time', { params: { lat, lng, radius_km } }),
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
  testConfirm: (id) => api.post(`/bookings/${id}/test-confirm`),
};

export const slotLockAPI = {
  lock: (data) => api.post('/slots/lock', data),
  unlock: (data) => api.post('/slots/unlock', data),
  extendLock: (data) => api.post('/slots/extend-lock', data),
  myLocks: () => api.get('/slots/my-locks'),
  status: (params) => api.get('/slots/lock-status', { params }),
};

export const splitAPI = {
  getInfo: (token) => api.get(`/split/${token}`),
  pay: (token, data) => api.post(`/split/${token}/pay`, data),
  verifyPayment: (token, data) => api.post(`/split/${token}/verify-payment`, data),
  createLink: (bookingId) => api.post(`/bookings/${bookingId}/split`),
};

export const matchAPI = {
  list: (params) => api.get('/matchmaking', { params }),
  create: (data) => api.post('/matchmaking', data),
  join: (id) => api.post(`/matchmaking/${id}/join`),
  recommended: () => api.get('/matchmaking/recommended'),
  autoMatch: (data) => api.post('/matchmaking/auto-match', data),
  suggestTeams: (id) => api.get(`/matchmaking/${id}/suggest-teams`),
  submitResult: (id, data) => api.post(`/matchmaking/${id}/submit-result`, data),
  confirmResult: (id, data) => api.post(`/matchmaking/${id}/confirm-result`, data),
  leaderboard: (params) => api.get('/leaderboard', { params }),
};

export const ratingAPI = {
  history: (userId, limit) => api.get(`/rating/history/${userId}`, { params: { limit } }),
  verify: (userId) => api.get(`/rating/verify/${userId}`),
  certificate: (userId) => api.get(`/rating/certificate/${userId}`),
};

export const mercenaryAPI = {
  list: (params) => api.get('/mercenary', { params }),
  myPosts: () => api.get('/mercenary/my-posts'),
  create: (data) => api.post('/mercenary', data),
  apply: (id) => api.post(`/mercenary/${id}/apply`),
  accept: (postId, applicantId) => api.post(`/mercenary/${postId}/accept/${applicantId}`),
  reject: (postId, applicantId) => api.post(`/mercenary/${postId}/reject/${applicantId}`),
  pay: (id) => api.post(`/mercenary/${id}/pay`),
  verifyPayment: (id, data) => api.post(`/mercenary/${id}/verify-payment`, data),
};

export const academyAPI = {
  list: () => api.get('/academies'),
  create: (data) => api.post('/academies', data),
  get: (id) => api.get(`/academies/${id}`),
  addStudent: (id, data) => api.post(`/academies/${id}/students`, data),
  removeStudent: (academyId, studentId) => api.delete(`/academies/${academyId}/students/${studentId}`),
};

export const analyticsAPI = {
  venue: (id) => api.get(`/analytics/venue/${id}`),
  player: () => api.get('/analytics/player'),
};

export const notificationAPI = {
  subscribe: (data) => api.post('/notifications/subscribe', data),
  unsubscribe: (data) => api.delete('/notifications/subscribe', { data }),
  list: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  mySubscriptions: (params) => api.get('/notifications/subscriptions', { params }),
};

export const adminAPI = {
  dashboard: () => api.get('/admin/dashboard'),
  users: (params) => api.get('/admin/users', { params }),
  approveUser: (id) => api.put(`/admin/users/${id}/approve`),
  rejectUser: (id) => api.put(`/admin/users/${id}/reject`),
  suspendUser: (id) => api.put(`/admin/users/${id}/suspend`),
  activateUser: (id) => api.put(`/admin/users/${id}/activate`),
  setUserPlan: (id, data) => api.put(`/admin/users/${id}/set-plan`, data),
  venues: () => api.get('/admin/venues'),
  suspendVenue: (id) => api.put(`/admin/venues/${id}/suspend`),
  activateVenue: (id) => api.put(`/admin/venues/${id}/activate`),
  bookings: () => api.get('/admin/bookings'),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
  changePassword: (data) => api.put('/admin/change-password', data),
};

export const paymentAPI = {
  gatewayInfo: () => api.get('/payment/gateway-info'),
  verifyPayment: (bookingId, data) => api.post(`/bookings/${bookingId}/verify-payment`, data),
};

export const subscriptionAPI = {
  myPlan: () => api.get('/subscription/my-plan'),
  upgrade: (data) => api.put('/subscription/upgrade', data),
  reportPaymentFailure: (data) => api.post('/subscription/payment-failed', data),
  resolvePayment: () => api.post('/subscription/resolve-payment'),
  dunningStatus: () => api.get('/subscription/dunning-status'),
};

export const iotAPI = {
  listDevices: (venueId) => api.get('/iot/devices', { params: { venue_id: venueId } }),
  createDevice: (data) => api.post('/iot/devices', data),
  updateDevice: (id, data) => api.put(`/iot/devices/${id}`, data),
  deleteDevice: (id) => api.delete(`/iot/devices/${id}`),
  controlDevice: (id, data) => api.post(`/iot/devices/${id}/control`, data),
  listZones: (venueId) => api.get('/iot/zones', { params: { venue_id: venueId } }),
  createZone: (data) => api.post('/iot/zones', data),
  updateZone: (id, data) => api.put(`/iot/zones/${id}`, data),
  deleteZone: (id) => api.delete(`/iot/zones/${id}`),
  controlZone: (id, data) => api.post(`/iot/zones/${id}/control`, data),
  energy: (venueId, period) => api.get('/iot/energy', { params: { venue_id: venueId, period } }),
  schedules: (venueId, date) => api.get('/iot/schedules', { params: { venue_id: venueId, date } }),
  syncBookings: (venueId) => api.post('/iot/sync-bookings', null, { params: { venue_id: venueId } }),
  mqttStatus: () => api.get('/iot/mqtt-status'),
};

export const highlightAPI = {
  upload: (formData) => api.post('/highlights/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  list: () => api.get('/highlights'),
  get: (id) => api.get(`/highlights/${id}`),
  analyze: (id) => api.post(`/highlights/${id}/analyze`),
  share: (id) => api.post(`/highlights/${id}/share`),
  getShared: (shareId) => api.get(`/highlights/shared/${shareId}`),
  delete: (id) => api.delete(`/highlights/${id}`),
};

export const posAPI = {
  listProducts: (venueId) => api.get('/pos/products', { params: { venue_id: venueId } }),
  createProduct: (data) => api.post('/pos/products', data),
  updateProduct: (id, data) => api.put(`/pos/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/pos/products/${id}`),
  recordSale: (data) => api.post('/pos/sales', data),
  syncBatch: (venueId, batch) => api.post('/pos/sales', { venue_id: venueId, batch }),
  listSales: (venueId, limit) => api.get('/pos/sales', { params: { venue_id: venueId, limit } }),
  summary: (venueId) => api.get('/pos/summary', { params: { venue_id: venueId } }),
};

export const uploadAPI = {
  image: (formData) => api.post('/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  video: (formData) => api.post('/upload/video', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const seedAPI = {
  seed: () => api.post('/seed'),
};

export const contactAPI = {
  submit: (data) => api.post('/contact', data),
};

export const waitlistAPI = {
  join: (data) => api.post('/waitlist', data),
  leave: (entryId) => api.delete(`/waitlist/${entryId}`),
  myWaitlist: () => api.get('/waitlist'),
  slotInfo: (params) => api.get('/waitlist/slot', { params }),
};

export const complianceAPI = {
  getConsent: () => api.get('/compliance/consent'),
  updateConsent: (data) => api.put('/compliance/consent', data),
  exportData: () => api.get('/compliance/data-export'),
  requestErasure: (data) => api.post('/compliance/erasure-request', data),
  getAuditLog: (limit) => api.get('/compliance/audit-log', { params: { limit } }),
  getNotificationPrefs: () => api.get('/compliance/notification-preferences'),
  updateNotificationPrefs: (data) => api.put('/compliance/notification-preferences', data),
};

export const pricingMLAPI = {
  suggest: (params) => api.get('/pricing/ml-suggest', { params }),
  demandForecast: (venueId, date) => api.get('/pricing/demand-forecast', { params: { venue_id: venueId, date } }),
  trainModel: (venueId) => api.post(`/pricing/train-model?venue_id=${venueId}`),
  getMode: (venueId) => api.get('/pricing/pricing-mode', { params: { venue_id: venueId } }),
  setMode: (venueId, mode) => api.put(`/pricing/pricing-mode?venue_id=${venueId}&mode=${mode}`),
};

export const reviewSentimentAPI = {
  getSentiment: (venueId) => api.get(`/venues/${venueId}/reviews/sentiment`),
};

export const socialAPI = {
  getFeed: (page, tab) => api.get('/feed', { params: { page, tab } }),
  createPost: (data) => api.post('/feed', data),
  toggleLike: (postId) => api.post(`/feed/${postId}/like`),
  react: (postId, reaction) => api.post(`/feed/${postId}/react`, { reaction }),
  addComment: (postId, data) => api.post(`/feed/${postId}/comment`, data),
  getComments: (postId) => api.get(`/feed/${postId}/comments`),
  deletePost: (postId) => api.delete(`/feed/${postId}`),
  trending: () => api.get('/feed/trending'),
  toggleBookmark: (postId) => api.post(`/feed/${postId}/bookmark`),
  getBookmarks: (page) => api.get('/feed/bookmarks', { params: { page } }),
  getUserPosts: (userId, page) => api.get(`/feed/user/${userId}`, { params: { page } }),
  explore: (q, category, page) => api.get('/explore', { params: { q, category, page } }),
  syncContacts: (data) => api.post('/contacts/sync', data),
  getSyncedContacts: () => api.get('/contacts/synced'),
  getInviteLink: () => api.post('/contacts/invite'),
  getStories: () => api.get('/stories'),
  createStory: (data) => api.post('/stories', data),
  viewStory: (id) => api.post(`/stories/${id}/view`),
  reactStory: (id, reaction) => api.post(`/stories/${id}/react`, { reaction }),
  deleteStory: (id) => api.delete(`/stories/${id}`),
  toggleFollow: (userId) => api.post(`/follow/${userId}`),
  followStatus: (userId) => api.get(`/follow/status/${userId}`),
  getFollowers: (userId) => api.get(`/followers/${userId}`),
  getFollowing: (userId) => api.get(`/following/${userId}`),
  myEngagement: () => api.get('/engagement/me'),
  suggestedFollows: () => api.get('/engagement/suggested-follows'),
};

export const playerCardAPI = {
  getCard: (userId) => api.get(`/player-card/${userId}`),
  getMyCard: () => api.get('/player-card/me'),
};

export const tournamentAPI = {
  list: (params) => api.get('/tournaments', { params }),
  get: (id) => api.get(`/tournaments/${id}`),
  create: (data) => api.post('/tournaments', data),
  update: (id, data) => api.put(`/tournaments/${id}`, data),
  cancel: (id) => api.delete(`/tournaments/${id}`),
  register: (id) => api.post(`/tournaments/${id}/register`),
  verifyEntryPayment: (id, data) => api.post(`/tournaments/${id}/verify-entry-payment`, data),
  testConfirmEntry: (id) => api.post(`/tournaments/${id}/test-confirm-entry`),
  withdraw: (id) => api.delete(`/tournaments/${id}/register`),
  start: (id) => api.post(`/tournaments/${id}/start`),
  submitResult: (tournamentId, matchId, data) =>
    api.post(`/tournaments/${tournamentId}/matches/${matchId}/result`, data),
  standings: (id) => api.get(`/tournaments/${id}/standings`),
};

export const coachingAPI = {
  listCoaches: (params) => api.get('/coaching/coaches', { params }),
  getCoach: (id) => api.get(`/coaching/coaches/${id}`),
  updateProfile: (data) => api.put('/coaching/profile', data),
  getAvailability: () => api.get('/coaching/availability'),
  addAvailability: (data) => api.post('/coaching/availability', data),
  removeAvailability: (id) => api.delete(`/coaching/availability/${id}`),
  getCoachSlots: (coachId, date) => api.get(`/coaching/coaches/${coachId}/slots`, { params: { date } }),
  bookSession: (data) => api.post('/coaching/sessions/book', data),
  verifyPayment: (id, data) => api.post(`/coaching/sessions/${id}/verify-payment`, data),
  testConfirm: (id) => api.post(`/coaching/sessions/${id}/test-confirm`),
  listSessions: (params) => api.get('/coaching/sessions', { params }),
  cancelSession: (id) => api.post(`/coaching/sessions/${id}/cancel`),
  completeSession: (id) => api.post(`/coaching/sessions/${id}/complete`),
  reviewSession: (id, data) => api.post(`/coaching/sessions/${id}/review`, data),
  stats: () => api.get('/coaching/stats'),
  getCheckinQR: (bookingId) => api.get(`/coaching/checkin/qr/${bookingId}`),
  verifyCheckin: (data) => api.post('/coaching/checkin/verify', data),
  // Packages
  createPackage: (data) => api.post('/coaching/packages', data),
  listPackages: () => api.get('/coaching/packages'),
  updatePackage: (id, data) => api.put(`/coaching/packages/${id}`, data),
  deletePackage: (id) => api.delete(`/coaching/packages/${id}`),
  getCoachPackages: (coachId) => api.get(`/coaching/coaches/${coachId}/packages`),
  // Subscriptions
  subscribe: (packageId) => api.post(`/coaching/packages/${packageId}/subscribe`),
  verifySubPayment: (subId, data) => api.post(`/coaching/subscriptions/${subId}/verify-payment`, data),
  testConfirmSub: (subId) => api.post(`/coaching/subscriptions/${subId}/test-confirm`),
  mySubscriptions: () => api.get('/coaching/my-subscriptions'),
  cancelSubscription: (subId) => api.post(`/coaching/subscriptions/${subId}/cancel`),
  renewSubscription: (subId) => api.post(`/coaching/subscriptions/${subId}/renew`),
  verifyRenewal: (subId, data) => api.post(`/coaching/subscriptions/${subId}/verify-renewal`, data),
};

export const groupAPI = {
  list: (params) => api.get('/groups', { params }),
  myGroups: () => api.get('/groups/my'),
  get: (id) => api.get(`/groups/${id}`),
  create: (data) => api.post('/groups', data),
  update: (id, data) => api.put(`/groups/${id}`, data),
  join: (id) => api.post(`/groups/${id}/join`),
  leave: (id) => api.post(`/groups/${id}/leave`),
  remove: (id) => api.delete(`/groups/${id}`),
  getMessages: (id, before) => api.get(`/groups/${id}/messages`, { params: { before } }),
  sendMessage: (id, data) => api.post(`/groups/${id}/messages`, data),
};

export const teamAPI = {
  list: (params) => api.get('/teams', { params }),
  myTeams: () => api.get('/teams/my'),
  get: (id) => api.get(`/teams/${id}`),
  create: (data) => api.post('/teams', data),
  join: (id) => api.post(`/teams/${id}/join`),
  leave: (id) => api.post(`/teams/${id}/leave`),
  remove: (id) => api.delete(`/teams/${id}`),
};

export const chatAPI = {
  conversations: () => api.get('/chat/conversations'),
  startConversation: (userId) => api.post('/chat/conversations', { user_id: userId }),
  getMessages: (convoId, before) => api.get(`/chat/${convoId}/messages`, { params: { before } }),
  sendMessage: (convoId, data) => api.post(`/chat/${convoId}/messages`, data),
  deleteMessage: (convoId, msgId) => api.delete(`/chat/${convoId}/messages/${msgId}`),
  unreadTotal: () => api.get('/chat/unread-total'),
  heartbeat: () => api.post('/chat/online'),
  onlineStatus: (userId) => api.get(`/chat/online/${userId}`),
  setTyping: (convoId) => api.post(`/chat/${convoId}/typing`),
  getTyping: (convoId) => api.get(`/chat/${convoId}/typing`),
  reactToMessage: (convoId, msgId, emoji) => api.post(`/chat/${convoId}/messages/${msgId}/react`, { emoji }),
  searchMessages: (convoId, q, page) => api.get(`/chat/${convoId}/search`, { params: { q, page } }),
  uploadFile: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/chat/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const userSearchAPI = {
  search: (q) => api.get('/users/search', { params: { q } }),
};

export const recommendationAPI = {
  venues: (limit) => api.get('/recommendations/venues', { params: { limit } }),
  players: (limit) => api.get('/recommendations/players', { params: { limit } }),
  groups: (limit) => api.get('/recommendations/groups', { params: { limit } }),
  compatibility: (userId) => api.get(`/compatibility/${userId}`),
  engagementScore: () => api.get('/engagement/score'),
  userEngagement: (userId) => api.get(`/engagement/score/${userId}`),
  churnRisk: () => api.get('/engagement/churn-risk'),
};

export const organizationAPI = {
  create: (data) => api.post('/organizations', data),
  list: (params) => api.get('/organizations', { params }),
  my: () => api.get('/organizations/my'),
  get: (id) => api.get(`/organizations/${id}`),
  update: (id, data) => api.put(`/organizations/${id}`, data),
  addStaff: (id, data) => api.post(`/organizations/${id}/staff`, data),
  removeStaff: (id, userId) => api.delete(`/organizations/${id}/staff/${userId}`),
  addPlayer: (id, data) => api.post(`/organizations/${id}/players`, data),
  removePlayer: (id, userId) => api.delete(`/organizations/${id}/players/${userId}`),
  dashboard: (id) => api.get(`/organizations/${id}/dashboard`),
};

export const performanceAPI = {
  createRecord: (data) => api.post('/performance/records', data),
  createBulk: (data) => api.post('/performance/records/bulk', data),
  getPlayerRecords: (playerId, params) => api.get(`/performance/records/${playerId}`, { params }),
  getPlayerSummary: (playerId) => api.get(`/performance/records/${playerId}/summary`),
  myRecords: (params) => api.get('/performance/my-records', { params }),
  deleteRecord: (id) => api.delete(`/performance/records/${id}`),
};

export const trainingAPI = {
  log: (data) => api.post('/training/log', data),
  list: (params) => api.get('/training/logs', { params }),
  get: (id) => api.get(`/training/logs/${id}`),
  update: (id, data) => api.put(`/training/logs/${id}`, data),
  playerHistory: (playerId) => api.get(`/training/player/${playerId}`),
  stats: () => api.get('/training/stats'),
};

export const careerAPI = {
  getCareer: (playerId) => api.get(`/analytics/player/${playerId}/career`),
};

export const liveAPI = {
  start: (data) => api.post('/live/start', data),
  getActive: () => api.get('/live/active'),
  get: (id) => api.get(`/live/${id}`),
  updateScore: (id, data) => api.post(`/live/${id}/score`, data),
  addEvent: (id, data) => api.post(`/live/${id}/event`, data),
  changePeriod: (id, data) => api.post(`/live/${id}/period`, data),
  pause: (id) => api.post(`/live/${id}/pause`),
  end: (id) => api.post(`/live/${id}/end`),
};

export default api;
