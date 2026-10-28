import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../context/AuthContext';
import SharedNavbar from '../components/SharedNavbar';
import { authApi } from '../services/api';

const ProfilePage: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referralError, setReferralError] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    referralCode: '',
    college: '',
    collegeYear: ''
  });
  
  // State for referral code validation
  const [referralStatus, setReferralStatus] = useState({
    isValidating: false,
    isValid: false,
    referrerName: '',
    referrerCollege: ''
  });
  
  // Split phone number into country code and number
  const [countryCode, setCountryCode] = useState('+91');

  useEffect(() => {
    // Auto-fill user data from auth if available
    let phoneNumber = '';
    let name = '';
    
    if (user) {
      // Get phone number
      phoneNumber = user.phone || '';
      
      // Get name if available
      name = user.fullName || user.name || '';
    } else {
      phoneNumber = (location.state as any)?.verifiedPhone || localStorage.getItem('verifiedPhone') || '';
    }
    
    // Extract country code if present
    if (phoneNumber.startsWith('+')) {
      // Find the first digit after the + sign
      const countryCodeEndIndex = phoneNumber.startsWith('+91') ? 3 : 
                                phoneNumber.startsWith('+1') ? 2 : 3;
      
      setCountryCode(phoneNumber.substring(0, countryCodeEndIndex));
      setFormData(prev => ({
        ...prev,
        phone: phoneNumber.substring(countryCodeEndIndex),
        fullName: name
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        phone: phoneNumber,
        fullName: name
      }));
    }
  }, [user, location.state]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear referral error when user changes the referral code
    if (name === 'referralCode') {
      setReferralError('');
      
      // Reset validation status if field is cleared
      if (!value) {
        setReferralStatus({
          isValidating: false,
          isValid: false,
          referrerName: '',
          referrerCollege: ''
        });
        return;
      }
      
      // Debounce validation to avoid too many API calls
      const timeoutId = setTimeout(() => {
        validateReferralCodeLive(value);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  };
  
  // Function to validate referral code as user types
  const validateReferralCodeLive = async (code: string) => {
    if (!code || code.trim() === '') return;
    
    setReferralStatus(prev => ({ ...prev, isValidating: true }));
    
    try {
      const response = await authApi.validateReferral(code);
      
      if (response.valid || (response.data && response.data.valid)) {
        const referrerData = response.referrer || (response.data && response.data.referrer) || {};
        setReferralStatus({
          isValidating: false,
          isValid: true,
          referrerName: referrerData.name || '',
          referrerCollege: referrerData.college || ''
        });
        setReferralError('');
      } else {
        setReferralStatus({
          isValidating: false,
          isValid: false,
          referrerName: '',
          referrerCollege: ''
        });
        setReferralError('Invalid referral code');
      }
    } catch (err) {
      console.error('Error validating referral code:', err);
      setReferralStatus({
        isValidating: false,
        isValid: false,
        referrerName: '',
        referrerCollege: ''
      });
      setReferralError('Error validating referral code');
    }
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

    // Validate required fields
    if (!formData.fullName || formData.fullName.trim() === '') {
      setError('Full name is required');
      setLoading(false);
      return;
    }
    
    // Validate college field (now required)
    if (!formData.college || formData.college.trim() === '') {
      setError('College is required');
      setLoading(false);
      return;
    }
    
    // Validate email format if provided
    if (formData.email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(formData.email)) {
      setError('Please provide a valid email address');
      setLoading(false);
      return;
    }

    try {
      // Validate referral code if provided
      if (formData.referralCode) {
        const isValidReferral = await validateReferralCode(formData.referralCode);
        if (!isValidReferral) {
          setLoading(false);
          return;
        }
      }

      // Extract only the 10-digit phone number without country code
      // This is important because the backend expects exactly 10 digits
      const phoneDigitsOnly = formData.phone.replace(/\D/g, '');
      const last10Digits = phoneDigitsOnly.slice(-10);

      // Save user profile data to MongoDB
      const response = await authApi.completeProfile({
        uid: user?._id || '',
        fullName: formData.fullName,
        phone: last10Digits, // Send only the 10-digit phone number
        email: formData.email,
        referralCode: formData.referralCode,
        college: formData.college,
        collegeYear: formData.collegeYear
      });

      // Update local user profile state
      updateUserProfile(response.data.data);
      // Refresh the page to ensure context is reset
      window.location.href = '/';
    } catch (err: any) {
      console.error('Error completing profile:', err);
      setError(err.response?.data?.message || 'Failed to complete profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fff9ed] flex flex-col">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <SharedNavbar />
      <div className="flex-grow flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg space-y-8 border border-[#ffe8b5]">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Your Profile</h2>
            <div className="w-16 h-1 mx-auto my-3 bg-[#ffe8b5] rounded"></div>
            <p className="mt-2 text-center text-sm text-gray-600">
              Update your profile information to enhance your experience
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 shadow-sm">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-red-100 rounded-full p-2 mr-3">
                  <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Phone Number (auto-filled) */}
              <div className="mb-4">
                <label htmlFor="phone" className="block text-sm font-medium text-neutral-dark mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="appearance-none block w-full pl-10 pr-3 py-3.5 border border-gray-300 rounded-xl placeholder-gray-400 bg-gray-100 cursor-not-allowed focus:outline-none sm:text-sm transition-all duration-200"
                    value={`${countryCode} ${formData.phone}`}
                    readOnly
                    disabled
                  />
                </div>
              </div>

              {/* Full Name - Required */}
              <div className="mb-4">
                <label htmlFor="fullName" className="block text-sm font-medium text-neutral-dark mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    className="appearance-none block w-full pl-10 pr-3 py-3.5 border border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-[#ffe8b5] focus:border-[#ffe8b5] sm:text-sm transition-all duration-200"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Email - Optional */}
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-neutral-dark mb-1">
                  Email <span className="text-gray-500">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="appearance-none block w-full pl-10 pr-3 py-3.5 border border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-[#ffe8b5] focus:border-[#ffe8b5] sm:text-sm transition-all duration-200"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Referral Code - Optional */}
              <div className="mb-4">
                <label htmlFor="referralCode" className="block text-sm font-medium text-neutral-dark mb-1">
                  Referral Code <span className="text-gray-500">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    id="referralCode"
                    name="referralCode"
                    type="text"
                    className={`appearance-none block w-full pl-10 pr-3 py-3.5 border ${referralStatus.isValid ? 'border-green-500' : referralError ? 'border-red-500' : 'border-[#ffd7be]'} rounded-xl placeholder-gray-400 focus:outline-none focus:ring-[#ffd7be] focus:border-[#ffd7be] sm:text-sm transition-all duration-200`}
                    placeholder="Enter referral code if you have one"
                    value={formData.referralCode}
                    onChange={handleChange}
                  />
                  {referralStatus.isValidating && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                </div>
                {referralError && (
                  <p className="mt-1 text-sm text-red-600">{referralError}</p>
                )}
                {referralStatus.isValid && (
                  <div className="mt-1 text-sm text-green-600 flex items-center">
                    <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Valid code from {referralStatus.referrerName}
                    {referralStatus.referrerCollege && ` (${referralStatus.referrerCollege})`}
                  </div>
                )}
              </div>

              {/* College - Required */}
              <div className="mb-4">
                <label htmlFor="college" className="block text-sm font-medium text-neutral-dark mb-1">
                  College <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <select
                    id="college"
                    name="college"
                    required
                    className="appearance-none block w-full pl-10 pr-3 py-3.5 border border-[#ffd7be] rounded-xl placeholder-gray-400 focus:outline-none focus:ring-[#ffd7be] focus:border-[#ffd7be] sm:text-sm transition-all duration-200"
                    value={formData.college}
                    onChange={handleChange}
                  >
                    <option value="">Select your college</option>
                    <option value="Hindu College">Hindu College</option>
                    <option value="Hansraj College">Hansraj College</option>
                    <option value="Miranda House">Miranda House</option>
                    <option value="Kirori Mal College">Kirori Mal College</option>
                    <option value="Ramjas College">Ramjas College</option>
                    <option value="Daulat Ram College">Daulat Ram College</option>
                    <option value="St. Stephen's College">St. Stephen's College</option>
                    <option value="Sri Ram College of Commerce (SRCC)">Sri Ram College of Commerce (SRCC)</option>
                    <option value="Indraprastha College for Women">Indraprastha College for Women</option>
                    <option value="SGTB Khalsa College">SGTB Khalsa College</option>
                    <option value="Swami Shraddhanand College">Swami Shraddhanand College</option>
                    <option value="Shaheed Sukhdev College of Business Studies">Shaheed Sukhdev College of Business Studies</option>
                    <option value="Aditi Mahavidyalaya">Aditi Mahavidyalaya</option>
                    <option value="Lady Shri Ram College for Women (LSR)">Lady Shri Ram College for Women (LSR)</option>
                    <option value="Sri Venkateswara College">Sri Venkateswara College</option>
                    <option value="Gargi College">Gargi College</option>
                    <option value="Kamala Nehru College">Kamala Nehru College</option>
                    <option value="Jesus and Mary College">Jesus and Mary College</option>
                    <option value="Atma Ram Sanatan Dharma College (ARSD)">Atma Ram Sanatan Dharma College (ARSD)</option>
                    <option value="Delhi College of Arts & Commerce (DCAC)">Delhi College of Arts & Commerce (DCAC)</option>
                    <option value="Maitreyi College">Maitreyi College</option>
                    <option value="Deshbandhu College">Deshbandhu College</option>
                    <option value="Motilal Nehru College">Motilal Nehru College</option>
                    <option value="Ram Lal Anand College">Ram Lal Anand College</option>
                    <option value="Aryabhatta College">Aryabhatta College</option>
                    <option value="Shaheed Bhagat Singh College">Shaheed Bhagat Singh College</option>
                    <option value="Institute of Home Economics">Institute of Home Economics</option>
                    <option value="College of Vocational Studies (CVS)">College of Vocational Studies (CVS)</option>
                    <option value="Ramanujan College">Ramanujan College</option>
                    <option value="PGDAV College">PGDAV College</option>
                    <option value="Sri Aurobindo College">Sri Aurobindo College</option>
                  </select>
                </div>
              </div>

              {/* College Year - Optional */}
              <div className="mb-4">
                <label htmlFor="collegeYear" className="block text-sm font-medium text-neutral-dark mb-1">
                  College Year <span className="text-gray-500">(Optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select
                    id="collegeYear"
                    name="collegeYear"
                    className="appearance-none block w-full pl-10 pr-3 py-3.5 border border-[#ffd7be] rounded-xl placeholder-gray-400 focus:outline-none focus:ring-[#ffd7be] focus:border-[#ffd7be] sm:text-sm transition-all duration-200"
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

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700 transition-all duration-200"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Profile'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
