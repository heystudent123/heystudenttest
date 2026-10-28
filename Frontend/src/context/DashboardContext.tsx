import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { enrollmentsApi } from '../services/api';
import { useAuth } from './AuthContext';

export interface EnrolledCourse {
  _id: string;
  courseSlug: string;
  courseId?: {
    _id: string;
    title: string;
    subtitle?: string;
    description?: string;
    category?: string[];
    duration?: string;
    level?: string;
    instructor?: string;
    image?: string;
  } | null;
  amountPaid: number;
  enrolledAt: string;
}

interface DashboardContextType {
  loading: boolean;
  profileIncomplete: boolean;
  enrollments: EnrolledCourse[];
  hasAnyCourse: boolean;
  refetchEnrollments: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { isSignedIn, isLoaded: clerkLoaded } = useClerkAuth();
  const navigate = useNavigate();

  const [enrollments, setEnrollments] = useState<EnrolledCourse[]>([]);
  const [fetched, setFetched] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await enrollmentsApi.getMyEnrollments();
      setEnrollments(res.data || []);
    } catch {
      setEnrollments([]);
    } finally {
      setFetched(true);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !clerkLoaded) return;
    if (!user && !isSignedIn) {
      sessionStorage.setItem('postLoginRedirect', '/student/dashboard');
      navigate('/login');
      return;
    }
    fetchEnrollments();
  }, [authLoading, clerkLoaded, user, isSignedIn, navigate, fetchEnrollments]);

  const profileIncomplete = !user?.name || !user?.city || !user?.whatsapp;
  const loading = authLoading || !clerkLoaded || !fetched;

  return (
    <DashboardContext.Provider
      value={{
        loading,
        profileIncomplete,
        enrollments,
        hasAnyCourse: enrollments.length > 0,
        refetchEnrollments: fetchEnrollments,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
};
