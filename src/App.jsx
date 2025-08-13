import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import WeeklyWorkout from './components/WorkoutSchedule/WeeklyWorkout';
import WorkoutDetailView from './components/WorkoutSchedule/WorkoutDetailView';
import LandingPage from './pages/Landing/LandingPage';
import ToastManager, { toast } from './components/ToastManager';
import './App.css';

function ProtectedRoute({ token, children }) {
  return token ? children : <Navigate to="/" replace />;
}

export default function App() {
  const location = useLocation();
  const [token, setToken] = useState(localStorage.getItem('jwt_token'));
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [personalized, setPersonalized] = useState([]);
  const [meta, setMeta] = useState({
    program_start: '',
    expires_on: '',
    user_name: ''
  });
  const [loadingWorkout, setLoadingWorkout] = useState(false);
  
  // Track if we've made the initial fetch to avoid duplicates
  const hasFetchedRef = useRef(false);
  const lastFetchRef = useRef(null);

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

      if (!res.ok) throw new Error('Failed to fetch schedule');
      const data = await res.json();

      console.log('📥 Fresh schedule data received:', data);
      
      // Debug: Analyze the session data structure
      if (data.schedule) {
        data.schedule.forEach(dayData => {
          const { day, workouts } = dayData;
          const exercisesWithSessions = workouts.filter(w => w.sessions && w.sessions.length > 0);
          const totalSessions = workouts.reduce((sum, w) => sum + (w.sessions ? w.sessions.length : 0), 0);
          
          console.log(`📊 ${day} Debug:`, {
            totalExercises: workouts.length,
            exercisesWithSessions: exercisesWithSessions.length,
            totalSessions,
            sessionDetails: exercisesWithSessions.map(ex => ({
              name: ex.name,
              sessionCount: ex.sessions.length,
              completedSets: new Set(ex.sessions.filter(s => s.set_status === 'completed').map(s => s.set_number)).size,
              totalSets: ex.sets
            }))
          });
        });
      }

      setPersonalized(data.schedule || []);
      setMeta({
        program_id: data.program_id,
        program_start: data.program_start,
        expires_on: data.expires_on,
        user_name: data.user_name || ''
      });

      if (data.from_ai) {
        toast.show('success', '✅ Your personalized workout plan is ready!');
      }
    } catch (err) {
      console.error('❌ Failed to fetch schedule:', err);
      toast.show('danger', '❌ Failed to load schedule');
    }
  };

  // SINGLE useEffect to handle all schedule fetching scenarios
  useEffect(() => {
    if (!token) {
      hasFetchedRef.current = false;
      return;
    }

    // Set username when token is available
    setUserName(localStorage.getItem('userName') || '');

    // Scenario 1: Initial load or token change
    if (!hasFetchedRef.current) {
      fetchSchedule(token, 'initial-load');
      hasFetchedRef.current = true;
      return;
    }

    // Scenario 2: Navigation back to schedule with state (workout completion)
    if (location.pathname === '/schedule' && location.state) {
      const state = location.state;
      
      // Show completion message
      if (state?.message || state?.completedSets !== undefined) {
        console.log('🎉 Workout completed, showing message:', state.message);
        if (state.message) {
          toast.show('success', state.message);
        }
      }
      
      // Only refresh if there's a meaningful state change
      if (state?.message || state?.completedSets !== undefined || state?.forceRefresh) {
        fetchSchedule(token, 'workout-completion');
      }
    }
  }, [token, location.pathname, location.state]);

  const handleLoginSuccess = () => {
    setUserName(localStorage.getItem('userName') || '');
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
              <LandingPage
                token={token}
                setToken={setToken}
                userName={userName}
                setUserName={setUserName}
                onLoginSuccess={handleLoginSuccess}
                onSaveSuccess={handleSaveSuccess}
              />
            )
          }
        />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute token={token}>
              <>
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
                      onRefreshSchedule={fetchSchedule} // Pass refresh function
                    />
                  </div>
                </main>
              </>
            </ProtectedRoute>
          }
        />
        
        {/* Workout Detail Route */}
        <Route
          path="/workout-detail"
          element={
            <ProtectedRoute token={token}>
              <main className="app-main">
                <div className="content-container">
                  <WorkoutDetailView onWorkoutComplete={fetchSchedule} />
                </div>
              </main>
            </ProtectedRoute>
          }
        />
      </Routes>
      <ToastManager />
    </div>
  );
}