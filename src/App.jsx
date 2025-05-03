// src/App.jsx
import React, { useState } from 'react';
import Navbar from './components/Navbar/Navbar';
import WeeklyWorkout from './components/WorkoutSchedule/WeeklyWorkout';

export default function App() {
  // default to an empty array so WeeklyWorkout always receives an array
  const [personalized, setPersonalized] = useState([]);

  return (
    <div className="app-root">
      {/* Pass the setter so Navbar can load new workouts */}
      <Navbar onPersonalized={setPersonalized} />

      <main className="app-main" style={{ padding: '1rem' }}>
        <WeeklyWorkout personalized={personalized} />
      </main>
    </div>
  );
}
