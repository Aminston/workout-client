import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './WeeklyWorkout.css';

const CATEGORY_CLASSES = {
  'Chest & Triceps':   'category-badge--blue',
  'Back & Biceps':     'category-badge--cyan',
  'Legs & Shoulders':  'category-badge--green',
  'Core & Functional': 'category-badge--purple',
  'Full-Body':         'category-badge--indigo',
};

export default function WeeklyWorkout({ personalized = [], meta = {} }) {
  function formatDetail(ex) {
    if (ex.sets == null && ex.reps == null && ex.weight == null) return '';
    const parts = [];
    if (ex.sets != null) parts.push(`${ex.sets} sets`);
    if (ex.reps != null) parts.push(`x ${ex.reps} reps`);
    if (ex.weight && ex.weight.value != null) {
      parts.push(`, ${ex.weight.value} ${ex.weight.unit}`);
    }
    return parts.join(' ');
  }

  return (
    <div className="accordion" id="weeklyWorkoutAccordion">
      {personalized.map(day => {
        const dayId = day.day.replace(/\s+/g, '');
        return (
          <div key={day.day} className="accordion-item">
            <h2 className="accordion-header" id={`heading${dayId}`}>
              <button
                className="accordion-button collapsed d-flex justify-content-between align-items-center"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target={`#collapse${dayId}`}
                aria-expanded="false"
                aria-controls={`collapse${dayId}`}
              >
                <span>{day.day}</span>
                <span className={`category-badge ms-3 ${CATEGORY_CLASSES[day.category] || 'category-badge--default'}`}>
                  {day.category} Day
                </span>
              </button>
            </h2>
            <div
              id={`collapse${dayId}`}
              className="accordion-collapse collapse"
              aria-labelledby={`heading${dayId}`}
              data-bs-parent="#weeklyWorkoutAccordion"
            >
              <div className="accordion-body p-0">
                <ul className="entry-list">
                  {day.workouts.map((ex, idx) => {
                    const detail = formatDetail(ex);
                    return (
                      <li key={idx} className="entry-item">
                        <div className="exercise-row">
                          <span className="exercise-name">{ex.name}</span>
                          {detail && <span className="exercise-detail">{detail}</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
