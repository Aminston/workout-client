/* WeeklyWorkout.jsx - Fixed with completed workout support */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './WeeklyWorkout.css'; 
import { CATEGORY_CLASSES } from '../../../constants/enums';

export default function WeeklyWorkout({ personalized = [], meta = {}, setPersonalized, loadingWorkout = false }) {
  const navigate = useNavigate();

  // Helper function to get the best session for a specific set
  const getBestSessionForSet = (sessions, setNumber) => {
    const validSessions = sessions.filter(session => 
      session.set_number === setNumber &&
      session.reps !== null &&
      session.weight?.value !== null &&
      session.set_status === 'completed'
    );
    
    if (validSessions.length === 0) return null;
    
    // Priority: unchanged -> increased -> mixed -> reduced
    const priorityOrder = ['unchanged', 'increased', 'mixed', 'reduced'];
    
    for (const modType of priorityOrder) {
      const sessionsOfType = validSessions
        .filter(s => s.modification_type === modType)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      if (sessionsOfType.length > 0) {
        return sessionsOfType[0];
      }
    }
    
    // Fallback: most recent valid session
    return validSessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  };

  // Helper function to check if workout has been started
  const hasWorkoutStarted = (sessions) => {
    return sessions.some(session => 
      session.set_status === 'started' || 
      session.set_status === 'completed'
    );
  };

  // Helper function to calculate workout completion status
  // Make /schedule the single source of truth
  const getWorkoutStatus = (workouts) => {
    let totalSets = 0;
    let completedSets = 0;
    let hasAnyActivity = false;
    let lastActivityDate = null;

    workouts.forEach(workout => {
      totalSets += workout.sets;
      
      // Count completed sets based on sessions
      const allSessions = workout.sessions || [];
      const validSessions = allSessions.filter(session => 
        session.set_number !== null && 
        session.set_status === 'completed'
      );
      
      // Group by set_number to avoid counting duplicates
      const uniqueCompletedSets = new Set(validSessions.map(s => s.set_number));
      completedSets += uniqueCompletedSets.size;
      
      // Check if there's any activity (started or completed sessions)
      if (allSessions.length > 0) {
        hasAnyActivity = true;
        
        // Find the most recent activity
        const workoutLastActivity = Math.max(...allSessions.map(s => new Date(s.created_at).getTime()));
        if (!lastActivityDate || workoutLastActivity > lastActivityDate) {
          lastActivityDate = workoutLastActivity;
        }
      }
    });

    const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
    
    // More nuanced status detection
    const isCompleted = progress === 100;
    const isPartiallyCompleted = progress > 0 && progress < 100;
    const isStarted = hasAnyActivity || progress > 0;
    
    // If we have recent activity but low completion, might be a session sync issue
    const hasRecentActivity = lastActivityDate && (Date.now() - lastActivityDate < 24 * 60 * 60 * 1000); // Within 24 hours
    const mightBeCompleted = hasRecentActivity && progress > 50; // If recent activity and >50%, might be completed
    
    console.log(`📊 Workout Status Analysis:`, {
      totalSets,
      completedSets,
      progress: `${progress.toFixed(1)}%`,
      hasAnyActivity,
      hasRecentActivity,
      mightBeCompleted,
      lastActivityDate: lastActivityDate ? new Date(lastActivityDate).toLocaleString() : null
    });
    
    return {
      totalSets,
      completedSets,
      progress,
      isCompleted,
      isStarted,
      isPartiallyCompleted,
      hasActivity: hasAnyActivity,
      hasRecentActivity,
      mightBeCompleted,
      lastActivityDate
    };
  };

  const handleStartWorkout = (day, category, workouts, workoutStatus) => {
    console.log('🚀 Starting/Reviewing workout with data:', { day, category, workouts, workoutStatus });
    
    try {
      // Transform workouts using session data
      const exercises = workouts.map((workout, index) => {
        console.log('Processing workout:', workout);
        
        const setsCount = workout.sets || 3;
        
        // Create sets with session data if available
        const sets = Array.from({ length: setsCount }, (_, setIndex) => {
          const setNumber = setIndex + 1;
          const bestSession = getBestSessionForSet(workout.sessions || [], setNumber);
          
          return {
            id: setNumber,
            // Use session data if available, otherwise baseline
            reps: bestSession ? bestSession.reps : workout.reps,
            weight: bestSession ? bestSession.weight.value : workout.weight?.value || 0,
            weightUnit: workout.weight?.unit || 'kg',
            status: bestSession ? 'done' : 'pending',
            time: bestSession?.time?.value || null,
            timeUnit: bestSession?.time?.unit || 'seconds',
            
            // Keep baseline for comparison
            baselineReps: workout.reps,
            baselineWeight: workout.weight?.value || 0,
            isModified: bestSession ? bestSession.is_modified : false,
            modificationType: bestSession?.modification_type || 'unchanged',
            
            // Session metadata
            sessionId: bestSession?.session_id || null,
            lastUpdated: bestSession ? new Date(bestSession.created_at) : null,
            
            // Additional fields for WorkoutDetailView
            startTime: bestSession ? new Date(bestSession.created_at) : null,
            endTime: bestSession ? new Date(bestSession.created_at) : null,
            duration: bestSession?.time?.value || null
          };
        });

        // Determine exercise status
        const completedSetsCount = sets.filter(s => s.status === 'done').length;
        const hasStarted = hasWorkoutStarted(workout.sessions || []);
        
        let exerciseStatus = 'pending';
        if (completedSetsCount === sets.length && completedSetsCount > 0) {
          exerciseStatus = 'done';
        } else if (completedSetsCount > 0 || hasStarted) {
          exerciseStatus = 'in-progress';
        }

        console.log('Generated sets for', workout.name, ':', sets);

        return {
          id: workout.scheduleId, // Use scheduleId as exercise ID
          scheduleId: workout.scheduleId,
          name: workout.name,
          category: workout.category,
          type: workout.type,
          sets: sets,
          status: exerciseStatus,
          
          // Additional metadata
          isModified: workout.is_modified,
          totalSessions: (workout.sessions || []).length,
          lastActivity: (workout.sessions || []).length > 0 ? 
            new Date(Math.max(...workout.sessions.map(s => new Date(s.created_at)))) : null
        };
      });

      const workoutDetailData = {
        day: day,
        category: category,
        scheduleId: workouts[0]?.scheduleId,
        exercises: exercises,
        
        // Progress metadata
        totalSets: workoutStatus.totalSets,
        completedSets: workoutStatus.completedSets,
        progressPercentage: workoutStatus.progress,
        
        // Workout state
        isCompleted: workoutStatus.isCompleted,
        isReviewMode: workoutStatus.isCompleted, // Enable review mode for completed workouts
        
        // Program metadata
        programId: meta.program_id,
        programStart: meta.program_start,
        expiresOn: meta.expires_on,
        userName: meta.user_name
      };

      console.log('🎯 Final workout detail data:', workoutDetailData);
      console.log('📊 Workout Status:', workoutStatus);

      // Navigate to workout detail page with data
      navigate('/workout-detail', { 
        state: { 
          workoutData: workoutDetailData,
          meta: meta,
          // Keep original API data for debugging
          originalApiData: { day, category, workouts }
        } 
      });
    } catch (error) {
      console.error('Navigation error:', error);
      alert('Error loading workout. Please try again.');
    }
  };

  return (
    <div className="workout-container">
      {loadingWorkout ? (
        <div className="workout-loading">
          <div className="spinner-border text-primary" role="status" />
          <span className="ms-2">Generating your workout...</span>
        </div>
      ) : (
        <div className="workout-days-container">
          {personalized.map(({ day, category, workouts }) => {
            // Calculate workout status
            const workoutStatus = getWorkoutStatus(workouts);
            
            // Enhanced logging for debugging
            console.log(`📅 ${day} Workout Status:`, {
              ...workoutStatus,
              exercisesWithSessions: workouts.filter(w => w.sessions && w.sessions.length > 0).length,
              totalExercises: workouts.length
            });
            
            return (
              <div key={day} className="workout-day-card">
                {/* Day Header - FIXED STRUCTURE */}
                <div className="day-header">
                  <div className="day-info">
                    <span className="day-title">{day}</span>
                    <span className="workout-summary">{workouts.length} exercises</span>
                  </div>
                  <span className={`category-badge ${CATEGORY_CLASSES[category] || 'category-badge--default'}`}>
                    {category}
                  </span>
                </div>

                {/* Progress bar only - no text */}
                {(workoutStatus.isStarted || workoutStatus.mightBeCompleted) && (
                  <div className="day-progress">
                    <div className="day-progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${workoutStatus.mightBeCompleted ? 100 : workoutStatus.progress}%`,
                          backgroundColor: workoutStatus.isCompleted ? '#10b981' : 
                                         workoutStatus.mightBeCompleted ? '#f59e0b' : 
                                         workoutStatus.isPartiallyCompleted ? '#f59e0b' : '#3b82f6'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <div className="workout-day-footer">
                  <button 
                    className={`start-workout-btn ${
                      workoutStatus.isCompleted ? 'completed' : 
                      workoutStatus.isPartiallyCompleted ? 'partial' :
                      workoutStatus.isStarted ? 'resume' : 'start'
                    }`}
                    onClick={() => handleStartWorkout(day, category, workouts, workoutStatus)}
                  >
                    {workoutStatus.isCompleted 
                      ? '📋 Review Workout' 
                        : workoutStatus.isPartiallyCompleted
                          ? '⚠️ Continue Workout'
                          : workoutStatus.isStarted 
                            ? '▶️ Resume Workout' 
                            : '🏋️ Start Workout'
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}