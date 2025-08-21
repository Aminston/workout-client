/* WeeklyWorkout.jsx - Updated for New Day_Number Format with Rest Days */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './WeeklyWorkout.css';

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
  const getWorkoutStatus = (workouts) => {
    let totalSets = 0;
    let completedSets = 0;
    let hasAnyActivity = false;
    let lastActivityDate = null;

    workouts.forEach(workout => {
      totalSets += workout.sets || 0;
      
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
    
    return {
      totalSets,
      completedSets,
      progress: Math.round(progress),
      isCompleted: progress >= 100,
      isPartiallyCompleted: progress > 0 && progress < 100,
      isStarted: hasAnyActivity,
      mightBeCompleted: progress >= 80, // Consider 80%+ as potentially completed
      lastActivity: lastActivityDate ? new Date(lastActivityDate) : null
    };
  };

  // Generate complete schedule including rest days
  const generateCompleteSchedule = (workoutDays) => {
    if (!workoutDays || workoutDays.length === 0) return [];

    // Find the maximum day_number to determine total days in split
    const maxDayNumber = Math.max(...workoutDays.map(day => day.day_number));
    const completeSchedule = [];

    // Generate all days from 1 to maxDayNumber
    for (let dayNum = 1; dayNum <= maxDayNumber; dayNum++) {
      const workoutDay = workoutDays.find(day => day.day_number === dayNum);
      
      if (workoutDay) {
        // This is a workout day
        completeSchedule.push({
          day_number: dayNum,
          day_name: workoutDay.day_name,
          workouts: workoutDay.workouts,
          isRestDay: false
        });
      } else {
        // This is a rest day (missing from workout data)
        completeSchedule.push({
          day_number: dayNum,
          day_name: 'Rest Day',
          workouts: [],
          isRestDay: true
        });
      }
    }

    return completeSchedule;
  };

  // Handle workout/rest day navigation
  const handleDayClick = (dayData) => {
    if (dayData.isRestDay) {
      // Could navigate to rest day info or just return
      console.log('Rest day clicked - no action needed');
      return;
    }

    try {
      const workouts = dayData.workouts || [];
      const workoutStatus = getWorkoutStatus(workouts);

      // Generate exercise data for WorkoutDetailView
      const exercises = workouts.map((workout, index) => {
        const sets = [];
        const maxSets = workout.sets || 3; // Default to 3 sets if not specified
        
        for (let i = 1; i <= maxSets; i++) {
          const bestSession = getBestSessionForSet(workout.sessions || [], i);
          sets.push({
            setNumber: i,
            targetReps: workout.reps || 12,
            targetWeight: workout.weight?.value || 0,
            actualReps: bestSession?.reps || null,
            actualWeight: bestSession?.weight?.value || null,
            status: bestSession ? 'done' : 'pending',
            isModified: bestSession?.is_modified || false,
            modificationType: bestSession?.modification_type || 'unchanged',
            sessionId: bestSession?.session_id || null,
            lastUpdated: bestSession ? new Date(bestSession.created_at) : null,
            startTime: bestSession ? new Date(bestSession.created_at) : null,
            endTime: bestSession ? new Date(bestSession.created_at) : null,
            duration: bestSession?.time?.value || null
          });
        }

        const completedSetsCount = sets.filter(s => s.status === 'done').length;
        const hasStarted = hasWorkoutStarted(workout.sessions || []);
        
        let exerciseStatus = 'pending';
        if (completedSetsCount === sets.length && completedSetsCount > 0) {
          exerciseStatus = 'done';
        } else if (completedSetsCount > 0 || hasStarted) {
          exerciseStatus = 'in-progress';
        }

        return {
          id: workout.scheduleId || `temp-${index}`,
          scheduleId: workout.scheduleId,
          name: workout.name,
          category: workout.category,
          type: workout.type,
          sets: sets,
          status: exerciseStatus,
          isModified: workout.is_modified,
          totalSessions: (workout.sessions || []).length,
          lastActivity: (workout.sessions || []).length > 0 ? 
            new Date(Math.max(...workout.sessions.map(s => new Date(s.created_at)))) : null
        };
      });

      const workoutDetailData = {
        day: dayData.day_name, // Use day_name instead of calendar day
        category: '', // Remove category since we're not using it
        scheduleId: workouts[0]?.scheduleId,
        exercises: exercises,
        
        // Progress metadata
        totalSets: workoutStatus.totalSets,
        completedSets: workoutStatus.completedSets,
        progressPercentage: workoutStatus.progress,
        
        // Workout state
        isCompleted: workoutStatus.isCompleted,
        isReviewMode: workoutStatus.isCompleted,
        
        // Program metadata
        programId: meta.program_id,
        programStart: meta.program_start,
        expiresOn: meta.expires_on,
        userName: meta.user_name
      };

      console.log('🎯 Navigating to workout:', workoutDetailData);

      // Navigate to workout detail page
      navigate('/workout-detail', { 
        state: { 
          workoutData: workoutDetailData,
          meta: meta,
          originalApiData: dayData
        } 
      });
    } catch (error) {
      console.error('Navigation error:', error);
      alert('Error loading workout. Please try again.');
    }
  };

  // Generate complete schedule with rest days
  const completeSchedule = generateCompleteSchedule(personalized);

  return (
    <div className="workout-container">
      {loadingWorkout ? (
        <div className="workout-loading">
          <div className="spinner-border text-primary" role="status" />
          <span className="ms-2">Generating your workout...</span>
        </div>
      ) : (
        <div className="workout-days-container">
          {completeSchedule.map((dayData) => {
            if (dayData.isRestDay) {
              // REST DAY CARD - Compact version
              return (
                <div key={dayData.day_number} className="workout-day-card rest-day-card">
                  <div className="day-header">
                    <div className="day-info">
                      <span className="day-title">{dayData.day_name}</span>
                    </div>
                  </div>
                  
                  <div className="workout-day-footer">
                    <button className="rest-day-btn" disabled>
                      🛌 Rest Day
                    </button>
                  </div>
                </div>
              );
            }

            // WORKOUT DAY CARD
            const workouts = dayData.workouts || [];
            const workoutStatus = getWorkoutStatus(workouts);
            
            return (
              <div key={dayData.day_number} className="workout-day-card">
                {/* Day Header - Clean with descriptive name as title */}
                <div className="day-header">
                  <div className="day-info">
                    <span className="day-title">{dayData.day_name}</span>
                    <span className="workout-summary">{workouts.length} exercises</span>
                  </div>
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
                    onClick={() => handleDayClick(dayData)}
                  >
                    {workoutStatus.isCompleted 
                      ? '📋 Review Workout' 
                      : workoutStatus.isPartiallyCompleted
                        ? '⚡ Continue Workout'
                        : workoutStatus.isStarted
                          ? '🔥 Resume Workout'
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