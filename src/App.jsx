import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import WeeklyWorkout from './components/WorkoutSchedule/WeeklyWorkout';
import LandingPage from './pages/Landing/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ToastManager, { toast } from './components/ToastManager';
import './App.css';

function ProtectedRoute({ token, children }) {
  return token ? children : <Navigate to="/" replace />;
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('jwt_token'));
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [personalized, setPersonalized] = useState([]);
  const [meta, setMeta] = useState({
    program_start: '',
    expires_on: '',
    user_name: ''
  });

  const fetchSchedule = async (customToken) => {
    const usedToken = customToken || token;
    if (!usedToken) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/schedule`, {
        headers: { Authorization: `Bearer ${usedToken}` }
      });

      if (!res.ok) throw new Error('Failed to fetch schedule');
      const data = await res.json();

      setPersonalized(data.schedule || []);
      setMeta({
        program_start: data.program_start,
        expires_on: data.expires_on,
        user_name: data.user_name || ''
      });

      if (data.from_ai) {
        toast.show('success', '✅ Your personalized workout plan is ready!');
      }
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
      toast.show('danger', '❌ Failed to load schedule');
    }
  };

  useEffect(() => {
    if (token) fetchSchedule();
  }, [token]);

  const handleLoginSuccess = () => {
    fetchSchedule();
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
          path="/login"
          element={isLoggedIn ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={isLoggedIn ? <Navigate to="/" replace /> : <RegisterPage />}
        />
        <Route
          path="/"
          element={
            isLoggedIn ? (
              <>
                <Navbar
                  token={token}
                  setToken={setToken}
                  onPersonalized={fetchSchedule}
                  fetchSchedule={fetchSchedule}
                  meta={meta}
                />
                <main className="app-main">
                  <div className="content-scrollable">
                    <WeeklyWorkout personalized={personalized} meta={meta} />
                  </div>
                </main>
              </>
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
      </Routes>
      <ToastManager />
    </div>
  );
}
