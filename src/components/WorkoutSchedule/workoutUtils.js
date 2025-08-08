// src/components/WorkoutSchedule/workoutUtils.js
// Utility functions for transforming workout data and managing sessions

/**
 * Weight conversion utilities
 */
export const weightConverter = {
  lbsToKg: (lbs) => Math.round(lbs * 0.453592 * 100) / 100,
  kgToLbs: (kg) => Math.round(kg * 2.20462), // 🚀 FIXED: Round to whole number
  
  // Normalize weight to kg for internal use
  normalize: (weightObj) => {
    if (!weightObj || weightObj.value === null) return null;
    return weightObj.unit === 'lbs' ? weightConverter.lbsToKg(weightObj.value) : weightObj.value;
  },
  
  // Display weight in preferred unit
  display: (weightInKg, useMetric = true) => {
    if (weightInKg === null || weightInKg === undefined) return '0kg';
    
    if (useMetric) {
      // Keep kg with 1 decimal place for precision
      const rounded = Math.round(weightInKg * 10) / 10;
      return `${rounded}kg`;
    } else {
      // 🚀 FIXED: Always show whole numbers for pounds
      const lbs = Math.round(weightInKg * 2.20462);
      return `${lbs}lb`;
    }
  }
};

/**
 * Transform API workout data into frontend format
 * Merges base program with session data according to requirements
 */
export function transformWorkoutData(apiWorkout) {
  if (!apiWorkout) return null;

  console.log('🔄 Transforming workout data:', apiWorkout);

  // Handle both single workout and workout array
  const workouts = Array.isArray(apiWorkout.workouts) ? apiWorkout.workouts : [apiWorkout];
  
  const exercises = workouts.map(workout => {
    const exercise = transformSingleWorkout(workout);
    console.log(`✅ Transformed exercise: ${exercise.name}`, exercise);
    return exercise;
  });

  return {
    day: apiWorkout.day,
    category: apiWorkout.category,
    scheduleId: apiWorkout.scheduleId || workouts[0]?.scheduleId,
    exercises
  };
}

/**
 * Transform a single workout into exercise format with proper set merging
 */
function transformSingleWorkout(workout) {
  const {
    scheduleId,
    workout_id,
    name,
    category,
    type,
    sets: baseSets,
    reps: baseReps,
    weight: baseWeight,
    time: baseTime,
    sessions = []
  } = workout;

  console.log(`🔄 Processing workout: ${name}`, { baseSets, baseReps, baseWeight, sessions: sessions.length });

  // Create session lookup by set_number
  const sessionsBySetNumber = {};
  sessions.forEach(session => {
    if (session.set_number && session.set_status === 'completed') {
      sessionsBySetNumber[session.set_number] = session;
    }
  });

  console.log('📋 Sessions by set number:', sessionsBySetNumber);

  // Determine number of sets (use baseSets or default to 3)
  const totalSets = baseSets || 3;
  
  // Build sets array merging base program with session data
  const sets = [];
  for (let setNum = 1; setNum <= totalSets; setNum++) {
    const session = sessionsBySetNumber[setNum];
    
    if (session) {
      // Use session data for completed sets
      sets.push({
        id: setNum,
        reps: session.reps,
        weight: weightConverter.normalize(session.weight),
        weightUnit: session.weight?.unit || 'kg',
        time: session.time?.value || null,
        timeUnit: session.time?.unit || 'seconds',
        duration: session.time?.value || null,
        status: 'done',
        completedAt: session.created_at,
        modificationType: session.modification_type,
        isModified: session.is_modified,
        isFromSession: true
      });
    } else {
      // Use base program data for pending sets
      sets.push({
        id: setNum,
        reps: baseReps || 10,
        weight: weightConverter.normalize(baseWeight) || 0,
        weightUnit: baseWeight?.unit || 'kg',
        time: baseTime || null,
        timeUnit: 'seconds',
        duration: null,
        status: 'pending',
        completedAt: null,
        modificationType: null,
        isModified: false,
        isFromSession: false
      });
    }
  }

  console.log(`📊 Generated ${sets.length} sets for ${name}:`, sets);

  // Calculate exercise status
  const completedSets = sets.filter(s => s.status === 'done');
  let exerciseStatus = 'pending';
  if (completedSets.length === sets.length && sets.length > 0) {
    exerciseStatus = 'done';
  } else if (completedSets.length > 0) {
    exerciseStatus = 'in-progress';
  }

  return {
    id: scheduleId,
    scheduleId,
    workout_id,
    name,
    category,
    type,
    sets,
    status: exerciseStatus
  };
}

/**
 * Update workout data with new session information
 */
export function updateWorkoutWithSession(workoutData, sessionData) {
  if (!workoutData || !sessionData) return workoutData;

  console.log('🔄 Updating workout with session data:', sessionData);

  const updatedExercises = workoutData.exercises.map(exercise => {
    // Find sessions for this exercise
    const exerciseSessions = sessionData.sessions?.filter(s => 
      s.workout_id === exercise.workout_id
    ) || [];

    if (exerciseSessions.length === 0) return exercise;

    // Update sets with session data
    const updatedSets = exercise.sets.map(set => {
      const sessionForSet = exerciseSessions.find(s => s.set_number === set.id);
      
      if (sessionForSet && sessionForSet.set_status === 'completed') {
        return {
          ...set,
          reps: sessionForSet.reps,
          weight: weightConverter.normalize(sessionForSet.weight),
          weightUnit: sessionForSet.weight?.unit || 'kg',
          duration: sessionForSet.time?.value || null,
          status: 'done',
          completedAt: sessionForSet.created_at,
          modificationType: sessionForSet.modification_type,
          isModified: sessionForSet.is_modified,
          isFromSession: true
        };
      }
      
      return set;
    });

    // Recalculate exercise status
    const completedSets = updatedSets.filter(s => s.status === 'done');
    let exerciseStatus = 'pending';
    if (completedSets.length === updatedSets.length && updatedSets.length > 0) {
      exerciseStatus = 'done';
    } else if (completedSets.length > 0) {
      exerciseStatus = 'in-progress';
    }

    return {
      ...exercise,
      sets: updatedSets,
      status: exerciseStatus
    };
  });

  return {
    ...workoutData,
    exercises: updatedExercises,
    sessionId: sessionData.sessionId,
    sessionStatus: sessionData.status || 'not_started'
  };
}

/**
 * Generate performed sets array for API from current exercise state
 */
export function generatePerformedSets(exercises) {
  const performedSets = [];

  exercises.forEach(exercise => {
    exercise.sets.forEach(set => {
      if (set.status === 'done') {
        performedSets.push({
          exerciseId: exercise.scheduleId,
          setNumber: set.id,
          reps: set.reps,
          weight: set.weight,
          weightUnit: set.weightUnit || 'kg',
          duration: set.duration,
          completedAt: set.completedAt || new Date().toISOString()
        });
      }
    });
  });

  return performedSets;
}

/**
 * Calculate workout progress statistics
 */
export function calculateProgress(exercises) {
  const allSets = exercises.flatMap(ex => ex.sets || []);
  const completedSets = allSets.filter(set => set.status === 'done');
  const inProgressSets = allSets.filter(set => set.status === 'in-progress');
  
  const totalSets = allSets.length;
  const completedCount = completedSets.length;
  const progressPercentage = totalSets > 0 ? (completedCount / totalSets) * 100 : 0;
  
  let overallStatus = 'not_started';
  if (completedCount === totalSets && totalSets > 0) {
    overallStatus = 'completed';
  } else if (completedCount > 0 || inProgressSets.length > 0) {
    overallStatus = 'in_progress';
  }

  return {
    totalSets,
    completedSets: completedCount,
    inProgressSets: inProgressSets.length,
    progressPercentage: Math.round(progressPercentage),
    overallStatus
  };
}

/**
 * Validate workout data structure
 */
export function validateWorkoutData(workoutData) {
  if (!workoutData) {
    throw new Error('Workout data is required');
  }

  if (!workoutData.exercises || !Array.isArray(workoutData.exercises)) {
    throw new Error('Workout must have exercises array');
  }

  if (workoutData.exercises.length === 0) {
    throw new Error('Workout must have at least one exercise');
  }

  workoutData.exercises.forEach((exercise, index) => {
    if (!exercise.scheduleId) {
      throw new Error(`Exercise ${index} missing scheduleId`);
    }
    
    if (!exercise.sets || !Array.isArray(exercise.sets)) {
      throw new Error(`Exercise ${index} missing sets array`);
    }
    
    if (exercise.sets.length === 0) {
      throw new Error(`Exercise ${index} must have at least one set`);
    }
  });

  return true;
}

/**
 * Mock data generator for testing
 */
export function generateMockWorkout(scheduleId = 234) {
  return {
    scheduleId,
    workout_id: 45,
    name: "Bench Press",
    category: "Chest",
    type: "Compound",
    sets: 4,
    reps: 8,
    weight: {
      value: 185,
      unit: "lbs"
    },
    sessions: [
      {
        session_id: 1001,
        set_number: 1,
        reps: 8,
        weight: { value: 185, unit: "lbs" },
        time: { value: 55, unit: "seconds" },
        modification_type: "increased",
        is_modified: true,
        set_status: "completed",
        created_at: "2025-07-31T10:30:00Z"
      },
      {
        session_id: 1002,
        set_number: 2,
        reps: 8,
        weight: { value: 185, unit: "lbs" },
        time: { value: 58, unit: "seconds" },
        modification_type: "unchanged",
        is_modified: false,
        set_status: "completed",
        created_at: "2025-07-31T10:32:00Z"
      }
    ]
  };
}