// App.jsx
import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar/Navbar';
import WeeklyWorkout from './components/WorkoutSchedule/WeeklyWorkout';
import LandingPage from './pages/Landing/LandingPage';
import './App.css';

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
        headers: {
          Authorization: `Bearer ${usedToken}`
        }
      });

      if (!res.ok) throw new Error('Failed to fetch schedule');
      const data = await res.json();

      setPersonalized(data.schedule || []);
      setMeta({
        program_start: data.program_start,
        expires_on: data.expires_on,
        user_name: data.user_name || ''
      });
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSchedule();
    }
  }, [token]);

  const handleLoginSuccess = () => {
    fetchSchedule();
    setUserName(localStorage.getItem('userName') || '');
  };

  if (!token) {
    return (
      <div className="app-root">
        <LandingPage
          token={token}
          setToken={setToken}
          userName={userName}
          setUserName={setUserName}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  return (
    <div className="app-root">
      <Navbar
        token={token}
        setToken={setToken}
        onPersonalized={() => fetchSchedule()}
        fetchSchedule={fetchSchedule}
        meta={meta}
      />
      <main className="app-main">
        <div className="content-scrollable">
          <WeeklyWorkout personalized={personalized} meta={meta} />
        </div>
      </main>
    </div>
  );
}
