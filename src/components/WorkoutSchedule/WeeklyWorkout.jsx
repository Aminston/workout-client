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

  useEffect(() => {
    fetch('http://localhost:3000/weekly-schedule')
      .then((res) => res.json())
      .then((data) => setSchedule(data))
      .catch((err) => console.error('Failed to fetch workouts:', err));
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
