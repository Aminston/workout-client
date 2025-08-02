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

  // Manual save function - only called by user action
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

      console.log(`💾 Saving ${exercisesToSave.length} exercises with changes`);

      // Save each exercise
      const savePromises = exercisesToSave.map(async (exercise) => {
        const setsToSave = exercise.sets.filter(set => {
          const isNewlyCompleted = set.status === 'done' && !set.isFromSession;
          const isModified = set.isModified === true;
          return isNewlyCompleted || isModified;
        });
        
        const performedSets = setsToSave.map(set => ({
          setNumber: set.id,
          reps: set.reps,
          weight: set.weight,
          weightUnit: set.weightUnit || 'kg'
        }));

        console.log(`📤 Saving ${exercise.name} with ${performedSets.length} sets:`, performedSets);

        const response = await fetch(getApiUrl('/sessions/save'), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            scheduleId: exercise.scheduleId,
            performedSets: performedSets
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Failed to save ${exercise.name}: ${errorData.error || response.statusText}`);
        }

        const result = await response.json();
        console.log(`✅ Saved ${exercise.name} successfully:`, result);
        
        return { exerciseId: exercise.id, result, savedSets: setsToSave };
      });

      // Wait for all saves to complete
      const results = await Promise.all(savePromises);
      console.log('📋 All save results:', results);
      
      // Update UI to mark sets as saved
      setExercises(prev => prev.map(exercise => {
        const exerciseResult = results.find(r => r?.exerciseId === exercise.id);
        if (!exerciseResult) return exercise;
        
        const updatedSets = exercise.sets.map(set => {
          const wasSaved = exerciseResult.savedSets.some(savedSet => savedSet.id === set.id);
          if (!wasSaved) return set;
          
          return {
            ...set,
            isModified: false,
            lastSaved: new Date().toISOString(),
            isFromSession: set.status === 'done' ? true : set.isFromSession
          };
        });
        
        return { ...exercise, sets: updatedSets };
      }));
      
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      console.log('✅ All changes saved successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveStatus(null), 3000);
      
    } catch (error) {
      console.error('❌ Failed to save changes:', error);
      setSaveStatus('error');
      alert(`Failed to save workout: ${error.message}`);
      
      // Clear error message after 5 seconds
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

  // Fetch fresh data from /schedule API and transform according to requirements
  useEffect(() => {
    let isMounted = true;
    
    const initializeWorkout = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔍 FULL DEBUG: location:', location);
        console.log('🔍 FULL DEBUG: location.state:', location.state);
        console.log('🔍 FULL DEBUG: location.state keys:', location.state ? Object.keys(location.state) : 'null');

        // Get data from different possible sources
        const dayData = location.state?.workoutData;
        const scheduleId = location.state?.scheduleId || location.state?.workoutData?.scheduleId;
        const directWorkoutData = location.state?.workout;
        
        console.log('🔍 DEBUG: dayData exists:', !!dayData);
        console.log('🔍 DEBUG: scheduleId:', scheduleId);
        console.log('🔍 DEBUG: directWorkoutData:', !!directWorkoutData);

        // Method 1: Use day data with originalApiData
        if (dayData && dayData.originalApiData && dayData.originalApiData.workouts) {
          console.log('✅ Method 1: Using passed day data with originalApiData');
          
          const apiData = dayData.originalApiData;
          const workoutData = {
            day: apiData.day,
            category: apiData.category
          };

          // Transform ALL workouts from the day's data
          const exercises = apiData.workouts.map((workout) => {
            console.log(`🔄 Processing workout: ${workout.name} (${workout.sets} sets)`);
            console.log(`🔄 All sessions for ${workout.name}:`, workout.sessions);
            
            // Create session lookup by set_number
            const sessionsBySetNumber = {};
            if (workout.sessions && workout.sessions.length > 0) {
              workout.sessions.forEach(session => {
                console.log(`🔍 Checking session:`, {
                  session_id: session.session_id,
                  set_number: session.set_number,
                  set_status: session.set_status,
                  reps: session.reps,
                  weight: session.weight
                });
                
                // Only use sessions with actual set_number and completed status
                if (session.set_number !== null && session.set_status === 'completed') {
                  sessionsBySetNumber[session.set_number] = session;
                  console.log(`✅ Added session for set ${session.set_number}`);
                }
              });
              console.log(`📋 Final sessions lookup for ${workout.name}:`, sessionsBySetNumber);
            }

            // Build sets array merging base program with session data
            const sets = [];
            const totalSets = workout.sets || 3;
            
            for (let setNum = 1; setNum <= totalSets; setNum++) {
              const session = sessionsBySetNumber[setNum];
              
              if (session) {
                console.log(`🎯 Found completed session for set ${setNum}:`, session);
                sets.push({
                  id: setNum,
                  reps: session.reps,
                  weight: weightConverter.normalize(session.weight) || 0,
                  weightUnit: session.weight?.unit || 'kg',
                  time: session.time?.value || null,
                  duration: session.time?.value || null,
                  status: 'done',
                  completedAt: session.created_at,
                  isFromSession: true
                });
                console.log(`✅ Set ${setNum} marked as DONE for ${workout.name}`);
              } else {
                console.log(`⏸️ No session found for set ${setNum}, using base workout data`);
                sets.push({
                  id: setNum,
                  reps: workout.reps || 10,
                  weight: weightConverter.normalize(workout.weight) || 0,
                  weightUnit: workout.weight?.unit || 'kg',
                  time: null,
                  duration: null,
                  status: 'pending',
                  completedAt: null,
                  isFromSession: false
                });
                console.log(`⏸️ Set ${setNum} marked as PENDING for ${workout.name}`);
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

            console.log(`📊 Final exercise for ${workout.name}:`, {
              name: exercise.name,
              status: exercise.status,
              sets: sets.map(s => ({ id: s.id, status: s.status, isFromSession: s.isFromSession, reps: s.reps, weight: s.weight }))
            });

            return exercise;
          });

          if (!isMounted) return;

          console.log(`✅ Method 1 Success: Processed ${exercises.length} exercises`);
          setWorkoutData(workoutData);
          setExercises(exercises);
          
          const totalSetsCount = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
          const completedSetsCount = exercises.reduce((sum, ex) => 
            sum + ex.sets.filter(s => s.status === 'done').length, 0);
          
          setTotalSets(totalSetsCount);
          setCompletedSets(completedSetsCount);
          setLoading(false);
          return;
        }

        // Method 2: Use pre-transformed exercises data
        if (dayData && dayData.exercises && Array.isArray(dayData.exercises)) {
          console.log('✅ Method 2: Using pre-transformed exercises data');
          
          const workoutData = {
            day: dayData.day,
            category: dayData.category
          };

          if (!isMounted) return;

          setWorkoutData(workoutData);
          setExercises(dayData.exercises);
          
          const totalSetsCount = dayData.exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
          const completedSetsCount = dayData.exercises.reduce((sum, ex) => 
            sum + (ex.sets?.filter(s => s.status === 'done').length || 0), 0);
          
          setTotalSets(totalSetsCount);
          setCompletedSets(completedSetsCount);
          setLoading(false);
          return;
        }

        // Method 3: Fetch from API using scheduleId
        if (scheduleId) {
          console.log('🔄 Method 3: Fetching from API with scheduleId:', scheduleId);
          
          const token = localStorage.getItem('jwt_token') || localStorage.getItem('X-API-Token');
          
          if (!token) {
            throw new Error('No authentication token found');
          }

          const response = await fetch(`${import.meta.env.VITE_API_URL}/schedule`, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch schedule: ${response.status}`);
          }

          const scheduleData = await response.json();
          
          // Find the specific workout by scheduleId
          let foundWorkout = null;
          let foundDay = null;
          
          if (scheduleData.schedule) {
            for (const daySchedule of scheduleData.schedule) {
              const workout = daySchedule.workouts?.find(w => w.scheduleId === scheduleId);
              if (workout) {
                foundWorkout = workout;
                foundDay = daySchedule;
                break;
              }
            }
          }
          
          if (!foundWorkout) {
            throw new Error('Workout not found in schedule');
          }

          // Process single workout
          const workoutData = {
            day: foundDay.day,
            category: foundDay.category
          };

          const sessionsBySetNumber = {};
          if (foundWorkout.sessions && foundWorkout.sessions.length > 0) {
            foundWorkout.sessions.forEach(session => {
              // Only use sessions with actual set_number and completed status  
              if (session.set_number !== null && session.set_status === 'completed') {
                sessionsBySetNumber[session.set_number] = session;
              }
            });
            console.log('📋 Session data for single workout:', sessionsBySetNumber);
          }

          const sets = [];
          const totalSets = foundWorkout.sets || 3;
          
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
                status: 'done',
                completedAt: session.created_at,
                isFromSession: true
              });
            } else {
              sets.push({
                id: setNum,
                reps: foundWorkout.reps || 10,
                weight: weightConverter.normalize(foundWorkout.weight) || 0,
                weightUnit: foundWorkout.weight?.unit || 'kg',
                time: null,
                duration: null,
                status: 'pending',
                completedAt: null,
                isFromSession: false
              });
            }
          }

          const exercise = {
            id: foundWorkout.scheduleId,
            scheduleId: foundWorkout.scheduleId,
            workout_id: foundWorkout.workout_id,
            name: foundWorkout.name,
            category: foundWorkout.category || foundDay.category,
            type: foundWorkout.type,
            sets: sets,
            status: sets.every(s => s.status === 'done') ? 'done' : 
                   sets.some(s => s.status === 'done') ? 'in-progress' : 'pending'
          };

          if (!isMounted) return;

          console.log('✅ Method 3 Success: Single workout processed');
          setWorkoutData(workoutData);
          setExercises([exercise]);
          setTotalSets(sets.length);
          setCompletedSets(sets.filter(s => s.status === 'done').length);
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
            { id: 1, reps: 8, weight: 60, weightUnit: 'kg', status: 'pending', isFromSession: false, duration: null },
            { id: 2, reps: 8, weight: 60, weightUnit: 'kg', status: 'pending', isFromSession: false, duration: null },
            { id: 3, reps: 8, weight: 60, weightUnit: 'kg', status: 'pending', isFromSession: false, duration: null },
            { id: 4, reps: 8, weight: 60, weightUnit: 'kg', status: 'pending', isFromSession: false, duration: null }
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

  // Simple set action handler
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
            const duration = set.startTime 
              ? Math.round((new Date(endTime) - new Date(set.startTime)) / 1000)
              : 0;
            
            console.log(`✅ Completing set ${setId} for ${exercise.name} - status will be 'done'`);
            
            // Mark as having unsaved changes when completing a set
            setHasUnsavedChanges(true);
            
            return { 
              ...set, 
              status: 'done', 
              isFromSession: false, // Mark as NOT from session (newly completed)
              duration,
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

  // Render editable cell for weight and reps
  const renderEditableCell = (exercise, set, field) => {
    const isEditing = editingCell?.exerciseId === exercise.id && 
                     editingCell?.setId === set.id && 
                     editingCell?.field === field;
    
    const isReadonly = set.status === 'done';
    
    if (isEditing) {
      const displayValue = field === 'weight' 
        ? (useMetric ? set.weight : weightConverter.kgToLbs(set.weight || 0))
        : set[field];
        
      return (
        <input
          type="number"
          className="table-cell-input"
          defaultValue={displayValue}
          autoFocus
          onBlur={e => {
            let value = e.target.value;
            if (field === 'weight' && !useMetric) {
              value = weightConverter.lbsToKg(parseFloat(value) || 0);
            }
            handleCellEdit(exercise.id, set.id, field, value);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              let value = e.target.value;
              if (field === 'weight' && !useMetric) {
                value = weightConverter.lbsToKg(parseFloat(value) || 0);
              }
              handleCellEdit(exercise.id, set.id, field, value);
            }
            if (e.key === 'Escape') {
              setEditingCell(null);
            }
          }}
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
    
    let className = `editable-cell ${isReadonly ? 'cell-readonly' : ''} ${set.isFromSession ? 'from-session' : 'from-base'}`;
    let title = '';
    
    if (isReadonly) {
      title = 'From completed session - Read only';
    } else {
      title = 'Click to edit';
    }
    
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

  // Handle cell click to start editing
  const handleCellClick = (exerciseId, setId, field) => {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    const set = exercise?.sets.find(s => s.id === setId);
    if (set?.status === 'done') return;
    
    setEditingCell({ exerciseId, setId, field });
  };

  // Handle cell edit completion
  const handleCellEdit = async (exerciseId, setId, field, value) => {
    console.log(`✏️ Editing ${field} for exercise ${exerciseId}, set ${setId}: ${value}`);
    
    setExercises(prev => prev.map(exercise => {
      if (exercise.id !== exerciseId) return exercise;
      
      const updatedSets = exercise.sets.map(set => {
        if (set.id !== setId) return set;
        if (set.status === 'done') return set;
        
        if (field === 'weight') {
          const numericValue = parseFloat(value) || 0;
          return { ...set, weight: numericValue, isModified: true };
        } else if (field === 'reps') {
          const numericValue = parseInt(value) || 0;
          return { ...set, reps: numericValue, isModified: true };
        }
        
        return set;
      });
      
      return { ...exercise, sets: updatedSets };
    }));
    
    setEditingCell(null);
    setHasUnsavedChanges(true);
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
                onClick={() => window.open(`https://www.google.com/search?q=how+to+${encodeURIComponent(exercise.name)}&tbm=vid`, '_blank')}
                title="Click to watch exercise tutorial videos"
              >
                {exercise.name}
              </h3>
              {exercise.status === 'done' && (
                <span className="exercise-status-badge exercise-done">Done</span>
              )}
            </div>

            <div className="sets-table">
              <div className="sets-header">
                <span>Set</span>
                <span>Reps</span>
                <span>Weight</span>
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
                  <span className={`set-time ${set.status === 'done' && set.duration ? 'completed' : 'pending'}`}>
                    {set.status === 'done' && set.duration ? `${set.duration}s` : '-'}
                  </span>
                  <div className="set-action">
                    {getActionButton(set, exercise.id, set.id)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}