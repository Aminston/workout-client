import './Navbar.css';
import { useEffect, useState } from 'react';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function Navbar() {
  const [meta, setMeta] = useState({ program_start: '', expires_on: '' });

  useEffect(() => {
    fetch("http://localhost:3000/weekly-schedule")
      .then(res => res.json())
      .then(data => {
        setMeta({
          program_start: data.program_start,
          expires_on: data.expires_on
        });
      })
      .catch(err => console.error('Failed to fetch meta:', err));
  }, []);

  return (
    <nav className="app-navbar">
      <div className="navbar-content">
        <div className="navbar-text">
          <span className="navbar-title">Your Weekly Workouts</span>
          {meta.program_start && meta.expires_on && (
            <span className="navbar-subtitle">
              {formatDate(meta.program_start)} - {formatDate(meta.expires_on)}
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
