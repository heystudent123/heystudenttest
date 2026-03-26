import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { authApi, setTokenGetter } from '../services/api';

interface User {
  _id: string;
  name: string;
  fullName?: string;
  email?: string;
  phone?: string;
  city?: string;
  whatsapp?: string;
  role: string;
  referralCode?: string;
  college?: string;
  collegeYear?: string;
  clerkId?: string;
  profileCompleted?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  updateUserProfile: (profileData: Partial<User>) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const { getToken } = useClerkAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Wire Clerk's getToken into the axios interceptor so every request gets a fresh JWT
  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  // Sync Clerk user with backend
  const syncUserWithBackend = useCallback(async () => {
    if (!isClerkLoaded) return;

    if (!isSignedIn || !clerkUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      // Sync user with backend
      const response = await authApi.syncUser({
        clerkId: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        name: clerkUser.fullName || clerkUser.firstName || '',
        phone: clerkUser.primaryPhoneNumber?.phoneNumber || ''
      });

      const backendUser = response.data;
      setUser(backendUser);
    } catch (error) {
      console.error('Error syncing user with backend:', error);
      // Fallback to /me so role and profile data stay current for navbar/guards.
      try {
        const meResponse = await authApi.getMe();
        const meUser = meResponse.data;
        setUser(meUser);
      } catch {
        // Do not trust cached localStorage user data for authorization decisions.
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [isClerkLoaded, isSignedIn, clerkUser]);

  useEffect(() => {
    syncUserWithBackend();
  }, [syncUserWithBackend]);

  // Update user profile data
  const updateUserProfile = async (profileData: Partial<User>): Promise<User> => {
    setLoading(true);
    try {
      if (!user) {
        throw new Error('No user is logged in');
      }

      const response = await authApi.updateProfile(user._id, profileData);
      
      const updatedUser = { ...user, ...response.data };
      
      setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      updateUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};