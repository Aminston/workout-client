import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './WeeklyWorkout.css';

const CATEGORY_CLASSES = {
  'Chest & Triceps': 'category-badge--red',
  'Back & Biceps': 'category-badge--cyan',
  'Legs & Shoulders': 'category-badge--green',
  'Core & Functional': 'category-badge--purple',
  'Full-Body': 'category-badge--indigo',
};

export default function WeeklyWorkout({ personalized = [], meta = {} }) {
  function formatDetail(exercise) {
    const parts = [];
    if (exercise.sets != null) parts.push(`${exercise.sets} sets`);
    if (exercise.reps != null) parts.push(`x ${exercise.reps} reps`);
    if (exercise.weight?.value != null) {
      parts.push(`, ${exercise.weight.value} ${exercise.weight.unit}`);
    }
    return parts.join(' ');
  }

  return (
    <div className="accordion workout-container" id="weeklyWorkoutAccordion">
      {personalized.map((day) => {
        const dayId = day.day.replace(/\s+/g, '');
        return (
          <div key={day.day} className="accordion-item">
            <h2 className="accordion-header" id={`heading${dayId}`}>
              <button
                className="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target={`#collapse${dayId}`}
                aria-expanded="false"
                aria-controls={`collapse${dayId}`}
              >
                <span className="accordion-button-label">{day.day}</span>
                <span className={`category-badge ${CATEGORY_CLASSES[day.category] || 'category-badge--default'}`}>
                  {day.category}
                </span>
              </button>
            </h2>
            <div
              id={`collapse${dayId}`}
              className="accordion-collapse collapse"
              aria-labelledby={`heading${dayId}`}
              data-bs-parent="#weeklyWorkoutAccordion"
            >
              <ul className="entry-list p-0 m-0">
                {day.workouts.map((exercise, idx) => {
                  const detail = formatDetail(exercise);
                  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`how to do ${exercise.name}`)}`;

                  return (
                    <li key={idx} className="entry-item">
                      <a
                        href={googleSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="clickable-card"
                      >
                        <span className="exercise-name">{exercise.name}</span>
                        {detail && (
                          <span className="exercise-detail">
                            {detail}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
