import axios from 'axios';

// ✅ Validate API URL environment variable
if (!process.env.REACT_APP_API_URL) {
  throw new Error('❌ REACT_APP_API_URL is not defined! Please set it in your environment variables before building.');
}
const API_BASE_URL = process.env.REACT_APP_API_URL;


// ✅ Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ Token getter — wired up by AuthContext so every request gets a fresh Clerk JWT
let _tokenGetter: (() => Promise<string | null>) | null = null;
export function setTokenGetter(fn: () => Promise<string | null>) {
  _tokenGetter = fn;
}

// ✅ Add token to requests — tries fresh Clerk token first, falls back to localStorage
api.interceptors.request.use(
  async (config) => {
    let token: string | null = null;
    if (_tokenGetter) {
      try { token = await _tokenGetter(); } catch {}
    }
    if (!token) {
      token = localStorage.getItem('token');
    }
    if (token) {
      // Always keep localStorage in sync with the latest token
      localStorage.setItem('token', token);
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// =================== ACCOMMODATIONS API ===================
export const accommodationsApi = {
  getAll: async (filters = {}) => {
    try {
      // Request a high limit to get all accommodations
      const params = { ...filters, limit: 100 };
      const response = await api.get('/accommodations', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching accommodations:', error);
      throw error;
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/accommodations/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching accommodation ${id}:`, error);
      throw error;
    }
  },

  addReview: async (id: string, reviewData: any) => {
    try {
      const response = await api.post(`/accommodations/${id}/reviews`, reviewData);
      return response.data;
    } catch (error) {
      console.error('Error adding review:', error);
      throw error;
    }
  },
};

// =================== ALUMNI API ===================
export const alumniApi = {
  getAll: async (filters = {}) => {
    try {
      const response = await api.get('/alumni', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching alumni:', error);
      throw error;
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/alumni/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching alumni ${id}:`, error);
      throw error;
    }
  },
};

// =================== COURSES API ===================
export const coursesApi = {
  getAll: async (filters = {}) => {
    try {
      const params = { ...filters, limit: 100 };
      const response = await api.get('/courses', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching courses:', error);
      throw error;
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/courses/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching course ${id}:`, error);
      throw error;
    }
  },

  getByCategory: async (category: string) => {
    try {
      const response = await api.get(`/courses/category/${category}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching courses for category ${category}:`, error);
      throw error;
    }
  },

  addVideoLink: async (courseId: string, videoData: { title: string; videoUrl: string; description?: string }) => {
    try {
      const response = await api.post(`/courses/${courseId}/videos`, videoData);
      return response.data;
    } catch (error) {
      console.error(`Error adding video to course ${courseId}:`, error);
      throw error;
    }
  },

  addExternalLink: async (courseId: string, linkData: { title: string; externalUrl: string; description?: string }) => {
    try {
      const response = await api.post(`/courses/${courseId}/links`, linkData);
      return response.data;
    } catch (error) {
      console.error(`Error adding link to course ${courseId}:`, error);
      throw error;
    }
  },

  addNote: async (courseId: string, noteData: { title: string; noteContent: string; description?: string }) => {
    try {
      const response = await api.post(`/courses/${courseId}/notes`, noteData);
      return response.data;
    } catch (error) {
      console.error(`Error adding note to course ${courseId}:`, error);
      throw error;
    }
  },

  create: async (data: object) => {
    const response = await api.post('/courses', data);
    return response.data;
  },

  update: async (id: string, data: object) => {
    const response = await api.put(`/courses/${id}`, data);
    return response.data;
  },

  deleteCourse: async (id: string) => {
    const response = await api.delete(`/courses/${id}`);
    return response.data;
  },

  uploadMaterial: async (courseId: string, formData: FormData) => {
    const response = await api.post(`/courses/${courseId}/materials`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteMaterial: async (courseId: string, materialId: string) => {
    const response = await api.delete(`/courses/${courseId}/materials/${materialId}`);
    return response.data;
  },
};

// =================== AUTH API ===================
export interface AuthApi {
  syncUser: (userData: { clerkId: string; email: string; name: string; phone?: string }) => Promise<any>;
  getMe: () => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  register: (userData: {
    name: string;
    email: string;
    phone?: string;
    clerkId?: string;
    college?: string;
    course?: string;
    year?: string;
    referralCode?: string;
  }) => Promise<any>;
  verifyReferralCode: (referralCode: string) => Promise<any>;
  validateReferral: (referralCode: string) => Promise<any>;
  loginWithPhone: (phone: string, userData?: { name?: string }) => Promise<any>;
  updateProfile: (userId: string, profileData: any) => Promise<any>;
  completeProfile: (profileData: {
    uid: string;
    fullName: string;
    phone?: string;
    email?: string;
    referralCode?: string;
    college?: string;
    collegeYear?: string;
  }) => Promise<any>;
  getRegisteredUsers: () => Promise<any>;
  promoteToAdmin: (userId: string) => Promise<any>;
  deleteUser: (userId: string) => Promise<any>;
  getReferrals: (params?: PaginationParams) => Promise<any>;
  getReferredUsers: (params?: PaginationParams) => Promise<any>;
  getUsers: (role?: string) => Promise<any>;
  promoteToInstitute: (userId: string, customReferralCode?: string) => Promise<any>;
  getInstitutes: () => Promise<any>;
  getUsersByReferralCode: (referralCode: string) => Promise<any>;
  validateReferralCode: (referralCode: string) => Promise<any>;
  getServerHealth: () => Promise<any>;
  getApiStats: () => Promise<any>;
  getPaidUsers: () => Promise<any>;
}

// Interface for pagination parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
  phone?: string;
}

export const authApi: AuthApi = {
  syncUser: async (userData) => {
    try {
      const response = await api.post('/email-users/sync', userData);
      return response.data;
    } catch (error) {
      console.error('Sync user error:', error);
      throw error;
    }
  },

  getMe: async () => {
    try {
      const response = await api.get('/email-users/me');
      return response.data;
    } catch (error) {
      console.error('Get me error:', error);
      throw error;
    }
  },

  login: async (email: string, password: string) => {
    try {
      const response = await api.post('/users/login', { email, password });
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  register: async (userData) => {
    try {
      const response = await api.post('/users/register', userData);
      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  verifyReferralCode: async (referralCode: string) => {
    try {
      const response = await api.get(`/referrals/verify/${referralCode}`);
      return response.data;
    } catch (error) {
      console.error('Referral code verification error:', error);
      throw error;
    }
  },

  validateReferral: async (referralCode: string) => {
    try {
      const response = await api.get(`/validation/referral/${referralCode}`);
      return response.data;
    } catch (error) {
      console.error('Referral validation error:', error);
      throw error;
    }
  },

  loginWithPhone: async (phone: string, userData?: { name?: string }) => {
    try {
      const payload = userData?.name ? { phone, name: userData.name } : { phone };
      const response = await api.post('/users/login-phone', payload);
      return response.data;
    } catch (error) {
      console.error('Phone login error:', error);
      throw error;
    }
  },

  updateProfile: async (_userId: string, profileData: any) => {
    try {
      const response = await api.put('/email-users/profile', profileData);
      return response.data;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  },

  completeProfile: async (profileData) => {
    try {
      const response = await api.post('/email-users/complete-profile', profileData);
      return response.data;
    } catch (error) {
      console.error('Complete profile error:', error);
      throw error;
    }
  },

  getRegisteredUsers: async () => {
    try {
      const response = await api.get('/users/registered');
      return response.data;
    } catch (error) {
      console.error('Error fetching registered users:', error);
      throw error;
    }
  },

  promoteToAdmin: async (userId: string) => {
    try {
      const response = await api.put(`/admin/email-users/${userId}/promote-to-admin`, {});
      return response.data;
    } catch (error) {
      console.error('Error promoting user to admin:', error);
      throw error;
    }
  },

  deleteUser: async (userId: string) => {
    try {
      const response = await api.delete(`/admin/email-users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  getReferrals: async (params?: PaginationParams) => {
    try {
      const response = await api.get('/referrals', { params });
      return response.data;
    } catch (error) {
      console.error('Get referrals error:', error);
      throw error;
    }
  },

  getReferredUsers: async (params?: PaginationParams) => {
    try {
      const response = await api.get('/referrals/referred-users', { params });
      return response.data;
    } catch (error) {
      console.error('Get referred users error:', error);
      throw error;
    }
  },

  getUsers: async (role: string = '') => {
    try {
      const params = role ? { role } : {};
      const response = await api.get('/admin/email-users', { params });
      return response.data;
    } catch (error) {
      console.error('Get users error:', error);
      throw error;
    }
  },

  promoteToInstitute: async (userId: string, customReferralCode?: string) => {
    try {
      const response = await api.put(`/admin/users/${userId}/promote-to-institute`, { customReferralCode });
      return response.data;
    } catch (error) {
      console.error('Error promoting user to institute:', error);
      throw error;
    }
  },

  getInstitutes: async () => {
    try {
      const response = await api.get('/admin/institutes');
      return response.data;
    } catch (error) {
      console.error('Error fetching institutes:', error);
      throw error;
    }
  },

  validateReferralCode: async (referralCode: string) => {
    try {
      const response = await api.get(`/validation/referral-code/${referralCode}`);
      return response.data;
    } catch (error) {
      console.error('Error validating referral code:', error);
      throw error;
    }
  },

  getServerHealth: async () => {
    try {
      const response = await api.get('/server/health');
      return response.data;
    } catch (error) {
      console.error('Error getting server health:', error);
      throw error;
    }
  },

  getApiStats: async () => {
    try {
      const response = await api.get('/server/api-stats');
      return response.data;
    } catch (error) {
      console.error('Error getting API stats:', error);
      throw error;
    }
  },

  getUsersByReferralCode: async (referralCode: string) => {
    try {
      const response = await api.get(`/admin/users-by-referral/${referralCode}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching users by referral code:', error);
      throw error;
    }
  },

  getPaidUsers: async () => {
    try {
      const response = await api.get('/admin/paid-users');
      return response.data;
    } catch (error) {
      console.error('Error fetching paid users:', error);
      throw error;
    }
  },
};

// =================== VIDEOS API ===================
export const videosApi = {
  // Public
  getVideos: async (params: Record<string, string> = {}) => {
    try {
      const response = await api.get('/videos', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching videos:', error);
      throw error;
    }
  },

  getVideo: async (id: string) => {
    try {
      const response = await api.get(`/videos/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching video ${id}:`, error);
      throw error;
    }
  },

  // Admin
  getAdminVideos: async () => {
    try {
      const response = await api.get('/videos/admin/all');
      return response.data;
    } catch (error) {
      console.error('Error fetching admin videos:', error);
      throw error;
    }
  },

  getUploadUrl: async (maxDurationSeconds = 3600, name?: string) => {
    try {
      const response = await api.post('/videos/upload-url', { maxDurationSeconds, name });
      return response.data;
    } catch (error) {
      console.error('Error getting upload URL:', error);
      throw error;
    }
  },

  createVideo: async (data: {
    title: string;
    description: string;
    category: string;
    tags: string;
    cloudflareVideoId: string;
  }) => {
    try {
      const response = await api.post('/videos', data);
      return response.data;
    } catch (error) {
      console.error('Error creating video:', error);
      throw error;
    }
  },

  updateVideo: async (id: string, data: Record<string, any>) => {
    try {
      const response = await api.put(`/videos/${id}`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating video ${id}:`, error);
      throw error;
    }
  },

  deleteVideo: async (id: string) => {
    try {
      const response = await api.delete(`/videos/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting video ${id}:`, error);
      throw error;
    }
  },

  checkVideoStatus: async (id: string) => {
    try {
      const response = await api.get(`/videos/${id}/status`);
      return response.data;
    } catch (error) {
      console.error(`Error checking video status ${id}:`, error);
      throw error;
    }
  },

  checkVideoStatusByUid: async (uid: string) => {
    try {
      const response = await api.get(`/videos/status/${uid}`);
      return response.data;
    } catch (error) {
      console.error(`Error checking video status by uid ${uid}:`, error);
      throw error;
    }
  },
};

// =================== PAYMENTS API ===================
export const paymentsApi = {
  createOrder: async (data: {
    amount: number;
    purpose: string;
    courseSlug?: string;
    purposeId?: string;
    purposeModel?: string;
    referralCode?: string;
    notes?: Record<string, string>;
  }) => {
    try {
      const response = await api.post('/payments/create-order', data);
      return response.data;
    } catch (error) {
      console.error('Error creating payment order:', error);
      throw error;
    }
  },

  verifyPayment: async (data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => {
    try {
      const response = await api.post('/payments/verify', data);
      return response.data;
    } catch (error) {
      console.error('Error verifying payment:', error);
      throw error;
    }
  },

  getMyPayments: async () => {
    try {
      const response = await api.get('/payments/my');
      return response.data;
    } catch (error) {
      console.error('Error fetching my payments:', error);
      throw error;
    }
  },

  savePrePaymentLead: async (data: {
    name: string;
    phone: string;
    email?: string;
    city?: string;
    college?: string;
    courseId?: string;
    courseTitle?: string;
    referralCode?: string;
    source?: 'popup' | 'enrollment_form';
  }) => {
    try {
      const response = await api.post('/payments/save-lead', data);
      return response.data;
    } catch (error) {
      // Non-blocking — don't throw if lead saving fails
      console.warn('Could not save pre-payment lead:', error);
      return null;
    }
  },

  getAllLeads: async (page = 1, limit = 100) => {
    try {
      const response = await api.get(`/payments/leads?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }
  },
};

// =================== ENROLLMENTS API ===================
export const enrollmentsApi = {
  checkEnrollment: async (courseSlug: string) => {
    try {
      const response = await api.get(`/enrollments/check/${courseSlug}`);
      return response.data;
    } catch (error) {
      console.error('Error checking enrollment:', error);
      throw error;
    }
  },

  getMyEnrollments: async () => {
    try {
      const response = await api.get('/enrollments/my');
      return response.data;
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      throw error;
    }
  },
  savePrePaymentLead: async (data: {
    name: string;
    phone: string;
    email?: string;
    city?: string;
    college?: string;
    courseId?: string;
    courseTitle?: string;
    referralCode?: string;
    source?: 'popup' | 'enrollment_form';
  }) => {
    try {
      const response = await api.post('/payments/save-lead', data);
      return response.data;
    } catch (error) {
      // Non-critical — swallow silently
      console.warn('Could not save pre-payment lead:', error);
      return {};
    }
  },

  getAllLeads: async (params?: { page?: number; limit?: number }) => {
    try {
      const response = await api.get('/payments/leads', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }
  },};

// =================== POSTS API ===================
export const postsApi = {
  getPostsForCourse: async (courseSlug: string) => {
    try {
      const response = await api.get(`/posts/${courseSlug}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw error;
    }
  },

  // Admin
  getAdminPosts: async (courseSlug?: string) => {
    try {
      const params = courseSlug ? { courseSlug } : {};
      const response = await api.get('/posts/admin/all', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching admin posts:', error);
      throw error;
    }
  },

  createPost: async (data: {
    title: string;
    content: string;
    courseSlug?: string;
    tag?: string;
    isPinned?: boolean;
    isPublished?: boolean;
    coverImage?: string;
    attachments?: { label: string; url: string }[];
  }) => {
    try {
      const response = await api.post('/posts', data);
      return response.data;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  },

  updatePost: async (id: string, data: Record<string, any>) => {
    try {
      const response = await api.put(`/posts/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  },

  deletePost: async (id: string) => {
    try {
      const response = await api.delete(`/posts/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  },

  uploadAttachment: async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/posts/upload-attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      throw error;
    }
  },
};

export default api;
