import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar/Navbar';
import WeeklyWorkout from './components/WorkoutSchedule/WeeklyWorkout';

export default function App() {
  const [personalized, setPersonalized] = useState([]);
  const [meta, setMeta] = useState({
    program_start: '',
    expires_on: '',
    user_name: ''
  });

  const hasFetchedRef = useRef(false);
  const token = localStorage.getItem('jwt_token');

  const fetchSchedule = async () => {
    if (!token || hasFetchedRef.current) return;

    hasFetchedRef.current = true;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/schedule`, {
        headers: {
          Authorization: `Bearer ${token}`
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
    fetchSchedule();
  }, [token]);

  return (
    <div className="app-root">
      <Navbar onPersonalized={fetchSchedule} meta={meta} />
      <main className="app-main" style={{ padding: '1rem' }}>
        <WeeklyWorkout personalized={personalized} meta={meta} />
      </main>
    </div>
  );
}
