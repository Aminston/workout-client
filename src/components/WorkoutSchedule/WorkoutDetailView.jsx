import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './WorkoutDetailView.css';
import { weightConverter } from "./workoutUtils";

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
  
  // UI state
  const [editingCell, setEditingCell] = useState(null);
  const [useMetric, setUseMetric] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

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
    return Math.round(elapsedMs / 100) / 10;
  };

  // Format elapsed time display
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

  // Enhanced bulk save with elapsed time support
  const handleManualSave = async () => {
    if (!hasUnsavedChanges || isSaving) return;
    
    console.log('💾 V2 Save initiated...');
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
      // Get exercises with changes to save
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

      console.log(`💾 V2 Bulk saving ${exercisesToSave.length} exercises`);

      // Build workoutSessions array with elapsed time
      const workoutSessions = exercisesToSave.map(exercise => {
        const setsToSave = exercise.sets.filter(set => {
          const isNewlyCompleted = set.status === 'done' && !set.isFromSession;
          const isModified = set.isModified === true;
          return isNewlyCompleted || isModified;
        });
        
        const performedSets = setsToSave.map(set => {
          const elapsedTime = calculateElapsedTime(set.startTime, set.completedAt);
          
          const performedSet = {
            setNumber: set.id,
            reps: set.reps,
            weight: set.weight,
            weightUnit: set.weightUnit || 'kg'
          };

          if (elapsedTime !== null) {
            performedSet.elapsedTime = elapsedTime;
            console.log(`⏱️ Set ${set.id} elapsed time: ${elapsedTime}s`);
          }

          return performedSet;
        });

        return {
          scheduleId: exercise.scheduleId,
          status: 'completed',
          performedSets: performedSets
        };
      });

      // Single bulk API call
      const response = await fetch(getApiUrl('/sessions/save'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ workoutSessions })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Save failed: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ V2 Save successful:', result);
      
      // Handle response formats
      let sessions;
      if (result.success && result.sessions) {
        sessions = result.sessions;
      } else if (result.scheduleId && result.savedSets) {
        sessions = [result];
      } else {
        throw new Error('Invalid save response format');
      }
      
      // Update UI to mark sets as saved
      setExercises(prev => prev.map(exercise => {
        const exerciseResult = sessions.find(session => session.scheduleId === exercise.scheduleId);
        if (!exerciseResult) return exercise;
        
        const updatedSets = exercise.sets.map(set => {
          const savedSet = exerciseResult.savedSets.find(savedSet => savedSet.setNumber === set.id);
          if (!savedSet) return set;
          
          return {
            ...set,
            isModified: false,
            lastSaved: new Date().toISOString(),
            isFromSession: set.status === 'done' ? true : set.isFromSession,
            elapsedTime: savedSet.elapsedTime || set.elapsedTime || calculateElapsedTime(set.startTime, set.completedAt)
          };
        });
        
        return { ...exercise, sets: updatedSets };
      }));
      
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 3000);
      
    } catch (error) {
      console.error('❌ V2 Save failed:', error);
      setSaveStatus('error');
      alert(`Failed to save workout: ${error.message}`);
      setTimeout(() => setSaveStatus(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Warning on page leave if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved workout data. Save before leaving!';
        return 'You have unsaved workout data. Save before leaving!';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Process V2 workout data with proper session management
  useEffect(() => {
    let isMounted = true;
    
    const processV2WorkoutData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🚀 V2 WorkoutDetail: Processing data...');

        // V2 ONLY: Get data from navigation state
        const originalApiData = location.state?.originalApiData;
        const passedWorkoutData = location.state?.workoutData;
        
        // Try originalApiData first (from WeeklyWorkout), then fallback to direct workoutData
        let dayData = null;
        
        if (originalApiData) {
          console.log('✅ V2 Using originalApiData:', originalApiData);
          dayData = originalApiData;
        } else if (passedWorkoutData && passedWorkoutData.originalApiData) {
          console.log('✅ V2 Using workoutData.originalApiData:', passedWorkoutData.originalApiData);
          dayData = passedWorkoutData.originalApiData;
        } else {
          throw new Error('V2 API data not found. Please navigate from the schedule page.');
        }

        // Verify V2 format - looking for the schedule structure
        if (!dayData.workouts || !Array.isArray(dayData.workouts)) {
          throw new Error('Invalid V2 workout data format - missing workouts array');
        }

        console.log(`🔄 V2 Processing ${dayData.workouts.length} workouts for ${dayData.day_name}`);

        // Process workout metadata
        const workoutData = {
          day: dayData.day_name || `Day ${dayData.day_number}`,
          category: '' // V2 doesn't use category at day level
        };

        // Process each workout into exercise format with session management
        const exercises = dayData.workouts.map((workout) => {
          console.log(`🔄 V2 Processing: ${workout.name} (${workout.sets} sets)`);
          console.log(`📋 Sessions found: ${workout.sessions.length}`);
          
          // Build session lookup by set_number for proper session management
          const sessionsBySetNumber = {};
          if (workout.sessions && workout.sessions.length > 0) {
            workout.sessions.forEach(session => {
              console.log(`🔍 Session check:`, {
                session_id: session.session_id,
                set_number: session.set_number,
                set_status: session.set_status,
                elapsed_time: session.elapsed_time,
                reps: session.reps,
                weight: session.weight
              });
              
              if (session.set_number !== null && session.set_status === 'completed') {
                // Keep most recent session for each set (handle duplicates)
                const existing = sessionsBySetNumber[session.set_number];
                if (!existing || new Date(session.created_at) > new Date(existing.created_at)) {
                  sessionsBySetNumber[session.set_number] = session;
                  console.log(`✅ Added session for set ${session.set_number}`);
                } else {
                  console.log(`⏭️ Skipped older session for set ${session.set_number}`);
                }
              }
            });
          }

          console.log(`📊 Final sessions lookup for ${workout.name}:`, sessionsBySetNumber);

          // Build sets array - merging workout template with session data
          const sets = [];
          const totalSets = workout.sets || 3;
          
          for (let setNum = 1; setNum <= totalSets; setNum++) {
            const session = sessionsBySetNumber[setNum];
            
            if (session) {
              // Set completed from session data
              console.log(`🎯 Found completed session for set ${setNum}:`, {
                reps: session.reps,
                weight: session.weight,
                elapsed_time: session.elapsed_time
              });
              
              sets.push({
                id: setNum,
                reps: session.reps,
                weight: session.weight?.value || 0,
                weightUnit: session.weight?.unit || 'kg',
                elapsedTime: session.elapsed_time || null,
                status: 'done',
                completedAt: session.created_at,
                isFromSession: true // Mark as from existing session
              });
            } else {
              // Pending set from workout template
              console.log(`⏸️ No session for set ${setNum}, using template data`);
              sets.push({
                id: setNum,
                reps: workout.reps || 10,
                weight: workout.weight?.value || 0,
                weightUnit: workout.weight?.unit || 'kg',
                elapsedTime: null,
                status: 'pending',
                completedAt: null,
                isFromSession: false // New set, not from session
              });
            }
          }

          // Determine exercise status based on completed sets
          const doneSets = sets.filter(s => s.status === 'done');
          let exerciseStatus = 'pending';
          if (doneSets.length === sets.length && sets.length > 0) {
            exerciseStatus = 'done';
          } else if (doneSets.length > 0) {
            exerciseStatus = 'in-progress';
          }

          console.log(`📊 Final exercise status for ${workout.name}: ${exerciseStatus} (${doneSets.length}/${sets.length} sets done)`);

          return {
            id: workout.scheduleId,
            scheduleId: workout.scheduleId,
            workout_id: workout.workout_id,
            name: workout.name,
            category: workout.category,
            type: workout.type,
            sets: sets,
            status: exerciseStatus
          };
        });

        if (!isMounted) return;

        console.log(`✅ V2 Success: Processed ${exercises.length} exercises`);
        setWorkoutData(workoutData);
        setExercises(exercises);
        
        const totalSetsCount = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
        const completedSetsCount = exercises.reduce((sum, ex) => 
          sum + ex.sets.filter(s => s.status === 'done').length, 0);
        
        setTotalSets(totalSetsCount);
        setCompletedSets(completedSetsCount);
        setLoading(false);

      } catch (error) {
        console.error('❌ V2 Failed to process workout:', error);
        if (isMounted) {
          setError(error.message);
          setLoading(false);
        }
      }
    };

    processV2WorkoutData();
    
    return () => {
      isMounted = false;
    };
  }, [location.state]);

  // Set action handler with elapsed time tracking
  const handleSetAction = (exerciseId, setId, action) => {
    console.log(`🎯 V2 Set action: ${action} for exercise ${exerciseId}, set ${setId}`);
    
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
            const elapsedTime = calculateElapsedTime(set.startTime, endTime);
            
            console.log(`✅ Completing set ${setId} for ${exercise.name} - elapsed: ${elapsedTime}s`);
            setHasUnsavedChanges(true);
            
            return { 
              ...set, 
              status: 'done', 
              isFromSession: false, // Mark as newly completed (not from existing session)
              elapsedTime,
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

  // Render editable cell with proper unit handling
  const renderEditableCell = (exercise, set, field) => {
    const isEditing = editingCell?.exerciseId === exercise.id && 
                     editingCell?.setId === set.id && 
                     editingCell?.field === field;
    
    if (isEditing) {
      let displayValue;
      if (field === 'weight') {
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
          onBlur={e => handleCellEdit(exercise.id, set.id, field, e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleCellEdit(exercise.id, set.id, field, e.target.value);
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
    
    return (
      <span
        className={className}
        onClick={() => handleCellClick(exercise.id, set.id, field)}
        title={`Click to edit ${field}. Current: ${displayValue}${set.isFromSession ? ' (from completed session)' : ''}`}
      >
        {displayValue}
      </span>
    );
  };

  const handleCellClick = (exerciseId, setId, field) => {
    setEditingCell({ exerciseId, setId, field });
  };

  // Handle cell edit with proper unit conversion
  const handleCellEdit = async (exerciseId, setId, field, value) => {
    console.log(`✏️ V2 Editing ${field}: ${value} (unit: ${useMetric ? 'kg' : 'lbs'})`);
    
    let processedValue;
    if (field === 'weight') {
      if (useMetric) {
        processedValue = Math.max(0, parseFloat(value) || 0);
        processedValue = Math.round(processedValue * 2) / 2; // 0.5kg precision
      } else {
        const lbsValue = Math.max(0, parseInt(value) || 0);
        processedValue = weightConverter.lbsToKg(lbsValue);
      }
    } else if (field === 'reps') {
      processedValue = Math.max(0, parseInt(value) || 0);
    } else {
      processedValue = value;
    }
    
    // Update state
    setExercises(prev => prev.map(exercise => {
      if (exercise.id !== exerciseId) return exercise;
      
      const updatedSets = exercise.sets.map(set => {
        if (set.id !== setId) return set;
        
        const updatedSet = { ...set, isModified: true };
        
        if (field === 'weight') {
          updatedSet.weight = processedValue;
        } else if (field === 'reps') {
          updatedSet.reps = processedValue;
        }
        
        return updatedSet;
      });
      
      return { ...exercise, sets: updatedSets };
    }));
    
    setEditingCell(null);
    setHasUnsavedChanges(true);
  };

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
      const shouldLeave = window.confirm('You have unsaved changes. Leave without saving?');
      if (!shouldLeave) return;
    }
    navigate('/schedule');
  };

  // Render loading state
  if (loading) {
    return (
      <div className="workout-detail-container">
        <div className="workout-loading">
          <div className="spinner-border text-primary" role="status" />
          <span className="ms-2">Loading V2 workout...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="workout-detail-container">
        <div className="workout-error">
          <h3>❌ V2 Workout Loading Error</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={handleBack}>
            Back to Schedule
          </button>
        </div>
      </div>
    );
  }

  // Render no data state
  if (!workoutData) {
    return (
      <div className="workout-detail-container">
        <div className="workout-error">
          <h3>No V2 workout data available</h3>
          <p>Please navigate from the schedule page to load workout data.</p>
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
          {workoutData.day}
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

        {/* Manual Save Controls - ONLY show here, not at bottom */}
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
                {exercise.status === 'pending' && 'Pending'}
                {exercise.status === 'in-progress' && 'In Progress'}
                {exercise.status === 'done' && 'Done'}
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
        
        {/* REMOVED: Duplicate save controls at bottom */}
      </div>
    </div>
  );
}