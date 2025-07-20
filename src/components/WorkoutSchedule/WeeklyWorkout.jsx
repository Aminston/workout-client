/* WeeklyWorkout.jsx - Simplified layout and div management */
import React, { useState, useEffect } from 'react';
import WorkoutEditModal from './WorkoutEditModal';
import './WeeklyWorkout.css'; 
import WorkoutSplitButton from './WorkoutSplitButton';
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

  const handleWorkoutStatusUpdate = (day, updatedWorkout) => {
    setPersonalized((prev) =>
      prev.map((dayObj) => {
        if (dayObj.day !== day) return dayObj;
        return {
          ...dayObj,
          workouts: dayObj.workouts.map((w) =>
            w.workout_id === updatedWorkout.workout_id ? { ...w, ...updatedWorkout } : w
          ),
        };
      })
    );
  };

  if (loadingWorkout) {
    return (
      <div className="workout-loading">
        <div className="spinner-border text-primary" role="status" />
        <span className="ms-2">Generating your workout...</span>
      </div>
    );
  }

  return (
    <div className="workout-container">
      <div className="accordion" id="weeklyWorkoutAccordion">
        {personalized.map(({ day, category, workouts }) => {
          const dayId = day.replace(/\s+/g, '');

          return (
            <div key={day} className="accordion-item">
              {/* Day Header */}
              <div className="accordion-header">
                <button
                  className="accordion-button collapsed"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target={`#collapse${dayId}`}
                  aria-expanded="false"
                  aria-controls={`collapse${dayId}`}
                >
                  <span className="day-title">{day}</span>
                  <span className={`category-badge ${CATEGORY_CLASSES[category] || 'category-badge--default'}`}>
                    {category}
                  </span>
                </button>
              </div>

              {/* Day Content */}
              <div
                id={`collapse${dayId}`}
                className="accordion-collapse collapse"
                data-bs-parent="#weeklyWorkoutAccordion"
              >
                <div className="accordion-body">
                  {workouts.map((exercise, idx) => (
                    <div key={idx} className="exercise-card">
                      {/* Exercise Info */}
                      <div className="exercise-info">
                        <a
                          href={getSearchUrl(exercise.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="exercise-name"
                        >
                          {exercise.name}
                        </a>
                        {formatDetail(exercise) && (
                          <div className="exercise-detail">
                            {formatDetail(exercise)}
                          </div>
                        )}
                      </div>

                      {/* Exercise Action */}
                      <div className="exercise-action">
                        <WorkoutSplitButton
                          workout={exercise}
                          programId={meta.program_id}
                          scheduleId={meta.schedule_id}
                          onEdit={() => handleEditClick(day, exercise)}
                          onWorkoutUpdate={(updatedWorkout) => handleWorkoutStatusUpdate(day, updatedWorkout)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

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