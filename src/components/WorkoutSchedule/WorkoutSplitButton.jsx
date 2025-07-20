// WorkoutSplitButton.jsx - Ultra simple version
import React, { useState } from 'react';

const WorkoutSplitButton = ({ 
  workout, 
  programId, 
  scheduleId, 
  onEdit, 
  onWorkoutUpdate,
  isMobile // Keep for compatibility
}) => {
  const [status, setStatus] = useState(workout?.status || 'pending');
  const [loading, setLoading] = useState(false);

  const startWorkout = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schedule/workout/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        },
        body: JSON.stringify({
          workoutId: workout.workout_id,
          programId,
          scheduleId
        })
      });

      if (response.ok) {
        setStatus('started');
        onWorkoutUpdate?.({ ...workout, status: 'started' });
      }
    } catch (error) {
      console.error('Error starting workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const endWorkout = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schedule/workout/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        },
        body: JSON.stringify({
          workoutId: workout.workout_id,
          programId,
          volume: workout.volume || 0
        })
      });

      if (response.ok) {
        setStatus('completed');
        onWorkoutUpdate?.({ ...workout, status: 'completed' });
      }
    } catch (error) {
      console.error('Error ending workout:', error);
    } finally {
      setLoading(false);
    }
  };

  // Single click handler for everything
  const handleClick = () => {
    if (loading) return;
    
    // If completed, show edit
    if (status === 'completed') {
      onEdit?.();
      return;
    }
    
    // Otherwise handle workout flow
    switch (status) {
      case 'pending':
      case 'paused':
        startWorkout();
        break;
      case 'started':
        endWorkout();
        break;
    }
  };

  const getButtonText = () => {
    if (loading) return 'Loading...';
    
    switch (status) {
      case 'pending': return 'Start';
      case 'started': return 'End';
      case 'paused': return 'Resume';
      case 'completed': return 'Edit';
      default: return 'Start';
    }
  };

  const getButtonClass = () => {
    if (status === 'completed') return 'btn btn-outline-secondary';
    return 'btn btn-accent';
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={getButtonClass()}
    >
      {getButtonText()}
    </button>
  );
};

export default WorkoutSplitButton;