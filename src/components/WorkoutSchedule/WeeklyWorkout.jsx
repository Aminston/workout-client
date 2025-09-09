/* WeeklyWorkout.jsx - Updated with ProfileOnboardingModal */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileOnboardingModal from '../ProfileOnboardingModal/ProfileOnboardingModal';
import './WeeklyWorkout.css';

export default function WeeklyWorkout({ 
  personalized = [], 
  meta = {}, 
  setPersonalized, 
  loadingWorkout = false,
  onRefreshSchedule // Add this prop to trigger schedule refresh
}) {
  const navigate = useNavigate();
  const [ctaLoading, setCtaLoading] = useState(false);
  const [ctaError, setCtaError] = useState(null);
  const [ctaDismissed, setCtaDismissed] = useState(false);

  // ✅ NEW: Profile completion modal state
  const [showProfileModal, setShowProfileModal] = useState(false);

  // ✅ NEW: Check if profile is incomplete on component mount/update
  React.useEffect(() => {
    if (meta?.profile_complete === false && !showProfileModal) {
      setShowProfileModal(true);
    }
  }, [meta?.profile_complete]);

  // ✅ NEW: Handle profile completion
  const handleProfileComplete = async () => {
    setShowProfileModal(false);
    
    // Refresh schedule to get updated data
    if (onRefreshSchedule) {
      await onRefreshSchedule(null, 'profile-completed');
    }
  };

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
      mightBeCompleted: progress >= 80,
      lastActivity: lastActivityDate ? new Date(lastActivityDate) : null
    };
  };

  // Generate complete schedule including rest days
  const generateCompleteSchedule = (workoutDays) => {
    if (!workoutDays || workoutDays.length === 0) return [];

    const maxDayNumber = Math.max(...workoutDays.map(day => day.day_number));
    const completeSchedule = [];

    for (let dayNum = 1; dayNum <= maxDayNumber; dayNum++) {
      const workoutDay = workoutDays.find(day => day.day_number === dayNum);
      
      if (workoutDay) {
        completeSchedule.push({
          day_number: dayNum,
          day_name: workoutDay.day_name,
          workouts: workoutDay.workouts,
          isRestDay: false
        });
      } else {
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

  // Enhanced CTA handler with better UX
  const handleCustomWorkoutCTA = async () => {
    const token = localStorage.getItem('jwt_token');
    
    if (!token) {
      setCtaError('Please login first to get your custom workout');
      return;
    }

    setCtaLoading(true);
    setCtaError(null);

    try {
      console.log('🎯 Requesting custom workout generation...');
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/personalize/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate workout`);
      }

      const result = await response.json();
      console.log('✅ Custom workout generated successfully:', result);

      // Show success message briefly before reload
      setCtaError(null);
      
      // Add a small delay for better UX feedback
      setTimeout(() => {
        window.location.reload();
      }, 500);

    } catch (error) {
      console.error('❌ Custom workout generation failed:', error);
      setCtaError(error.message || 'Failed to generate custom workout. Please try again.');
    } finally {
      setCtaLoading(false);
    }
  };

  // Handle workout/rest day navigation
  const handleDayClick = (dayData) => {
    if (dayData.isRestDay) {
      console.log('Rest day clicked - no action needed');
      return;
    }

    try {
      const workouts = dayData.workouts || [];
      const workoutStatus = getWorkoutStatus(workouts);

      // Generate exercise data for WorkoutDetailView
      const exercises = workouts.map((workout, index) => {
        const sets = [];
        const maxSets = workout.sets || 3;
        
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
        day: dayData.day_name,
        category: '',
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

  // Determine if CTA should be shown - FIXED LOGIC
  // Only show CTA when user has a BASE workout (is_custom_workout: false)
  const shouldShowCTA = !ctaDismissed && 
    meta?.program_id && // Only show when we have actual data
    !meta?.is_custom_workout &&
    meta?.profile_complete; // ✅ NEW: Only show CTA if profile is complete

  return (
    <div className="workout-container">
      {/* ✅ NEW: Profile Onboarding Modal */}
      <ProfileOnboardingModal
        show={showProfileModal}
        onComplete={handleProfileComplete}
        missingFields={meta?.missing_profile_fields || []}
        missingFieldsDisplay={meta?.missing_profile_fields_display || []}
      />

      {/* Enhanced Spam CTA - Only show for base workouts with complete profile */}
      {shouldShowCTA && (
        <div className="spam-cta-container" role="banner" aria-label="Custom workout promotion">
          <div className="spam-cta-card">
            <button 
              className="spam-cta-dismiss"
              onClick={() => setCtaDismissed(true)}
              aria-label="Dismiss custom workout promotion"
              title="Dismiss"
            >
              ×
            </button>
            
            <div className="spam-cta-content">
              <div className="spam-cta-icon">
                🎯
              </div>
              
              <div className="spam-cta-text">
                <h3 className="spam-cta-title">Personaliza tu entrenamiento</h3>
                <p className="spam-cta-subtitle">
                  Rutinas personalizadas con IA adaptadas a tus objetivos y experiencia
                </p>
              </div>
              
              <button
                className={`spam-cta-button ${ctaLoading ? 'loading' : ''}`}
                onClick={handleCustomWorkoutCTA}
                disabled={ctaLoading}
                aria-label="Generate custom workout plan"
              >
                {ctaLoading ? (
                  <>
                    <div className="spinner" />
                    Generando...
                  </>
                ) : (
                  'Crear Plan Personalizado'
                )}
              </button>
            </div>
            
            {ctaError && (
              <div className="spam-cta-error" role="alert">
                <span className="error-icon">⚠️</span>
                {ctaError}
              </div>
            )}
          </div>
        </div>
      )}

      {loadingWorkout ? (
        <div className="workout-loading">
          <div className="spinner-border text-primary" role="status" />
          <span className="ms-2">Generando tu entrenamiento…</span>
        </div>
      ) : (
        <div className="workout-days-container">
          {completeSchedule.map((dayData) => {
            if (dayData.isRestDay) {
              // REST DAY CARD
              return (
                <div key={dayData.day_number} className="workout-day-card rest-day-card">
                  <div className="day-header">
                    <div className="day-info">
                      <span className="day-title">{dayData.day_name}</span>
                    </div>
                  </div>
                  <div className="workout-day-footer">
                    <button className="rest-day-btn" disabled>
                      🛌 Día de Descanso
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
                {/* Day Header */}
                <div className="day-header">
                  <div className="day-info">
                    <span className="day-title">{dayData.day_name}</span>
                    <span className="workout-summary">{workouts.length} ejercicios</span>
                  </div>
                </div>

                {/* Progress bar */}
                {(workoutStatus.isStarted || workoutStatus.mightBeCompleted) && (
                  <div className="day-progress">
                    <div className="day-progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${workoutStatus.mightBeCompleted ? 100 : workoutStatus.progress}%`,
                          backgroundColor: workoutStatus.isCompleted
                            ? '#10b981'
                            : workoutStatus.mightBeCompleted
                            ? '#f59e0b'
                            : workoutStatus.isPartiallyCompleted
                            ? '#f59e0b'
                            : '#3b82f6'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <div className="workout-day-footer">
                  <button
                    className={`start-workout-btn ${
                      workoutStatus.isCompleted
                        ? 'completed'
                        : workoutStatus.isPartiallyCompleted
                        ? 'partial'
                        : workoutStatus.isStarted
                        ? 'resume'
                        : 'start'
                    }`}
                    onClick={() => handleDayClick(dayData)}
                  >
                    {workoutStatus.isCompleted
                      ? 'Revisar'
                      : workoutStatus.isPartiallyCompleted
                      ? 'Continuar'
                      : workoutStatus.isStarted
                      ? 'Reanudar'
                      : 'Iniciar'}
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