import React, { useEffect, useState } from 'react';
import './WeeklyWorkout.css';

const CATEGORY_CLASSES = {
  Chest: 'category-badge--blue',
  Back: 'category-badge--cyan',
  Legs: 'category-badge--green',
  Shoulders: 'category-badge--yellow',
  Arms: 'category-badge--red',
  Core: 'category-badge--purple',
  'Full Body': 'category-badge--indigo',
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
      <div className="program-meta">
        <p className="program-meta__label">
          Active Program: <strong>{meta.program_start}</strong> to <strong>{meta.expires_on}</strong>
        </p>
      </div>

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
