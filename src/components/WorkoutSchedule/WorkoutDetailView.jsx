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

  // 🚀 ENHANCED: Calculate elapsed time for a set
  const calculateElapsedTime = (startTime, endTime) => {
    if (!startTime || !endTime) return null;
    const start = new Date(startTime);
    const end = new Date(endTime);
    const elapsedMs = end - start;
    return Math.round(elapsedMs / 100) / 10; // Round to 1 decimal place (e.g., 45.5 seconds)
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

  // 🚀 ENHANCED: Updated handleManualSave with elapsed time support
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

      // 🚀 ENHANCED: Build bulk workoutSessions array with elapsed time
      const workoutSessions = exercisesToSave.map(exercise => {
        const setsToSave = exercise.sets.filter(set => {
          const isNewlyCompleted = set.status === 'done' && !set.isFromSession;
          const isModified = set.isModified === true;
          return isNewlyCompleted || isModified;
        });
        
        const performedSets = setsToSave.map(set => {
          // 🚀 NEW: Calculate and include elapsed time
          const elapsedTime = calculateElapsedTime(set.startTime, set.completedAt);
          
          const performedSet = {
            setNumber: set.id,
            reps: set.reps,
            weight: set.weight,
            weightUnit: set.weightUnit || 'kg'
          };

          // 🚀 NEW: Add elapsed time if available
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
      
      // 🚀 FIXED: Handle both single workout and bulk workout response formats
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
      
      // 🚀 ENHANCED: Update UI to mark sets as saved and preserve elapsed time from API response
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
            // 🚀 NEW: Preserve elapsed time from API response
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

  // 🚀 ENHANCED: Fetch fresh data with elapsed time support
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
            
            // 🚀 ENHANCED: Create session lookup by set_number, handling duplicates
            const sessionsBySetNumber = {};
            if (workout.sessions && workout.sessions.length > 0) {
              workout.sessions.forEach(session => {
                console.log(`🔍 Checking session:`, {
                  session_id: session.session_id,
                  set_number: session.set_number,
                  set_status: session.set_status,
                  reps: session.reps,
                  weight: session.weight,
                  elapsed_time: session.elapsed_time,
                  created_at: session.created_at
                });
                
                // Only use sessions with actual set_number and completed status
                if (session.set_number !== null && session.set_status === 'completed') {
                  // 🚀 NEW: Handle duplicate sessions - keep the most recent one
                  const existingSession = sessionsBySetNumber[session.set_number];
                  if (!existingSession || new Date(session.created_at) > new Date(existingSession.created_at)) {
                    sessionsBySetNumber[session.set_number] = session;
                    console.log(`✅ Added/Updated session for set ${session.set_number}:`, {
                      session_id: session.session_id,
                      elapsed_time: session.elapsed_time,
                      created_at: session.created_at
                    });
                  } else {
                    console.log(`⏭️ Skipped older session for set ${session.set_number}`);
                  }
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
                  // 🚀 NEW: Include elapsed time from session
                  elapsedTime: session.elapsed_time || null,
                  status: 'done',
                  completedAt: session.created_at,
                  isFromSession: true
                });
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
                  elapsedTime: null, // 🚀 NEW: No elapsed time for pending sets
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
              sets: sets.map(s => ({ 
                id: s.id, 
                status: s.status, 
                isFromSession: s.isFromSession, 
                reps: s.reps, 
                weight: s.weight,
                elapsedTime: s.elapsedTime // 🚀 NEW: Log elapsed time
              }))
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
                // Handle duplicate sessions - keep the most recent one
                const existingSession = sessionsBySetNumber[session.set_number];
                if (!existingSession || new Date(session.created_at) > new Date(existingSession.created_at)) {
                  sessionsBySetNumber[session.set_number] = session;
                }
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
                // 🚀 ENHANCED: Handle both numeric and null elapsed_time values
                elapsedTime: typeof session.elapsed_time === 'number' ? session.elapsed_time : null,
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
                elapsedTime: null, // 🚀 NEW: No elapsed time for pending sets
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

  // 🚀 ENHANCED: Simple set action handler with elapsed time tracking
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
            // 🚀 ENHANCED: Calculate elapsed time more precisely
            const elapsedTime = calculateElapsedTime(set.startTime, endTime);
            
            console.log(`✅ Completing set ${setId} for ${exercise.name} - elapsed time: ${elapsedTime}s`);
            
            // Mark as having unsaved changes when completing a set
            setHasUnsavedChanges(true);
            
            return { 
              ...set, 
              status: 'done', 
              isFromSession: false, // Mark as NOT from session (newly completed)
              elapsedTime, // 🚀 NEW: Store calculated elapsed time
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

  // 🚀 ENHANCED: Render editable cell - ALL SETS EDITABLE
  const renderEditableCell = (exercise, set, field) => {
    const isEditing = editingCell?.exerciseId === exercise.id && 
                     editingCell?.setId === set.id && 
                     editingCell?.field === field;
    
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
          // ✅ FIX: Auto-select all text when input gains focus
          onFocus={e => e.target.select()}
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
          min="0"
          step={field === 'weight' ? '0.5' : '1'}
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

  // Handle edit without immediate saving
  const handleCellEdit = async (exerciseId, setId, field, value) => {
    console.log(`✏️ Editing ${field} for exercise ${exerciseId}, set ${setId}: ${value}`);
    
    // Basic value validation
    let processedValue;
    if (field === 'weight') {
      processedValue = Math.max(0, parseFloat(value) || 0);
      processedValue = Math.round(processedValue * 2) / 2; // Round to nearest 0.5
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
    
    console.log(`✅ ${field} updated to ${processedValue} for set ${setId} (will save at session end)`);
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
              {exercise.status === 'done' && (
                <span className="exercise-done-icon emoji" title="Done">✅</span>
              )}
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