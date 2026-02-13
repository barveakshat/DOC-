import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

// Import Clerk components for OAuth
import { SignedIn, SignedOut, SignIn, SignUp, useUser, useClerk } from '@clerk/clerk-react';

interface DoctorProfile {
  id: string;
  user_id: string;
  username: string;
  name: string;
  registration_no?: string | null;
}

interface PatientProfile {
  id: string;
  user_id: string | null;
  name: string;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  medical_history?: string | null;
  assigned_doctor_id?: string | null;
}

interface AuthUser {
  id: string;
  user_id: string;
  auth_user_id?: string;
  username?: string;
  name: string;
  email?: string;
  role: 'doctor' | 'patient';
  registration_no?: string | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  medical_history?: string | null;
  assigned_doctor_id?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string,
    userData: { username: string; name: string; registrationNo?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isCheckingProfile: boolean;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);

  useEffect(() => {
    const checkAuthState = async () => {
      console.log('🔄 AuthProvider useEffect triggered:', {
        isClerkLoaded,
        clerkUser: clerkUser ? { id: clerkUser.id, email: clerkUser.primaryEmailAddress?.emailAddress } : null
      });

      if (!isClerkLoaded) {
        console.log('⏳ Clerk not loaded yet, waiting...');
        setIsLoading(true);
        return;
      }

      if (clerkUser) {
        console.log('✅ Clerk user found, checking metadata and setting up profile');

        // Force reload Clerk user to ensure latest metadata
        console.log('🔄 Force reloading Clerk user...');
        await clerkUser.reload();
        console.log('✅ Clerk user reloaded');

        // Check if user has completed onboarding via Clerk metadata
        const userRole = clerkUser.unsafeMetadata?.role as 'doctor' | 'patient' | undefined;
        const onboardingComplete = clerkUser.unsafeMetadata?.onboardingComplete as boolean;

        console.log('🔍 Clerk metadata - Role:', userRole, 'Onboarding complete:', onboardingComplete);
        console.log('🔍 Full Clerk metadata:', JSON.stringify(clerkUser.unsafeMetadata, null, 2));

        if (userRole && onboardingComplete) {
          // User has completed onboarding, load their profile from database
          console.log('✅ User has completed onboarding, loading profile from database');
          setupSupabaseOAuth(clerkUser);
        } else if (userRole && !onboardingComplete) {
          // User has selected role but hasn't completed onboarding - set minimal user state
          console.log('🔄 User has selected role but not completed onboarding');
          setUser({
            id: clerkUser.id,
            user_id: null, // No database profile yet
            auth_user_id: clerkUser.id,
            name: clerkUser.fullName || clerkUser.firstName || 'User',
            email: clerkUser.primaryEmailAddress?.emailAddress,
            role: userRole,
            registration_no: null,
            age: null,
            gender: null,
            phone: null,
            medical_history: null,
            assigned_doctor_id: null,
          });
          setSession(null);
          setIsLoading(false);
          setIsCheckingProfile(false);
        } else {
          // User hasn't selected role yet
          console.log('⚠️ User has not selected role, setting user to null');
          setUser(null);
          setSession(null);
          setIsLoading(false);
          setIsCheckingProfile(false);
        }
      } else {
        console.log('❌ No Clerk user, clearing state');
        setUser(null);
        setSession(null);
        setIsLoading(false);
        setIsCheckingProfile(false);
      }
    };

    checkAuthState();
  }, [clerkUser, isClerkLoaded]);

  const setupSupabaseOAuth = async (clerkUser: any) => {
    try {
      console.log('🚀 Setting up Supabase OAuth for Clerk user:', clerkUser.id);

      // Get the JWT token from Clerk
      const token = await clerkUser.getToken({ template: 'supabase' }) || await clerkUser.getToken();
      console.log('🔑 Got Clerk JWT token:', token ? '***' + token.slice(-10) : 'null');

      if (token) {
        // Set the JWT token in Supabase auth
        // We'll use the token directly for authenticated requests
        console.log('✅ Clerk JWT token available for Supabase auth');

        // For now, let's create a minimal session object to satisfy the auth state
        // The actual authentication will happen via the JWT token in requests
        const mockSession = {
          access_token: token,
          refresh_token: '',
          user: {
            id: clerkUser.id,
            email: clerkUser.primaryEmailAddress?.emailAddress,
          },
        };
        setSession(mockSession as any);
      }

      // Start checking for user profile
      setIsCheckingProfile(true);
      // Fetch user profile based on Clerk user ID
      await fetchUserProfileByClerkId(clerkUser.id);

    } catch (error) {
      console.error('❌ Error setting up Supabase OAuth:', error);
      // Even if OAuth setup fails, try to fetch profile
      setIsCheckingProfile(true);
      await fetchUserProfileByClerkId(clerkUser.id);
    }
  };

  const fetchUserProfile = async (supabaseUserId: string) => {
    console.log('🚀 Fetching user profile for Supabase user:', supabaseUserId);

    try {
      // Try to fetch doctor profile first - use safe bulk query approach
      const { data: doctors } = await supabase
        .from('doctors')
        .select('*')
        .limit(10);

      const doctorProfile = doctors?.find(d => d.user_id === supabaseUserId);

      if (doctorProfile) {
        console.log('✅ Found doctor profile for Supabase user');
        setUser({
          id: supabaseUserId,
          user_id: doctorProfile.id,
          username: doctorProfile.username,
          name: doctorProfile.name,
          email: clerkUser?.primaryEmailAddress?.emailAddress,
          role: 'doctor',
          registration_no: doctorProfile.registration_no,
        });
      } else {
        // Try to fetch patient profile - use safe bulk query approach
        const { data: patients } = await supabase
          .from('patients')
          .select('*')
          .limit(10);

        const patientProfile = patients?.find(p => p.user_id === supabaseUserId);

        if (patientProfile) {
          console.log('✅ Found patient profile for Supabase user');
          setUser({
            id: supabaseUserId,
            user_id: patientProfile.id,
            name: patientProfile.name,
            email: clerkUser?.primaryEmailAddress?.emailAddress || patientProfile.email,
            role: 'patient',
            age: patientProfile.age,
            gender: patientProfile.gender,
            phone: patientProfile.phone,
            medical_history: patientProfile.medical_history,
            assigned_doctor_id: patientProfile.assigned_doctor_id,
          });
        } else {
          console.log('⚠️ No profile found for Supabase user');
          setUser(null);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
      setIsCheckingProfile(false);
    }
  };

  const fetchUserProfileByClerkId = async (clerkUserId: string) => {
    console.log('🚀 Fetching user profile for Clerk user:', clerkUserId);
    console.log('🔍 Clerk user email:', clerkUser?.primaryEmailAddress?.emailAddress);

    try {
      // Check Clerk metadata first
      const userRole = clerkUser?.unsafeMetadata?.role as 'doctor' | 'patient' | undefined;
      const onboardingComplete = clerkUser?.unsafeMetadata?.onboardingComplete as boolean;

      console.log('🔍 Metadata check - Role:', userRole, 'Complete:', onboardingComplete);

      if (!userRole || !onboardingComplete) {
        console.log('⚠️ User has not completed onboarding via metadata');
        setUser(null);
        setIsLoading(false);
        setIsCheckingProfile(false);
        return;
      }

      // Strategy 1: Try to match by clerk_user_id (primary method)
      console.log('🔍 Strategy 1: Looking for profiles by clerk_user_id');

      if (userRole === 'doctor') {
        // Check doctors table by clerk_user_id
        try {
          const { data: doctors } = await supabase
            .from('doctors')
            .select('id, user_id, username, name, registration_no')
            .eq('clerk_user_id', clerkUserId)
            .limit(1);

          if (doctors && doctors.length > 0) {
            const doctor = doctors[0];
            console.log('✅ Found doctor profile by clerk_user_id');
            const userData = {
              id: clerkUserId,
              user_id: doctor.id,
              auth_user_id: doctor.user_id || clerkUserId,
              username: doctor.username,
              name: doctor.name,
              email: clerkUser?.primaryEmailAddress?.emailAddress,
              role: 'doctor' as const,
              registration_no: doctor.registration_no,
            };
            console.log('🔄 Setting user data:', userData);
            setUser(userData);
            setIsLoading(false);
            setIsCheckingProfile(false);
            return;
          }
        } catch (error) {
          console.log('⚠️ No doctor found by clerk_user_id');
        }
      } else if (userRole === 'patient') {
        // Check patients table by clerk_user_id
        try {
          const { data: patients } = await supabase
            .from('patients')
            .select('id, user_id, name, email, age, gender, phone, medical_history, assigned_doctor_id')
            .eq('clerk_user_id', clerkUserId)
            .limit(1);

          if (patients && patients.length > 0) {
            const patient = patients[0];
            console.log('✅ Found patient profile by clerk_user_id');
            const userData = {
              id: clerkUserId,
              user_id: patient.id,
              auth_user_id: patient.user_id || clerkUserId,
              name: patient.name,
              email: clerkUser?.primaryEmailAddress?.emailAddress || patient.email,
              role: 'patient' as const,
              age: patient.age,
              gender: patient.gender,
              phone: patient.phone,
              medical_history: patient.medical_history,
              assigned_doctor_id: patient.assigned_doctor_id,
            };
            console.log('🔄 Setting user data:', userData);
            setUser(userData);
            setIsLoading(false);
            setIsCheckingProfile(false);
            return;
          }
        } catch (error) {
          console.log('⚠️ No patient found by clerk_user_id');
        }
      }

      // Strategy 2: Fallback to user_id if clerk_user_id didn't work
      console.log('🔍 Strategy 2: Looking for profiles by user_id');

      if (userRole === 'doctor') {
        // Check doctors table by user_id
        try {
          const { data: doctors } = await supabase
            .from('doctors')
            .select('id, user_id, username, name, registration_no')
            .eq('user_id', clerkUserId)
            .limit(1);

          if (doctors && doctors.length > 0) {
            const doctor = doctors[0];
            console.log('✅ Found doctor profile by user_id');
            const userData = {
              id: clerkUserId,
              user_id: doctor.id,
              auth_user_id: doctor.user_id || clerkUserId,
              username: doctor.username,
              name: doctor.name,
              email: clerkUser?.primaryEmailAddress?.emailAddress,
              role: 'doctor' as const,
              registration_no: doctor.registration_no,
            };
            console.log('🔄 Setting user data:', userData);
            setUser(userData);
            setIsLoading(false);
            setIsCheckingProfile(false);
            return;
          }
        } catch (error) {
          console.log('⚠️ No doctor found by user_id');
        }
      } else if (userRole === 'patient') {
        // Check patients table by user_id
        try {
          const { data: patients } = await supabase
            .from('patients')
            .select('id, user_id, name, email, age, gender, phone, medical_history, assigned_doctor_id')
            .eq('user_id', clerkUserId)
            .limit(1);

          if (patients && patients.length > 0) {
            const patient = patients[0];
            console.log('✅ Found patient profile by user_id');
            const userData = {
              id: clerkUserId,
              user_id: patient.id,
              auth_user_id: patient.user_id || clerkUserId,
              name: patient.name,
              email: clerkUser?.primaryEmailAddress?.emailAddress || patient.email,
              role: 'patient' as const,
              age: patient.age,
              gender: patient.gender,
              phone: patient.phone,
              medical_history: patient.medical_history,
              assigned_doctor_id: patient.assigned_doctor_id,
            };
            console.log('🔄 Setting user data:', userData);
            setUser(userData);
            setIsLoading(false);
            setIsCheckingProfile(false);
            return;
          }
        } catch (error) {
          console.log('⚠️ No patient found by user_id');
        }
      }

      // Strategy 3: If no profile found, user might need to complete onboarding
      console.log('⚠️ No existing profile found for completed onboarding user');
      console.log('🔄 Setting user to null and isLoading to false');
      setUser(null);
      setIsLoading(false);
      setIsCheckingProfile(false);

    } catch (error) {
      console.error('❌ Error fetching user profile by Clerk ID:', error);
      setUser(null);
      setIsLoading(false);
      setIsCheckingProfile(false);
    }
  };

  // Set up Supabase auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Supabase auth state change:', event, session?.user?.id);
        setSession(session);

        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setIsLoading(false);
          setIsCheckingProfile(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    // With Clerk OAuth, login is handled by Clerk's components
    // This method is kept for compatibility but redirects to Clerk
    console.log('🔐 Login called - redirecting to Clerk authentication');
    return { success: true, error: 'Please use Clerk authentication' };
  };

  const signUp = async (
    email: string,
    password: string,
    userData: { username: string; name: string; registrationNo?: string }
  ) => {
    // With Clerk OAuth, signup is handled by Clerk's components
    // This method is kept for compatibility but redirects to Clerk
    console.log('📝 Signup called - redirecting to Clerk authentication');
    return { success: true, error: 'Please use Clerk authentication' };
  };

  const logout = async () => {
    console.log('🚪 Logging out from both Clerk and Supabase');
    // Sign out from both services
    await Promise.all([
      supabase.auth.signOut(),
      clerkSignOut()
    ]);
  };

  return (
    <AuthContext.Provider value={{ user, session, login, signUp, logout, isLoading, isCheckingProfile, setUser }}>
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