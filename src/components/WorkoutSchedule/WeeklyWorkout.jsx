import React, { useEffect, useState } from 'react';
import './WeeklyWorkout.css';

const CATEGORY_CLASSES = {
  'Chest & Triceps': 'category-badge--blue',
  'Back & Biceps': 'category-badge--cyan',
  'Legs & Shoulders': 'category-badge--green',
  'Core & Functional': 'category-badge--purple',
  'Full-Body': 'category-badge--indigo',
};

export default function WeeklyWorkout() {
  const [schedule, setSchedule] = useState([]);
  const [meta, setMeta] = useState({ program_start: '', expires_on: '' });

  useEffect(() => {
    let isMounted = true;

    fetch("https://workout-backend-gfdy.onrender.com/weekly-schedule")
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          setSchedule(data.schedule);
          setMeta({
            program_start: data.program_start,
            expires_on: data.expires_on
          });
        }
      })
      .catch(err => console.error('Failed to fetch workouts:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="section-list">
      {schedule.map((day, index) => (
        <div key={day.day} className="data-card">
          <div className="data-card__header">
            <h5 className="data-card__title">{day.day}</h5>
            <span className={`category-badge ${CATEGORY_CLASSES[day.category] || 'category-badge--default'}`}>
              {day.category} Day
            </span>
          </div>
          <hr className="data-divider" />
          <ul className="entry-list">
            {day.workouts.map((exercise, i) => (
              <li key={i} className="entry-item">{exercise}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
