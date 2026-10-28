import axios from 'axios';

// ✅ Validate API URL environment variable
if (!process.env.REACT_APP_API_URL) {
  throw new Error('❌ REACT_APP_API_URL is not defined! Please set it in your environment variables before building.');
}
const API_BASE_URL = process.env.REACT_APP_API_URL;


// ✅ Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ Token getter — wired up by AuthContext so every request gets a fresh Clerk JWT
let _tokenGetter: (() => Promise<string | null>) | null = null;
export function setTokenGetter(fn: () => Promise<string | null>) {
  _tokenGetter = fn;
}

// ✅ Add token to requests from Clerk only (no token persistence in localStorage)
api.interceptors.request.use(
  async (config) => {
    let token: string | null = null;
    if (_tokenGetter) {
      try { token = await _tokenGetter(); } catch {}
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export async function fetchProtectedObjectUrl(path: string) {
  const response = await api.get(path, { responseType: 'blob' });
  const headerType = String(response.headers['content-type'] || '');
  if (headerType.includes('application/json')) {
    throw new Error('Could not open this file.');
  }
  const blob = new Blob([response.data], { type: headerType || 'application/octet-stream' });
  return URL.createObjectURL(blob);
}

export async function openProtectedFile(path: string) {
  const objectUrl = await fetchProtectedObjectUrl(path);
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}

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

  getMyMaterials: async (courseId: string) => {
    try {
      const response = await api.get(`/courses/${courseId}/my-materials`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching materials for course ${courseId}:`, error);
      throw error;
    }
  },

  openMaterial: (materialId: string) => openProtectedFile(`/materials/${materialId}`),

  getAdminMaterials: async (courseId: string) => {
    try {
      const response = await api.get(`/courses/${courseId}/admin-materials`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching admin materials for course ${courseId}:`, error);
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
  setUserRole: (userId: string, role: 'student' | 'admin' | 'institute') => Promise<any>;
  deleteUser: (userId: string) => Promise<any>;
  getReferrals: (params?: PaginationParams) => Promise<any>;
  getReferredUsers: (params?: PaginationParams) => Promise<any>;
  getMyReferralCode: () => Promise<any>;
  getUsers: (role?: string) => Promise<any>;
  promoteToInstitute: (userId: string, customReferralCode?: string) => Promise<any>;
  getInstitutes: () => Promise<any>;
  getUsersByReferralCode: (referralCode: string) => Promise<any>;
  getStudentReferralReward: () => Promise<any>;
  updateStudentReferralReward: (discountPercent: number) => Promise<any>;
  getReferralCenter: () => Promise<any>;
  getReferralUses: (userId: string) => Promise<any>;
  updateReferralSettings: (data: { studentPercent: number; institutePercent: number }) => Promise<any>;
  updateInstituteReferralCode: (id: string, referralCode: string) => Promise<any>;
  listCoupons: () => Promise<any>;
  saveCoupon: (data: Record<string, unknown>, id?: string) => Promise<any>;
  deleteCoupon: (id: string) => Promise<any>;
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

  setUserRole: async (userId: string, role: 'student' | 'admin' | 'institute') => {
    try {
      const response = await api.put(`/admin/email-users/${userId}/role`, { role });
      return response.data;
    } catch (error) {
      console.error('Error setting user role:', error);
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

  getMyReferralCode: async () => {
    try {
      const response = await api.get('/referrals/my-code');
      return response.data;
    } catch (error) {
      console.error('Get my referral code error:', error);
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

  getStudentReferralReward: async () => {
    const response = await api.get('/admin/student-referral-reward');
    return response.data;
  },

  updateStudentReferralReward: async (discountPercent: number) => {
    const response = await api.put('/admin/student-referral-reward', { discountPercent });
    return response.data;
  },

  getReferralCenter: async () => {
    const response = await api.get('/admin/referral-center');
    return response.data;
  },

  getReferralUses: async (userId: string) => {
    const response = await api.get(`/admin/referral-center/uses/${userId}`);
    return response.data;
  },

  updateReferralSettings: async (data: { studentPercent: number; institutePercent: number }) => {
    const response = await api.put('/admin/referral-center/settings', data);
    return response.data;
  },

  updateInstituteReferralCode: async (id: string, referralCode: string) => {
    const response = await api.put(`/admin/referral-center/institutes/${id}/code`, { referralCode });
    return response.data;
  },

  listCoupons: async () => {
    const response = await api.get('/admin/coupons');
    return response.data;
  },

  saveCoupon: async (data: Record<string, unknown>, id?: string) => {
    const response = id ? await api.put(`/admin/coupons/${id}`, data) : await api.post('/admin/coupons', data);
    return response.data;
  },

  deleteCoupon: async (id: string) => {
    const response = await api.delete(`/admin/coupons/${id}`);
    return response.data;
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

// =================== PAYMENTS API ===================
export const paymentsApi = {
  createOrder: async (data: {
    amount: number;
    purpose: string;
    courseSlug?: string;
    purposeId?: string;
    purposeModel?: string;
    referralCode?: string;
    couponCode?: string;
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

  cancelCheckout: async (razorpayOrderId: string) => {
    const response = await api.post('/payments/cancel', { razorpayOrderId });
    return response.data;
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

  getMyPayments: async (params: { status?: string; purpose?: string; page?: number; limit?: number } = {}) => {
    try {
      const response = await api.get('/payments/my', { params });
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

  setLeadConverted: async (leadId: string, converted: boolean) => {
    try {
      const response = await api.put(`/payments/leads/${leadId}/converted`, { converted });
      return response.data;
    } catch (error) {
      console.error('Error updating lead status:', error);
      throw error;
    }
  },

  deleteLead: async (leadId: string) => {
    try {
      const response = await api.delete(`/payments/leads/${leadId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting lead:', error);
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
};

// =================== POSTS API ===================
export const postsApi = {
  getPostsForCourse: async (courseId: string) => {
    try {
      const response = await api.get(`/posts/course/${courseId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw error;
    }
  },

  // Admin
  getAdminPosts: async (courseId?: string) => {
    try {
      const params = courseId ? { courseId } : {};
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
    courseId: string;
    tag?: string;
    isPinned?: boolean;
    isPublished?: boolean;
    coverImage?: string;
    attachments?: { label: string; url?: string; type?: string; publicId?: string; resourceType?: string }[];
    folders?: { name: string; attachments: { label: string; url?: string; type?: string; publicId?: string; resourceType?: string }[] }[];
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

  openAttachment: (postId: string, attachmentId: string) =>
    openProtectedFile(`/posts/${postId}/attachments/${attachmentId}`),
};

// =================== CUET PREDICTOR API ===================
export const cuetPredictorApi = {
  submit: async (data: {
    name: string;
    mobile: string;
    score: number;
    category: string;
    gender: string;
  }) => {
    const response = await api.post('/cuet-predictor/submit', data);
    return response.data;
  },

  searchColleges: async (params: { q?: string; category?: string; score?: number; gender?: string }) => {
    const response = await api.get('/cuet-predictor/colleges', { params });
    return response.data;
  },

  getAllSubmissions: async (page = 1, limit = 100) => {
    const response = await api.get(`/cuet-predictor/admin/all?page=${page}&limit=${limit}`);
    return response.data;
  },
};

// =================== QUESTION BANK API ===================
export const questionBanksApi = {
  list: async () => {
    const response = await api.get('/questions/banks');
    return response.data;
  },
  create: async (data: { title: string; description?: string }) => {
    const response = await api.post('/questions/banks', data);
    return response.data;
  },
  update: async (id: string, data: { title: string; description?: string }) => {
    const response = await api.put(`/questions/banks/${id}`, data);
    return response.data;
  },
  remove: async (id: string) => {
    const response = await api.delete(`/questions/banks/${id}`);
    return response.data;
  },
};

export const questionsApi = {
  downloadTemplate: async () => {
    const response = await api.get('/questions/template', { responseType: 'blob' });
    return response.data as Blob;
  },
  previewImport: async (file: File, bankId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bankId', bankId);
    const response = await api.post('/questions/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  approveImport: async (importId: string) => {
    const response = await api.post(`/questions/import/${importId}/approve`);
    return response.data;
  },
  downloadErrorReport: async (importId: string) => {
    const response = await api.get(`/questions/import/${importId}/errors`, { responseType: 'blob' });
    return response.data as Blob;
  },
  list: async (params: { bankId?: string; q?: string; page?: number; limit?: number }) => {
    const response = await api.get('/questions', { params });
    return response.data;
  },
  chapters: async () => {
    const response = await api.get('/questions/meta/chapters');
    return response.data;
  },
  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/questions', data);
    return response.data;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/questions/${id}`, data);
    return response.data;
  },
  remove: async (id: string) => {
    const response = await api.delete(`/questions/${id}`);
    return response.data;
  },
  bulkRemove: async (ids: string[]) => {
    const response = await api.delete('/questions/bulk', { data: { ids } });
    return response.data;
  },
};

// =================== MOCK TESTS API ===================
export const mockTestsApi = {
  list: async (params: { page?: number; status?: string; limit?: number } = {}) => {
    const response = await api.get('/mock-tests', { params });
    return response.data;
  },
  get: async (id: string) => {
    const response = await api.get(`/mock-tests/${id}`);
    return response.data;
  },
  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/mock-tests', data);
    return response.data;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const response = await api.put(`/mock-tests/${id}`, data);
    return response.data;
  },
  publish: async (id: string) => {
    const response = await api.post(`/mock-tests/${id}/publish`);
    return response.data;
  },
  unpublish: async (id: string) => {
    const response = await api.post(`/mock-tests/${id}/unpublish`);
    return response.data;
  },
  remove: async (id: string) => {
    const response = await api.delete(`/mock-tests/${id}`);
    return response.data;
  },
};

export const plansApi = {
  list: async () => {
    const response = await api.get('/plans');
    return response.data;
  },
  listPublic: async () => {
    const response = await api.get('/plans/public');
    return response.data;
  },
  create: async (data: { title: string; description: string; price: number; mockTestIds: string[]; courseIds: string[] }) => {
    const response = await api.post('/plans', data);
    return response.data;
  },
  update: async (id: string, data: { title: string; description: string; price: number; mockTestIds: string[]; courseIds: string[] }) => {
    const response = await api.put(`/plans/${id}`, data);
    return response.data;
  },
  publish: async (id: string) => {
    const response = await api.post(`/plans/${id}/publish`);
    return response.data;
  },
  unpublish: async (id: string) => {
    const response = await api.post(`/plans/${id}/unpublish`);
    return response.data;
  },
  remove: async (id: string) => {
    const response = await api.delete(`/plans/${id}`);
    return response.data;
  },
};

export const attemptsApi = {
  subjects: async () => {
    const response = await api.get('/attempts/subjects');
    return response.data;
  },
  catalog: async (params: { subject?: string; q?: string; page?: number; limit?: number } = {}) => {
    const response = await api.get('/attempts/catalog', { params });
    return response.data;
  },
  listTests: async () => {
    const response = await api.get('/attempts/tests');
    return response.data;
  },
  instructions: async (id: string) => {
    const response = await api.get(`/attempts/tests/${id}`);
    return response.data;
  },
  start: async (mockTestId: string) => {
    const response = await api.post('/attempts/start', { mockTestId });
    return response.data;
  },
  startPreview: async (mockTestId: string) => {
    const response = await api.post('/attempts/preview', { mockTestId });
    return response.data;
  },
  myAttempts: async (params: { page?: number; limit?: number; mockTestId?: string } = {}) => {
    const response = await api.get('/attempts/my', { params });
    return response.data;
  },
  get: async (id: string) => {
    const response = await api.get(`/attempts/${id}`);
    return response.data;
  },
  save: async (id: string, body: { order: number; selected: string | null; markedForReview: boolean }) => {
    const response = await api.put(`/attempts/${id}/response`, body);
    return response.data;
  },
  pause: async (id: string) => {
    const response = await api.post(`/attempts/${id}/pause`);
    return response.data;
  },
  submit: async (id: string, reason: 'manual' | 'left_screen' | 'timeout') => {
    const response = await api.post(`/attempts/${id}/submit`, { reason });
    return response.data;
  },
};

export const contactApi = {
  send: async (data: { name: string; email: string; phone?: string; message: string }) => {
    const response = await api.post('/contact', data);
    return response.data;
  },
  list: async (params: { page?: number; limit?: number; status?: string } = {}) => {
    const response = await api.get('/contact', { params });
    return response.data;
  },
  setStatus: async (id: string, status: 'new' | 'read' | 'resolved') => {
    const response = await api.put(`/contact/${id}/status`, { status });
    return response.data;
  },
  remove: async (id: string) => {
    const response = await api.delete(`/contact/${id}`);
    return response.data;
  },
};

export default api;
