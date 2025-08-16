import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './WorkoutDetailView.css';
import { 
  transformWorkoutData, 
  updateWorkoutWithSession, 
  generatePerformedSets, 
  calculateProgress, 
  validateWorkoutData,
  weightConverter 
} from "./workoutUtils";

export default function WorkoutDetailView({ onWorkoutComplete }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Core state
  const [exercises, setExercises] = useState([]);
  const [totalSets, setTotalSets] = useState(0);
  const [completedSets, setCompletedSets] = useState(0);
  const [workoutData, setWorkoutData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('not_started');
  const [performedSets, setPerformedSets] = useState([]);

  // UI state
  const [editingCell, setEditingCell] = useState(null);
  const [useMetric, setUseMetric] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving', 'saved', 'error'

  // Timers
  const pauseTimerRef = useRef(null);

  // API Helpers
  const getApiUrl = (endpoint) => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    return `${baseUrl}${endpoint}`;
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('jwt_token') || localStorage.getItem('X-API-Token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  // Calculate elapsed time for a set
  const calculateElapsedTime = (startTime, endTime) => {
    if (!startTime || !endTime) return null;
    const start = new Date(startTime);
    const end = new Date(endTime);
    const elapsedMs = end - start;
    return Math.round(elapsedMs / 100) / 10; // Round to 1 decimal place
  };

  // Simple elapsed time formatter
  const formatElapsedTime = (elapsedTime) => {
    if (!elapsedTime) return '-';
    if (elapsedTime < 60) {
      return elapsedTime % 1 === 0 ? `${elapsedTime}s` : `${elapsedTime.toFixed(1)}s`;
    } else {
      const minutes = Math.floor(elapsedTime / 60);
      const seconds = Math.round(elapsedTime % 60);
      return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
    }
  };

  // Enhanced handleManualSave with elapsed time support
  const handleManualSave = async () => {
    if (!hasUnsavedChanges || isSaving) return;
    
    console.log('💾 Manual save initiated...');
    setIsSaving(true);
    setSaveStatus('saving');
    
    const token = localStorage.getItem('jwt_token') || localStorage.getItem('X-API-Token');
    
    if (!token) {
      console.log('🔧 Mock mode: Would save bulk changes');
      setHasUnsavedChanges(false);
      setIsSaving(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    try {
      // Get all exercises with completed sets that need saving
      const exercisesToSave = exercises.filter(exercise => {
        const setsToSave = exercise.sets.filter(set => {
          const isNewlyCompleted = set.status === 'done' && !set.isFromSession;
          const isModified = set.isModified === true;
          return isNewlyCompleted || isModified;
        });
        return setsToSave.length > 0;
      });

      if (exercisesToSave.length === 0) {
        console.log('⏭️ No exercises need saving');
        setHasUnsavedChanges(false);
        setIsSaving(false);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 3000);
        return;
      }

      console.log(`💾 Bulk saving ${exercisesToSave.length} exercises with changes`);

      // Build bulk workoutSessions array with elapsed time
      const workoutSessions = exercisesToSave.map(exercise => {
        const setsToSave = exercise.sets.filter(set => {
          const isNewlyCompleted = set.status === 'done' && !set.isFromSession;
          const isModified = set.isModified === true;
          return isNewlyCompleted || isModified;
        });
        
        const performedSets = setsToSave.map(set => {
          // Calculate and include elapsed time
          const elapsedTime = calculateElapsedTime(set.startTime, set.completedAt);
          
          const performedSet = {
            setNumber: set.id,
            reps: set.reps,
            weight: set.weight,
            weightUnit: set.weightUnit || 'kg'
          };

          // Add elapsed time if available
          if (elapsedTime !== null) {
            performedSet.elapsedTime = elapsedTime;
            console.log(`⏱️ Set ${set.id} elapsed time: ${elapsedTime}s`);
          }

          return performedSet;
        });

        console.log(`📤 Preparing ${exercise.name} with ${performedSets.length} sets:`, performedSets);

        return {
          scheduleId: exercise.scheduleId,
          status: 'completed',
          performedSets: performedSets
        };
      });

      // Single bulk API call
      console.log('🌐 Making SINGLE bulk API call with workoutSessions:', workoutSessions);
      
      const response = await fetch(getApiUrl('/sessions/save'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          workoutSessions: workoutSessions
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Bulk save failed: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Save successful:', result);
      
      // Handle both single workout and bulk workout response formats
      let sessions;
      let totalVolume;
      
      if (result.success && result.sessions) {
        // Bulk response format
        sessions = result.sessions;
        totalVolume = result.totalVolume;
        console.log(`📊 Bulk save stats: ${result.totalSessions} sessions, total volume: ${totalVolume}`);
      } else if (result.scheduleId && result.savedSets) {
        // Single workout response format - wrap it in array
        sessions = [result];
        totalVolume = result.totalVolume;
        console.log(`📊 Single save stats: 1 session, total volume: ${totalVolume}`);
      } else {
        throw new Error('Invalid save response format');
      }
      
      // Update UI to mark sets as saved and preserve elapsed time from API response
      setExercises(prev => prev.map(exercise => {
        const exerciseResult = sessions.find(session => session.scheduleId === exercise.scheduleId);
        if (!exerciseResult) return exercise;
        
        console.log(`🔄 Updating UI for ${exercise.name} - ${exerciseResult.savedSets.length} sets saved`);
        
        const updatedSets = exercise.sets.map(set => {
          // Check if this set was saved
          const savedSet = exerciseResult.savedSets.find(savedSet => savedSet.setNumber === set.id);
          if (!savedSet) return set;
          
          return {
            ...set,
            isModified: false,
            lastSaved: new Date().toISOString(),
            isFromSession: set.status === 'done' ? true : set.isFromSession,
            // Preserve elapsed time from API response
            elapsedTime: savedSet.elapsedTime || set.elapsedTime || calculateElapsedTime(set.startTime, set.completedAt)
          };
        });
        
        return { ...exercise, sets: updatedSets };
      }));
      
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      console.log(`✅ Bulk save completed successfully - saved ${sessions.length} exercises`);
      
      setTimeout(() => setSaveStatus(null), 3000);
      
    } catch (error) {
      console.error('❌ Failed to bulk save changes:', error);
      setSaveStatus('error');
      alert(`Failed to save workout: ${error.message}`);
      setTimeout(() => setSaveStatus(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Simple warning on page leave if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved workout data. Make sure to save before leaving!';
        return 'You have unsaved workout data. Make sure to save before leaving!';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Enhanced: Fetch fresh data with elapsed time support
  useEffect(() => {
    let isMounted = true;
    
    const initializeWorkout = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔍 Location state:', location.state);

        // Get data from different possible sources - prefer raw API data
        const rawApiData = location.state?.originalApiData;
        const workoutData = location.state?.workoutData;
        const dayData = location.state?.dayData;
        
        console.log('🔍 DEBUG: Available data sources:', { 
          rawApiData: !!rawApiData, 
          workoutData: !!workoutData,
          dayData: !!dayData 
        });

        // Method 1: Use raw API data (new format)
        if (rawApiData && rawApiData.workouts) {
          console.log('✅ Method 1: Using raw API data');
          
          const processed = processRawApiData(rawApiData);
          
          if (!isMounted) return;

          setWorkoutData({
            day: processed.day,
            category: processed.category
          });
          setExercises(processed.exercises);
          setTotalSets(processed.totalSets);
          setCompletedSets(processed.completedSets);
          setLoading(false);
          return;
        }

        // Method 2: Use direct day data (new format)
        if (dayData && dayData.workouts) {
          console.log('✅ Method 2: Using day data');
          
          const processed = processRawApiData(dayData);
          
          if (!isMounted) return;

          setWorkoutData({
            day: processed.day,
            category: processed.category
          });
          setExercises(processed.exercises);
          setTotalSets(processed.totalSets);
          setCompletedSets(processed.completedSets);
          setLoading(false);
          return;
        }

        // Method 3: Use pre-transformed exercises data (old format)
        if (workoutData && workoutData.exercises && Array.isArray(workoutData.exercises)) {
          console.log('✅ Method 3: Using pre-transformed exercises data');
          
          if (!isMounted) return;

          setWorkoutData({
            day: workoutData.day,
            category: workoutData.category
          });
          setExercises(workoutData.exercises);
          
          const totalSetsCount = workoutData.exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
          const completedSetsCount = workoutData.exercises.reduce((sum, ex) => 
            sum + (ex.sets?.filter(s => s.status === 'done').length || 0), 0);
          
          setTotalSets(totalSetsCount);
          setCompletedSets(completedSetsCount);
          setLoading(false);
          return;
        }

        // Method 4: Create fallback workout for testing
        console.log('⚠️ Method 4: Using fallback data (no valid data source found)');
        
        const fallbackWorkoutData = {
          day: "Monday",
          category: "Chest & Triceps"
        };

        const fallbackExercise = {
          id: 4068,
          scheduleId: 4068,
          workout_id: 207,
          name: "Tempo Bench Press",
          category: "Chest",
          type: "Accessory",
          sets: [
            { id: 1, reps: 8, weight: 60, weightUnit: 'kg', status: 'pending', isFromSession: false, duration: null, elapsedTime: null },
            { id: 2, reps: 8, weight: 60, weightUnit: 'kg', status: 'pending', isFromSession: false, duration: null, elapsedTime: null },
            { id: 3, reps: 8, weight: 60, weightUnit: 'kg', status: 'pending', isFromSession: false, duration: null, elapsedTime: null },
            { id: 4, reps: 8, weight: 60, weightUnit: 'kg', status: 'pending', isFromSession: false, duration: null, elapsedTime: null }
          ],
          status: 'pending'
        };

        if (!isMounted) return;

        setWorkoutData(fallbackWorkoutData);
        setExercises([fallbackExercise]);
        setTotalSets(4);
        setCompletedSets(0);
        setLoading(false);

      } catch (error) {
        console.error('❌ Failed to initialize workout:', error);
        if (isMounted) {
          setError(error.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeWorkout();
    
    return () => {
      isMounted = false;
    };
  }, [location.state]);

  // Process raw API data (new format)
  const processRawApiData = (apiData) => {
    console.log('🔄 Processing raw API data:', apiData);

    let totalSetCount = 0;
    let completedSetCount = 0;

    const processedExercises = apiData.workouts.map(workout => {
      console.log(`🔄 Processing: ${workout.name}`);
      
      // Create session lookup by set_number, handling duplicates
      const sessionsBySetNumber = {};
      if (workout.sessions && workout.sessions.length > 0) {
        workout.sessions.forEach(session => {
          // Only use sessions with actual set_number and completed status
          if (session.set_number !== null && session.set_status === 'completed') {
            // Handle duplicate sessions - keep the most recent one
            const existingSession = sessionsBySetNumber[session.set_number];
            if (!existingSession || new Date(session.created_at) > new Date(existingSession.created_at)) {
              sessionsBySetNumber[session.set_number] = session;
            }
          }
        });
        console.log(`📋 Session lookup for ${workout.name}:`, sessionsBySetNumber);
      }

      // Build sets array merging base program with session data
      const sets = [];
      const totalSets = workout.sets || 3;
      totalSetCount += totalSets;
      
      for (let setNum = 1; setNum <= totalSets; setNum++) {
        const session = sessionsBySetNumber[setNum];
        
        if (session) {
          sets.push({
            id: setNum,
            reps: session.reps,
            weight: weightConverter.normalize(session.weight) || 0,
            weightUnit: session.weight?.unit || 'kg',
            time: session.time?.value || null,
            duration: session.time?.value || null,
            // Include elapsed time from session
            elapsedTime: session.elapsed_time || null,
            status: 'done',
            completedAt: session.created_at,
            isFromSession: true
          });
          completedSetCount++;
          console.log(`✅ Set ${setNum} marked as DONE for ${workout.name} with elapsed time: ${session.elapsed_time}s`);
        } else {
          console.log(`⏸️ No session found for set ${setNum}, using base workout data`);
          sets.push({
            id: setNum,
            reps: workout.reps || 10,
            weight: weightConverter.normalize(workout.weight) || 0,
            weightUnit: workout.weight?.unit || 'kg',
            time: null,
            duration: null,
            elapsedTime: null, // No elapsed time for pending sets
            status: 'pending',
            completedAt: null,
            isFromSession: false
          });
        }
      }

      const exercise = {
        id: workout.scheduleId,
        scheduleId: workout.scheduleId,
        workout_id: workout.workout_id,
        name: workout.name,
        category: workout.category || apiData.category,
        type: workout.type,
        sets: sets,
        status: sets.every(s => s.status === 'done') ? 'done' : 
               sets.some(s => s.status === 'done') ? 'in-progress' : 'pending'
      };

      return exercise;
    });

    return {
      day: apiData.day_name || apiData.day,
      category: apiData.day_name || apiData.category,
      exercises: processedExercises,
      totalSets: totalSetCount,
      completedSets: completedSetCount
    };
  };

  // Simple set action handler with elapsed time tracking
  const handleSetAction = (exerciseId, setId, action) => {
    console.log(`🎯 Set action: ${action} for exercise ${exerciseId}, set ${setId}`);
    
    setExercises(prev => {
      const newExercises = prev.map(exercise => {
        if (exercise.id !== exerciseId) return exercise;
        
        const updatedSets = exercise.sets.map(set => {
          if (set.id !== setId) return set;
          
          if (action === 'start') {
            console.log(`▶️ Starting set ${setId} for ${exercise.name}`);
            return { ...set, status: 'in-progress', startTime: new Date().toISOString() };
          }
          if (action === 'complete') {
            const endTime = new Date().toISOString();
            // Calculate elapsed time more precisely
            const elapsedTime = calculateElapsedTime(set.startTime, endTime);
            
            console.log(`✅ Completing set ${setId} for ${exercise.name} - elapsed time: ${elapsedTime}s`);
            
            // Mark as having unsaved changes when completing a set
            setHasUnsavedChanges(true);
            
            return { 
              ...set, 
              status: 'done', 
              isFromSession: false, // Mark as NOT from session (newly completed)
              elapsedTime, // Store calculated elapsed time
              completedAt: endTime
            };
          }
          return set;
        });
        
        // Update exercise status
        const completedSets = updatedSets.filter(s => s.status === 'done');
        let exerciseStatus = 'pending';
        if (completedSets.length === updatedSets.length && updatedSets.length > 0) {
          exerciseStatus = 'done';
        } else if (completedSets.length > 0) {
          exerciseStatus = 'in-progress';
        }
        
        return { ...exercise, sets: updatedSets, status: exerciseStatus };
      });
      
      return newExercises;
    });

    // Update counters
    setTimeout(() => {
      const allSets = exercises.flatMap(ex => ex.sets);
      const doneSets = allSets.filter(set => set.status === 'done');
      setCompletedSets(doneSets.length);
    }, 100);
  };

  // Render editable cell with proper lbs input handling
  const renderEditableCell = (exercise, set, field) => {
    const isEditing = editingCell?.exerciseId === exercise.id && 
                     editingCell?.setId === set.id && 
                     editingCell?.field === field;
    
    if (isEditing) {
      let displayValue;
      if (field === 'weight') {
        // Show the value in the user's preferred unit
        displayValue = useMetric 
          ? set.weight 
          : Math.round(weightConverter.kgToLbs(set.weight || 0));
      } else {
        displayValue = set[field];
      }
        
      return (
        <input
          type="number"
          className="table-cell-input"
          defaultValue={displayValue}
          autoFocus
          onFocus={e => e.target.select()}
          onBlur={e => {
            const value = e.target.value;
            handleCellEdit(exercise.id, set.id, field, value);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const value = e.target.value;
              handleCellEdit(exercise.id, set.id, field, value);
            }
            if (e.key === 'Escape') {
              setEditingCell(null);
            }
          }}
          min="0"
          step={field === 'weight' ? (useMetric ? '0.5' : '1') : '1'}
          placeholder={field === 'weight' ? (useMetric ? 'kg' : 'lbs') : 'reps'}
        />
      );
    }
    
    // Display value based on field and unit preference
    let displayValue;
    if (field === 'weight') {
      displayValue = weightConverter.display(set.weight, useMetric);
    } else {
      displayValue = set[field] || '-';
    }
    
    let className = `editable-cell ${set.isFromSession ? 'from-session' : 'from-base'}`;
    if (set.isModified) className += ' modified';
    
    let title = `Click to edit ${field}. Current value: ${displayValue}${set.status === 'done' ? ' (completed set)' : ''}`;
    
    return (
      <span
        className={className}
        onClick={() => handleCellClick(exercise.id, set.id, field)}
        title={title}
      >
        {displayValue}
      </span>
    );
  };

  // Allow editing all sets - no restrictions
  const handleCellClick = (exerciseId, setId, field) => {
    setEditingCell({ exerciseId, setId, field });
  };

  // Handle edit without immediate saving - FIXED for proper lbs handling
  const handleCellEdit = async (exerciseId, setId, field, value) => {
    console.log(`✏️ Editing ${field} for exercise ${exerciseId}, set ${setId}: ${value} (unit: ${useMetric ? 'kg' : 'lbs'})`);
    
    // Basic value validation
    let processedValue;
    if (field === 'weight') {
      if (useMetric) {
        // User entered kg - store as kg with 0.5 precision
        processedValue = Math.max(0, parseFloat(value) || 0);
        processedValue = Math.round(processedValue * 2) / 2; // Round to nearest 0.5
      } else {
        // User entered lbs - convert to kg for internal storage
        const lbsValue = Math.max(0, parseInt(value) || 0);
        processedValue = weightConverter.lbsToKg(lbsValue);
        console.log(`💡 User entered ${lbsValue} lbs → converting to ${processedValue} kg for storage`);
      }
    } else if (field === 'reps') {
      processedValue = Math.max(0, parseInt(value) || 0);
    } else {
      processedValue = value;
    }
    
    // Update local state only
    setExercises(prev => prev.map(exercise => {
      if (exercise.id !== exerciseId) return exercise;
      
      const updatedSets = exercise.sets.map(set => {
        if (set.id !== setId) return set;
        
        const updatedSet = { ...set, isModified: true };
        
        if (field === 'weight') {
          updatedSet.weight = processedValue; // Always stored in kg internally
          console.log(`📝 Set ${setId} weight updated: ${processedValue} kg (display: ${weightConverter.display(processedValue, useMetric)})`);
        } else if (field === 'reps') {
          updatedSet.reps = processedValue;
        }
        
        return updatedSet;
      });
      
      return { ...exercise, sets: updatedSets };
    }));
    
    setEditingCell(null);
    setHasUnsavedChanges(true);
    
    console.log(`✅ ${field} updated successfully for set ${setId}`);
  };

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }
    };
  }, []);

  // Simple render helpers
  const getActionButton = (set, exerciseId, setId) => {
    if (set.status === 'done') {
      return <span className="status-badge status-done">Done</span>;
    }
    
    if (set.status === 'in-progress') {
      return (
        <button
          className="btn btn-warning btn-sm"
          onClick={() => handleSetAction(exerciseId, setId, 'complete')}
        >
          End
        </button>
      );
    }
    
    return (
      <button
        className="btn btn-success btn-sm"
        onClick={() => handleSetAction(exerciseId, setId, 'start')}
      >
        Start
      </button>
    );
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      const shouldLeave = window.confirm('You have unsaved changes. Are you sure you want to leave without saving?');
      if (!shouldLeave) return;
    }
    navigate('/schedule');
  };

  // Render
  if (loading) {
    return (
      <div className="workout-detail-container">
        <div className="workout-loading">
          <div className="spinner-border text-primary" role="status" />
          <span className="ms-2">Loading workout...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workout-detail-container">
        <div className="workout-error">
          <h3>❌ Error Loading Workout</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={handleBack}>
            Back to Schedule
          </button>
        </div>
      </div>
    );
  }

  if (!workoutData) {
    return (
      <div className="workout-detail-container">
        <div className="workout-error">
          <h3>No workout data available</h3>
          <button className="btn btn-primary" onClick={handleBack}>
            Back to Schedule
          </button>
        </div>
      </div>
    );
  }

  const progressPercentage = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  return (
    <div className="workout-detail-container">
      {/* Header */}
      <div className="workout-detail-header">
        <button className="back-button" onClick={handleBack}>
          ← Back
        </button>
        <h1 className="workout-title">
          {workoutData.day} - {workoutData.category}
        </h1>
      </div>

      {/* Progress Section */}
      <div className="workout-progress-section">
        <h3 className="progress-title">Workout Progress</h3>
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progressPercentage}%` }} 
            />
          </div>
        </div>
        <p className="progress-text">
          {completedSets} of {totalSets} sets completed ({Math.round(progressPercentage)}%)
        </p>

        {/* Unsaved Changes Indicator */}
        {hasUnsavedChanges && (
          <div className="unsaved-indicator">
            ⚠️ You have unsaved changes. Click "Save Workout" to save your progress.
          </div>
        )}

        {/* Manual Save Controls */}
        {hasUnsavedChanges && (
          <div className="save-controls">
            <button 
              className="save-button"
              onClick={handleManualSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Workout'}
            </button>
          </div>
        )}

        {/* Save Status */}
        {saveStatus && (
          <div className={`save-status ${saveStatus}`}>
            {saveStatus === 'saving' && '💾 Saving workout...'}
            {saveStatus === 'saved' && '✅ Workout saved successfully!'}
            {saveStatus === 'error' && '❌ Failed to save workout'}
          </div>
        )}
      </div>

      {/* Unit Toggle */}
      <div className="unit-toggle-container">
        <button
          className={`unit-toggle-btn ${useMetric ? 'active' : ''}`}
          onClick={() => setUseMetric(!useMetric)}
        >
          Display: {useMetric ? 'Metric (kg)' : 'Imperial (lbs)'}
        </button>
      </div>
      
      {/* Exercises */}
      <div className="exercises-container">
        {exercises.map(exercise => (
          <div key={exercise.id} className="exercise-detail-card">
            <div className="exercise-header">
              <h3 
                className="exercise-name exercise-clickable" 
                onClick={() => { 
                  const link = document.createElement('a'); 
                  link.href = `https://www.google.com/search?q=how+to+${encodeURIComponent(exercise.name)}&tbm=vid`; 
                  link.target = '_blank'; 
                  link.rel = 'noopener'; 
                  link.click(); 
                }}                
                title="Click to watch exercise tutorial videos"
              >
                {exercise.name}
              </h3>
              <span className={`exercise-status-badge ${exercise.status}`}>
                {exercise.status}
              </span>
            </div>

            <div className="sets-table">
              <div className="sets-header">
                <span>Set</span>
                <span>Weight</span>
                <span>Reps</span>
                <span>Time</span>
                <span>Action</span>
              </div>

              {exercise.sets.map(set => (
                <div 
                  key={set.id} 
                  className={`set-row ${set.status === 'in-progress' ? 'set-active' : ''} ${set.status === 'done' ? 'set-completed' : ''}`}
                >
                  <span className="set-number">{set.id}</span>
                  <span className="set-weight">
                    {renderEditableCell(exercise, set, 'weight')}
                  </span>
                  <span className="set-reps">
                    {renderEditableCell(exercise, set, 'reps')}
                  </span>
                  {/* Display elapsed time - simple and direct */}
                  <span className={`set-time ${set.status === 'done' && set.elapsedTime ? 'completed' : 'pending'}`}>
                    {set.status === 'done' && set.elapsedTime 
                      ? formatElapsedTime(set.elapsedTime)
                      : '-'
                    }
                  </span>
                  <div className="set-action">
                    {getActionButton(set, exercise.id, set.id)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {/* Manual Save Controls */}
        {hasUnsavedChanges && (
          <div className="save-controls">
            <button 
              className="save-button"
              onClick={handleManualSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Workout'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}