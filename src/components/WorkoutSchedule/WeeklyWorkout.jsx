import React, { useState } from 'react';
import './WeeklyWorkout.css';
import WorkoutEditModal from './WorkoutEditModal';
import { CATEGORY_CLASSES } from '../../../constants/enums';

export default function WeeklyWorkout({ personalized = [], meta = {}, setPersonalized, loadingWorkout = false }) {
  const [selectedWorkout, setSelectedWorkout] = useState(null);

  const formatDetail = ({ sets, reps, weight }) =>
    [sets && `${sets} sets`, reps && `x ${reps} reps`, weight?.value && `${weight.value} ${weight.unit}`]
      .filter(Boolean)
      .join(', ');

  const handleEditClick = (day, workout) =>
    setSelectedWorkout({ ...workout, day, program_id: meta.program_id });

  const getSearchUrl = (name) => `https://www.google.com/search?q=${encodeURIComponent(`how to do ${name}`)}`;

  const handleWorkoutUpdate = (updatedWorkout) => {
    setPersonalized((prev) =>
      prev.map((dayObj) => {
        if (dayObj.day !== updatedWorkout.day) return dayObj;
        return {
          ...dayObj,
          workouts: dayObj.workouts.map((w) =>
            w.workout_id === updatedWorkout.workout_id ? updatedWorkout : w
          ),
        };
      })
    );
    setSelectedWorkout(null);
  };

  return (
    <div className="accordion workout-container" id="weeklyWorkoutAccordion">
      {loadingWorkout && (
        <div className="workout-loading-overlay">
          <div className="spinner-border text-primary" role="status" />
          <span className="loading-text ms-2">Generating your workout...</span>
        </div>
      )}

      {!loadingWorkout && personalized.map(({ day, category, workouts }) => {
        const dayId = day.replace(/\s+/g, '');

        return (
          <div key={day} className="accordion-item">
            <h2 className="accordion-header" id={`heading${dayId}`}>
              <button
                className="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target={`#collapse${dayId}`}
                aria-expanded="false"
                aria-controls={`collapse${dayId}`}
              >
                <span className="accordion-button-label">{day}</span>
                <span className={`category-badge ${CATEGORY_CLASSES[category] || 'category-badge--default'}`}>
                  {category}
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
                {workouts.map((exercise, idx) => {
                  const detail = formatDetail(exercise);
                  return (
                    <li key={idx} className="entry-item">
                      <a
                        href={getSearchUrl(exercise.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="exercise-link"
                      >
                        <span className="exercise-name">{exercise.name}</span>
                        {detail && <span className="exercise-detail">{detail}</span>}
                      </a>
                      <button
                        className="btn-modal-confirm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(day, exercise);
                        }}
                      >
                        Edit
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}

      {selectedWorkout && (
        <WorkoutEditModal
          workout={selectedWorkout}
          onClose={() => setSelectedWorkout(null)}
          onWorkoutUpdate={handleWorkoutUpdate}
        />
      )}
    </div>
  );
}
