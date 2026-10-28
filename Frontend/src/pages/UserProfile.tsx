import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../context/AuthContext';
import SharedNavbar from '../components/SharedNavbar';
import { authApi, enrollmentsApi } from '../services/api';

const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUserProfile } = useAuth();
  
  // Check if this is a new user from the location state
  const isNewUser = location.state?.newUser === true;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referralError, setReferralError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEnrolled, setIsEnrolled] = useState(false);
  const COURSE_SLUG = 'du-campus-advantage';
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    referralCode: '',
    college: '',
    collegeYear: ''
  });

  useEffect(() => {
    // Populate form with user data
    if (user) {
      setFormData({
        fullName: user.fullName || user.name || '',
        phone: user.phone || '',
        email: user.email || '',
        referralCode: user.referralCode || '',
        college: user.college || '',
        collegeYear: user.collegeYear || ''
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    enrollmentsApi
      .checkEnrollment(COURSE_SLUG)
      .then((res) => setIsEnrolled(res.isEnrolled))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateReferralCode = async (code: string): Promise<boolean> => {
    if (!code) return true; // If no referral code is provided, it's valid (optional)
    
    try {
      const response = await authApi.validateReferral(code);
      return response.valid;
    } catch (err) {
      console.error('Error validating referral code:', err);
      setReferralError('Invalid referral code');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setReferralError('');
    setSuccess('');

    // Validate required fields
    if (!formData.fullName) {
      setError('Full name is required');
      setLoading(false);
      return;
    }

    try {
      // Validate referral code if provided and changed
      if (formData.referralCode && formData.referralCode !== user?.referralCode) {
        const isValidReferral = await validateReferralCode(formData.referralCode);
        if (!isValidReferral) {
          setLoading(false);
          return;
        }
      }

      // Update user profile
      await updateUserProfile({
        fullName: formData.fullName,
        email: formData.email,
        college: formData.college,
        collegeYear: formData.collegeYear,
        referralCode: formData.referralCode !== user?.referralCode ? formData.referralCode : undefined
      });

      // If this is a new user, redirect to home page after successful profile update
      if (isNewUser) {
        setSuccess('Profile updated successfully! Redirecting to home page...');
        // Redirect after a short delay to show the success message
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else {
        setSuccess('Profile updated successfully');
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Redirect to login if not authenticated
  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#fff9ed] font-['Inter',sans-serif]">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <SharedNavbar />
      <div className="flex flex-col items-center justify-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg w-full space-y-8 bg-white/40 backdrop-blur-sm p-8 rounded-2xl shadow-sm border border-neutral-100">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-black tracking-tight">Your Profile</h2>
            <div className="h-1 w-16 bg-gradient-to-r from-black to-neutral-700 mx-auto mt-2 rounded-full"></div>
            <p className="mt-4 text-center text-neutral-700">
              Update your personal information below
            </p>
          </div>

          {/* Active Plan Banner */}
          {isEnrolled && (
            <div className="mt-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-800">DU Campus Advantage</p>
                  <p className="text-xs text-amber-600">Plan active · Full access</p>
                </div>
              </div>
              <Link
                to="/student/dashboard"
                className="flex-shrink-0 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Go to Dashboard →
              </Link>
            </div>
          )}
          
          {/* New user notification */}
          {isNewUser && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-100 rounded-xl">
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-yellow-100 rounded-full p-1 mr-3">
                  <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-yellow-800">Please complete your profile</p>
                  <p className="mt-1 text-sm text-yellow-700">You need to add your full name before you can proceed to the home page.</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl relative flex items-center" role="alert">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"></path></svg>
              <span className="block">{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-5 py-4 rounded-xl relative flex items-center" role="alert">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
              <span className="block">{success}</span>
            </div>
          )}

          <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-black border-b border-neutral-200 pb-2 text-left">Personal Information</h3>
                {/* Full Name */}
                <div className="mb-4">
                  <label htmlFor="fullName" className="block text-sm font-medium text-neutral-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      className="appearance-none block w-full pl-10 pr-3 py-3.5 border border-neutral-200 rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-black focus:border-black sm:text-sm transition-all duration-200 hover:border-neutral-300"
                      placeholder="Your full name"
                      value={formData.fullName}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Phone Number - Read Only */}
                <div className="mb-4">
                  <label htmlFor="phone" className="block text-sm font-medium text-neutral-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                    </div>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      readOnly
                      className="appearance-none block w-full pl-10 pr-3 py-3.5 border border-neutral-200 rounded-xl bg-neutral-100 text-neutral-500 sm:text-sm"
                      value={formData.phone}
                    />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 text-left">Phone number cannot be changed</p>
                </div>
              </div>

              <div className="space-y-6 pt-4">
                <h3 className="text-lg font-semibold text-black border-b border-neutral-200 pb-2 text-left">Contact Details</h3>
                {/* Email */}
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                    Email <span className="text-neutral-500">(Optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className="appearance-none block w-full pl-10 pr-3 py-3.5 border border-neutral-200 rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-black focus:border-black sm:text-sm transition-all duration-200 hover:border-neutral-300"
                      placeholder="Your email address"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-4">
                <h3 className="text-lg font-semibold text-black border-b border-neutral-200 pb-2 text-left">Education & Referrals</h3>
                {/* Referral Code */}
                <div className="mb-4">
                  <label htmlFor="referralCode" className="block text-sm font-medium text-neutral-700 mb-2">
                    Referral Code <span className="text-neutral-500">(Optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      id="referralCode"
                      name="referralCode"
                      type="text"
                      className={`appearance-none block w-full pl-10 pr-3 py-3.5 border ${
                        referralError ? 'border-red-300' : 'border-neutral-200'
                      } rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-black focus:border-black sm:text-sm transition-all duration-200 ${
                        user?.referralCode ? 'bg-neutral-100' : ''
                      }`}
                      placeholder="Enter referral code"
                      value={formData.referralCode}
                      onChange={handleChange}
                      readOnly={!!user?.referralCode}
                    />
                  </div>
                  {referralError && (
                    <p className="mt-1 text-xs text-red-500 text-left">{referralError}</p>
                  )}
                  {user?.referralCode ? (
                    <p className="mt-1 text-xs text-neutral-500 text-left">Referral code can only be added once</p>
                  ) : (
                    <p className="mt-1 text-xs text-neutral-500 text-left">Enter a valid referral code from an institute</p>
                  )}
                </div>

                {/* College */}
                <div className="mb-4">
                  <label htmlFor="college" className="block text-sm font-medium text-neutral-700 mb-2">
                    College <span className="text-neutral-500">(Optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                      </svg>
                    </div>
                    <input
                      id="college"
                      name="college"
                      type="text"
                      className="appearance-none block w-full pl-10 pr-3 py-3.5 border border-neutral-200 rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-black focus:border-black sm:text-sm transition-all duration-200 hover:border-neutral-300"
                      placeholder="Your college name"
                      value={formData.college}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* College Year */}
                <div className="mb-4">
                  <label htmlFor="collegeYear" className="block text-sm font-medium text-neutral-700 mb-2">
                    College Year <span className="text-neutral-500">(Optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <select
                      id="collegeYear"
                      name="collegeYear"
                      className="appearance-none block w-full pl-10 pr-3 py-3.5 border border-neutral-200 rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-black focus:border-black sm:text-sm transition-all duration-200 hover:border-neutral-300"
                      value={formData.collegeYear}
                      onChange={handleChange}
                    >
                      <option value="">Select Year</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                      <option value="5">5th Year</option>
                      <option value="graduated">Graduated</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                className="w-full flex justify-center py-4 px-6 border border-transparent rounded-xl shadow-md text-base font-medium text-white bg-black hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-all duration-300 transform hover:-translate-y-0.5"
                disabled={loading}
              >
                {loading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  'Update Profile'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;