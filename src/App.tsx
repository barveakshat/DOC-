import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import DashboardLayout from "./components/DashboardLayout";
import DoctorDashboard from "./pages/DoctorDashboard";
import PatientDashboard from "./pages/PatientDashboard";
import AIChat from "./pages/AIChat";
import DoctorChat from "./pages/DoctorChat";
import PatientDoctorChat from "./pages/PatientDoctorChat";
import PatientRegistration from "./pages/PatientRegistration";
import Patients from "./pages/Patients";
import NotFound from "./pages/NotFound";
import PatientDetail from "./pages/PatientDetail";
import RoleSelectionPage from "./pages/RoleSelectionPage";
import PatientOnboardingPage from "./pages/PatientOnboardingPage";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DoctorOnboarding from "./components/DoctorOnboarding";

// Import Clerk components
import { SignedIn, SignedOut, SignIn, SignUp, useClerk } from '@clerk/clerk-react';
import React from 'react';

const queryClient = new QueryClient();

// AuthRedirect component to handle post-authentication redirects
const AuthRedirect: React.FC = () => {
  const { user, loaded } = useClerk();
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    console.log('🔄 AuthRedirect - Effect triggered:', { user, loaded, location: location.pathname + location.search });

    if (loaded) {
      if (user) {
        // User is authenticated, check for redirect parameters
        const searchParams = new URLSearchParams(location.search);

        // Check for Clerk handshake completion
        if (searchParams.has('__clerk_handshake')) {
          console.log('🔄 AuthRedirect - Clerk handshake detected, authentication completed');
          // Clerk has completed authentication, now redirect appropriately
          const userRole = user?.unsafeMetadata?.role as 'doctor' | 'patient' | undefined;
          const onboardingComplete = user?.unsafeMetadata?.onboardingComplete as boolean;

          if (userRole && onboardingComplete) {
            const defaultRoute = userRole === 'doctor' ? '/ai-chat' : '/ai-chat';
            console.log('🔄 AuthRedirect - Redirecting to default route:', defaultRoute);
            navigate(defaultRoute);
          } else {
            console.log('🔄 AuthRedirect - Redirecting to role selection');
            navigate('/onboarding/select-role');
          }
          return;
        }

        // Check for custom redirect parameter
        const redirectTo = searchParams.get('redirect');
        if (redirectTo) {
          console.log('🔄 AuthRedirect - Redirecting to:', redirectTo);
          navigate(redirectTo);
          return;
        }

        // Default redirect based on user role
        const userRole = user?.unsafeMetadata?.role as 'doctor' | 'patient' | undefined;
        const onboardingComplete = user?.unsafeMetadata?.onboardingComplete as boolean;

        if (userRole && onboardingComplete) {
          const defaultRoute = userRole === 'doctor' ? '/ai-chat' : '/ai-chat';
          console.log('🔄 AuthRedirect - Redirecting to default route:', defaultRoute);
          navigate(defaultRoute);
        } else {
          console.log('🔄 AuthRedirect - Redirecting to role selection');
          navigate('/onboarding/select-role');
        }
      } else {
        // User is not authenticated, redirect to sign-in
        console.log('🔄 AuthRedirect - User not authenticated, redirecting to sign-in');
        navigate('/onboarding/select-role');
      }
    }
  }, [user, loaded, location, navigate]);

  // Show loading while Clerk processes authentication
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">
          {user ? 'Completing sign in...' : 'Redirecting...'}
        </p>
      </div>
    </div>
  );
};

const AppRoutes = () => {
  const { user, isLoading, isCheckingProfile } = useAuth();
  const location = useLocation();
  const { user: clerkUser } = useClerk();

  console.log('🔄 AppRoutes - Current location:', location.pathname);
  console.log('🔄 AppRoutes - user:', user, 'isLoading:', isLoading, 'isCheckingProfile:', isCheckingProfile);
  console.log('🔄 AppRoutes - Clerk user metadata:', clerkUser?.unsafeMetadata);

  // Show loading spinner while determining user state
  if (isLoading || isCheckingProfile) {
    console.log('⏳ AppRoutes - Still loading...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          {isCheckingProfile ? (
            <p className="text-muted-foreground">Checking if you are a doctor...</p>
          ) : (
            <p className="text-muted-foreground">Loading...</p>
          )}
        </div>
      </div>
    );
  }

  console.log('✅ AppRoutes - Loading complete, user:', user);

  // Check Clerk metadata for role and onboarding status
  const userRole = clerkUser?.unsafeMetadata?.role as 'doctor' | 'patient' | undefined;
  const onboardingComplete = clerkUser?.unsafeMetadata?.onboardingComplete as boolean;

  console.log('🔍 AppRoutes - Role from metadata:', userRole, 'Onboarding complete:', onboardingComplete);

  // Simple routing for authenticated users with complete profiles
  if (user && userRole && onboardingComplete) {
    const currentPath = location.pathname;
    if (currentPath === '/' || currentPath === '') {
      console.log('🏥 Redirecting to dashboard');
      return <Navigate to={userRole === 'doctor' ? '/ai-chat' : '/ai-chat'} replace />;
    }
  }

  // Handle users who have selected role but haven't completed onboarding
  if (user && userRole && !onboardingComplete) {
    const currentPath = location.pathname;
    if (currentPath === '/' || currentPath === '') {
      console.log('🔄 Redirecting to onboarding');
      return <Navigate to={userRole === 'doctor' ? '/onboarding/doctor' : '/onboarding/patient'} replace />;
    }
  }

  // For users with incomplete onboarding, let the SignedIn logic handle routing
  if (user && userRole && !onboardingComplete) {
    const currentPath = location.pathname;
    if (currentPath === '/' || currentPath === '') {
      console.log('📝 Redirecting to onboarding');
      return <Navigate to={userRole === 'doctor' ? '/onboarding/doctor' : '/onboarding/patient'} replace />;
    }
  }

  if (user) {
    console.log('👤 AppRoutes - User found, role:', user.role);
    console.log('🏠 AppRoutes - Setting up authenticated routes');
  } else {
    console.log('❌ AppRoutes - No user found');
  }

  return (
    <Routes>
      {/* Always available routes */}
      <Route path="/onboarding/select-role" element={<RoleSelectionPage />} />
      <Route path="/onboarding/doctor" element={<DoctorOnboarding />} />
      <Route path="/onboarding/patient" element={<PatientOnboardingPage />} />
      <Route path="/patient-onboarding" element={<PatientOnboardingPage />} />
      <Route path="/auth-redirect" element={<Navigate to="/" replace />} />

      {/* Authenticated routes */}
      {user ? (
        <>
          <Route path="/" element={<Navigate to={user.role === 'doctor' ? '/ai-chat' : '/ai-chat'} replace />} />
          <Route path="/debug" element={
            <div className="p-8">
              <h1 className="text-2xl font-bold mb-4">Authentication Debug</h1>
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">AuthContext User:</h2>
                  <pre className="bg-gray-100 p-4 rounded text-sm">{JSON.stringify(user, null, 2)}</pre>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Clerk User:</h2>
                  <pre className="bg-gray-100 p-4 rounded text-sm">{JSON.stringify({
                    id: clerkUser?.id,
                    email: clerkUser?.primaryEmailAddress?.emailAddress,
                    metadata: clerkUser?.unsafeMetadata
                  }, null, 2)}</pre>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Routing State:</h2>
                  <pre className="bg-gray-100 p-4 rounded text-sm">{JSON.stringify({
                    userRole,
                    onboardingComplete,
                    currentPath: location.pathname
                  }, null, 2)}</pre>
                </div>
              </div>
              <div className="mt-4">
                <a href="/ai-chat" className="bg-blue-500 text-white px-4 py-2 rounded mr-2">Go to AI Chat</a>
                {user.role === 'doctor' && <a href="/dashboard" className="bg-green-500 text-white px-4 py-2 rounded mr-2">Go to Dashboard</a>}
                <a href="/onboarding/select-role" className="bg-purple-500 text-white px-4 py-2 rounded">Go to Role Selection</a>
              </div>
            </div>
          } />
          <Route
            path="/dashboard"
            element={
              user.role === 'doctor' ? (
                <Navigate to="/ai-chat" replace />
              ) : (
                <Navigate to="/ai-chat" replace />
              )
            }
          />
          <Route
            path="/dashboard/doctor"
            element={<Navigate to="/ai-chat" replace />}
          />
          <Route path="/auth-redirect" element={<AuthRedirect />} />
          <Route
            path="/dashboard/patient"
            element={<Navigate to="/ai-chat" replace />}
          />
          <Route
            path="/ai-chat"
            element={
              <DashboardLayout>
                <AIChat />
              </DashboardLayout>
            }
          />
          <Route
            path="/doctor-chat"
            element={
              <DashboardLayout>
                {user.role === 'doctor' ? <DoctorChat /> : <PatientDoctorChat />}
              </DashboardLayout>
            }
          />
          {/* Doctor-only routes */}
          {user.role === 'doctor' && (
            <>
              <Route
                path="/patients"
                element={
                  <DashboardLayout>
                    <Patients />
                  </DashboardLayout>
                }
              />
              <Route
                path="/register-patient"
                element={
                  <DashboardLayout>
                    <PatientRegistration />
                  </DashboardLayout>
                }
              />
              <Route
                path="/patient/:id"
                element={
                  <DashboardLayout>
                    <PatientDetail />
                  </DashboardLayout>
                }
              />
            </>
          )}
        </>
      ) : (
        /* Redirect to onboarding if no user */
        <Route path="*" element={<Navigate to="/onboarding/select-role" replace />} />
      )}

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const AppContent = () => {
  const { loaded, user: clerkUser } = useClerk();
  const { user, isLoading, isCheckingProfile } = useAuth();

  console.log('🔄 AppContent - Clerk loaded:', loaded, 'Auth loading:', isLoading, 'Checking profile:', isCheckingProfile, 'User:', user);

  if (!loaded || isLoading || isCheckingProfile) {
    console.log('⏳ AppContent - Still loading...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          {isCheckingProfile ? (
            <p className="text-muted-foreground">Checking if you are a doctor...</p>
          ) : (
            <p className="text-muted-foreground">Loading...</p>
          )}
        </div>
      </div>
    );
  }

  console.log('✅ AppContent - Loading complete');

  if (user === null) {
    console.log('📝 AppContent - No user profile, showing onboarding');
  } else {
    console.log('👤 AppContent - User profile found, showing app routes');
  }

  return (
    <>
      <SignedIn>
        {(() => {
          console.log('🔐 SignedIn - user state:', user, 'clerkUser:', clerkUser?.id);
          console.log('🔐 SignedIn - Clerk metadata:', clerkUser?.unsafeMetadata);
          console.log('🔐 SignedIn - Auth user role:', user?.role);
          return null;
        })()}
        {/* If user is signed in but has no profile, redirect to role selection */}
        {user === null ? (
          <Routes>
            <Route path="/onboarding/select-role" element={<RoleSelectionPage />} />
            <Route path="/onboarding/doctor" element={<DoctorOnboarding />} />
            <Route path="/onboarding/patient" element={<PatientOnboardingPage />} />
            <Route path="*" element={<Navigate to="/onboarding/select-role" replace />} />
          </Routes>
        ) : user.role && !clerkUser?.unsafeMetadata?.onboardingComplete ? (
          // User has selected role but hasn't completed onboarding
          <Routes>
            <Route path="/onboarding/doctor" element={<DoctorOnboarding />} />
            <Route path="/onboarding/patient" element={<PatientOnboardingPage />} />
            <Route path="*" element={<Navigate to={user.role === 'doctor' ? '/onboarding/doctor' : '/onboarding/patient'} replace />} />
          </Routes>
        ) : (
          <AppRoutes />
        )}
      </SignedIn>
      <SignedOut>
        <Routes>
          <Route path="/sign-up" element={
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
              <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold text-gray-900">Welcome to Doc+</h1>
                  <p className="text-gray-600 mt-2">Create your account to get started</p>
                </div>
                <SignUp
                  routing="virtual"
                  signInUrl="/"
                  appearance={{
                    elements: {
                      formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
                      card: 'shadow-none',
                      headerTitle: 'hidden',
                      headerSubtitle: 'hidden'
                    }
                  }}
                />
              </div>
            </div>
          } />
          <Route path="/patient-onboarding" element={
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
              <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold text-gray-900">Welcome to Doc+</h1>
                  <p className="text-gray-600 mt-2">Please sign in to access your invitation</p>
                </div>
                <SignIn
                  routing="virtual"
                  signUpUrl="/sign-up"
                  appearance={{
                    elements: {
                      formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
                      card: 'shadow-none',
                      headerTitle: 'hidden',
                      headerSubtitle: 'hidden'
                    }
                  }}
                />
              </div>
            </div>
          } />
          <Route path="/auth-redirect" element={<AuthRedirect />} />
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
              <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold text-gray-900">Welcome to Doc+</h1>
                  <p className="text-gray-600 mt-2">Please sign in to continue</p>
                </div>
                <SignIn
                  routing="virtual"
                  signUpUrl="/sign-up"
                  appearance={{
                    elements: {
                      formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
                      card: 'shadow-none',
                      headerTitle: 'hidden',
                      headerSubtitle: 'hidden'
                    }
                  }}
                />
              </div>
            </div>
          } />
        </Routes>
      </SignedOut>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
