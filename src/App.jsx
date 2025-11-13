import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import WeeklyWorkout from './components/WorkoutSchedule/WeeklyWorkout';
import WorkoutDetailView from './components/WorkoutSchedule/WorkoutDetailView';
import WorkoutHistory from './components/WorkoutHistory/WorkoutHistory';
import LandingPage from './pages/Landing/LandingPage';
import ProfileOnboardingModal from './components/ProfileOnboardingModal/ProfileOnboardingModal';
import ToastManager, { toast } from './components/ToastManager';
import MobileNavBar from './components/Navigation/MobileNavBar';
import './App.css';

// Auth redirect function
function checkAuthAndRedirect(response) {
  if (response.status === 401 || response.status === 403) {
    console.log('🔒 Auth error detected - redirecting to landing');
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('userName');
    
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
    return true;
  }
  return false;
}

function ProtectedRoute({ token, children }) {
  return token ? children : <Navigate to="/" replace />;
}

const AppLayout = ({ children, showMobileNav = false }) => {
  return (
    <>
      {children}
      {showMobileNav && <MobileNavBar />}
    </>
  );
};

export default function App() {
  const location = useLocation();
  const [token, setToken] = useState(localStorage.getItem('jwt_token'));
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [personalized, setPersonalized] = useState([]);
  const [meta, setMeta] = useState({
    program_start: '',
    expires_on: '',
    user_name: '',
    profile_complete: true, // Default to true to avoid flashing
    missing_profile_fields: []
  });
  const [loadingWorkout, setLoadingWorkout] = useState(false);
  
  // ✅ NEW: Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);
  
  // Track fetch status
  const hasFetchedRef = useRef(false);
  const lastFetchRef = useRef(null);
  const onboardingShownRef = useRef(false); // Prevent multiple onboarding shows

  const fetchSchedule = async (customToken, reason = 'unknown') => {
    const usedToken = customToken || token;
    if (!usedToken) return;

    // Prevent duplicate calls within 100ms
    const now = Date.now();
    if (lastFetchRef.current && (now - lastFetchRef.current) < 100) {
      console.log('🚫 Skipping duplicate fetchSchedule call within 100ms');
      return;
    }
    lastFetchRef.current = now;

    console.log(`🔄 Fetching schedule data (reason: ${reason})...`);
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/schedule/v2`, {
        headers: { Authorization: `Bearer ${usedToken}` }
      });

      if (res && checkAuthAndRedirect(res)) return;
      if (!res.ok) throw new Error('Failed to fetch schedule');
      
      const data = await res.json();
      console.log('📥 Fresh schedule data received:', data);
      
      // ✅ NEW: Handle profile completion status
      const isProfileIncomplete = data.profile_complete === false;
      const missingFields = data.missing_profile_fields || [];
      
      console.log('👤 Profile Status:', {
        complete: data.profile_complete,
        missing: missingFields,
        shouldShowOnboarding: isProfileIncomplete && !onboardingShownRef.current
      });

      setPersonalized(data.schedule || []);
      setMeta(data);

      // ✅ NEW: Show onboarding if profile is incomplete
      if (isProfileIncomplete && !onboardingShownRef.current && reason !== 'onboarding-complete') {
        console.log('🚀 Profile incomplete - showing onboarding modal');
        setShowOnboarding(true);
        onboardingShownRef.current = true;
      }

      if (data.from_ai) {
        toast.show('success', '✅ Your personalized workout plan is ready!');
      }
    } catch (err) {
      console.error('❌ Failed to fetch schedule:', err);
      if (err.message !== 'Authentication expired') {
        toast.show('danger', '❌ Failed to load schedule');
      }
    }
  };

  // ✅ NEW: Handle onboarding completion
  const handleOnboardingComplete = async () => {
    console.log('🎉 Onboarding completed - refreshing schedule');
    setShowOnboarding(false);
    onboardingShownRef.current = false; // Reset for future use
    
    // Small delay to ensure backend processing
    setTimeout(() => {
      fetchSchedule(token, 'onboarding-complete');
    }, 1000);
  };

  // ✅ NEW: Handle onboarding skip/close (optional)
  const handleOnboardingSkip = () => {
    console.log('⏭️ Onboarding skipped');
    setShowOnboarding(false);
    onboardingShownRef.current = true; // Mark as shown to prevent re-showing
  };

  // Main schedule fetching effect
  useEffect(() => {
    if (!token) {
      hasFetchedRef.current = false;
      onboardingShownRef.current = false;
      return;
    }

    setUserName(localStorage.getItem('userName') || '');

    const isScheduleRoute = location.pathname === '/schedule';
    if (!isScheduleRoute) {
      return;
    }

    // Initial load or token change when viewing the schedule
    if (!hasFetchedRef.current) {
      fetchSchedule(token, 'initial-load');
      hasFetchedRef.current = true;
      return;
    }

    // Navigation back to schedule with state (workout completion)
    if (location.state) {
      const state = location.state;

      if (state?.message || state?.completedSets !== undefined) {
        console.log('🎉 Workout completed, showing message:', state.message);
        if (state.message) {
          toast.show('success', state.message);
        }
      }

      if (state?.message || state?.completedSets !== undefined || state?.forceRefresh) {
        fetchSchedule(token, 'workout-completion');
      }
    }
  }, [token, location.pathname, location.state]);

  const handleLoginSuccess = () => {
    setUserName(localStorage.getItem('userName') || '');
    // Reset onboarding state for new login
    onboardingShownRef.current = false;
  };

  const handleSaveSuccess = () => {
    toast.show('success', '✅ Profile updated successfully');
  };

  const isLoggedIn = !!token;

  return (
    <div className="app-root">
      <Routes>
        <Route
          path="/"
          element={
            isLoggedIn ? (
              <Navigate to="/schedule" replace />
            ) : (
              <AppLayout showMobileNav={false}>
                <LandingPage
                  token={token}
                  setToken={setToken}
                  userName={userName}
                  setUserName={setUserName}
                  onLoginSuccess={handleLoginSuccess}
                  onSaveSuccess={handleSaveSuccess}
                />
              </AppLayout>
            )
          }
        />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute token={token}>
              <AppLayout showMobileNav={true}>
                <Navbar
                  token={token}
                  setToken={setToken}
                  onPersonalized={fetchSchedule}
                  fetchSchedule={fetchSchedule}
                  meta={meta}
                  loadingWorkout={loadingWorkout}
                  setLoadingWorkout={setLoadingWorkout}
                />
                <main className="app-main">
                  <div className="content-container">
                    <WeeklyWorkout
                      personalized={personalized}
                      meta={meta}
                      setPersonalized={setPersonalized}
                      loadingWorkout={loadingWorkout}
                      onRefreshSchedule={fetchSchedule}
                    />
                  </div>
                </main>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/workout-detail"
          element={
            <ProtectedRoute token={token}>
              <AppLayout showMobileNav={true}>
                <main className="app-main">
                  <div className="content-container">
                    <WorkoutDetailView onWorkoutComplete={fetchSchedule} />
                  </div>
                </main>
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/history"
          element={
            <ProtectedRoute token={token}>
              <AppLayout showMobileNav={true}>
                <main className="app-main">
                  <div className="content-container">
                    <WorkoutHistory />
                  </div>
                </main>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>

      {/* ✅ NEW: Onboarding Modal */}
      <ProfileOnboardingModal
        show={showOnboarding}
        onComplete={handleOnboardingComplete}
        missingFields={meta.missing_profile_fields || []}
      />

      <ToastManager />
    </div>
  );
}