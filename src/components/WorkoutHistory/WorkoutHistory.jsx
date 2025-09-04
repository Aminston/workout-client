// src/components/WorkoutHistory/WorkoutHistory.jsx
// Complete production-ready implementation aligned with WorkoutDetailView

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './WorkoutHistory.css';

// API utilities
const getApiUrl = (endpoint) => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  return `${base}${endpoint}`;
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('jwt_token') || localStorage.getItem('X-API-Token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Utility functions
const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(new Date(date));
};

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

const formatVolume = (volume) => {
  if (!volume || volume <= 0) return '0kg';
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`;
  }
  return `${Math.round(volume)}kg`;
};

const getCompletionColor = (percentage) => {
  if (percentage >= 90) return 'completion-excellent';
  if (percentage >= 75) return 'completion-good';
  return 'completion-needs-work';
};

const getCategoryEmoji = (category) => {
  const emojiMap = {
    'Chest': '💪',
    'Back': '🔙', 
    'Shoulders': '💪',
    'Arms': '💪',
    'Legs': '🦵',
    'Core': '🎯',
    'Cardio': '❤️',
  };
  return emojiMap[category] || '💪';
};

// API functions
const historyApi = {
  async getWorkoutHistory(options = {}) {
    const { preset = 'week', days, startDate, endDate } = options;
    
    let queryParams = new URLSearchParams();
    if (preset) {
      queryParams.append('preset', preset);
    } else if (days) {
      queryParams.append('days', days);
    } else if (startDate && endDate) {
      queryParams.append('startDate', startDate);
      queryParams.append('endDate', endDate);
    }

    const response = await fetch(
      getApiUrl(`/history?${queryParams.toString()}`),
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}: Failed to fetch workout history`);
    }

    return response.json();
  },

  async getUserPRs(options = {}) {
    const { preset = 'month', days } = options;
    
    let queryParams = new URLSearchParams();
    if (preset) {
      queryParams.append('preset', preset);
    } else if (days) {
      queryParams.append('days', days);
    }

    const response = await fetch(
      getApiUrl(`/history/prs?${queryParams.toString()}`),
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}: Failed to fetch PRs`);
    }

    return response.json();
  },

  async getWorkoutStats(days = 30) {
    const response = await fetch(
      getApiUrl(`/history/stats?days=${days}`),
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}: Failed to fetch workout stats`);
    }

    return response.json();
  }
};

const WorkoutHistory = () => {
  const navigate = useNavigate();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('week');
  
  // Data states
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [prsByCategory, setPrsByCategory] = useState([]);
  const [rawSessions, setRawSessions] = useState([]);

  // Load all history data
  const loadHistoryData = useCallback(async (preset = 'week') => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`📊 Loading history data for: ${preset}`);
      
      // Fetch all data in parallel with proper error handling
      const [historyRes, prsRes, statsRes] = await Promise.all([
        historyApi.getWorkoutHistory({ preset }),
        historyApi.getUserPRs({ preset }),
        historyApi.getWorkoutStats(preset === 'week' ? 7 : 30),
      ]);

      console.log('✅ History data loaded:', {
        sessions: historyRes.sessions?.length || 0,
        prs: prsRes.prsByCategory?.length || 0,
        stats: statsRes.stats
      });

      // Store raw data
      setRawSessions(historyRes.sessions || []);
      setPrsByCategory(prsRes.prsByCategory || []);
      setWeeklyStats(statsRes.stats || null);

    } catch (err) {
      console.error('❌ Error loading history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Process raw sessions into grouped workout sessions
  const processedWorkoutSessions = useMemo(() => {
    if (!rawSessions.length) return [];

    console.log('🔄 Processing raw sessions:', rawSessions.length);

    // Group sessions by date and day name
    const sessionsByDateAndDay = rawSessions.reduce((acc, session) => {
      const date = session.created_at.split('T')[0];
      const key = `${date}-${session.day}`;
      
      if (!acc[key]) {
        acc[key] = {
          date,
          day: session.day,
          sessions: [],
          exercises: new Set(),
        };
      }
      
      acc[key].sessions.push(session);
      acc[key].exercises.add(session.user_program_schedule_id);
      
      return acc;
    }, {});

    // Convert to workout sessions with stats
    const workouts = Object.values(sessionsByDateAndDay).map(group => {
      const { date, day, sessions } = group;
      
      // Calculate stats
      const totalSets = sessions.length;
      const totalVolume = sessions.reduce((sum, s) => sum + (s.volume || 0), 0);
      const totalDuration = sessions.reduce((sum, s) => sum + (s.elapsed_time || 0), 0);
      const uniqueExercises = group.exercises.size;
      
      // Calculate planned vs completed for completion percentage
      const plannedSets = sessions.reduce((sum, s) => sum + (s.planned_sets || 0), 0);
      const completion = plannedSets > 0 ? Math.min(100, Math.round((totalSets / plannedSets) * 100)) : 100;
      
      // Get PRs for this session (highest weight per category)
      const prsByCategory = sessions
        .filter(s => s.weight && s.weight > 0 && s.exercise_category)
        .reduce((acc, session) => {
          const category = session.exercise_category;
          if (!acc[category] || session.weight > acc[category].weight) {
            acc[category] = {
              category,
              weight: `${session.weight}${session.weight_unit || 'kg'}`,
              exercise: session.exercise_name,
            };
          }
          return acc;
        }, {});

      return {
        name: day,
        date: formatDate(date),
        rawDate: date,
        exercises: { completed: uniqueExercises, total: uniqueExercises },
        sets: { completed: totalSets, total: Math.max(totalSets, plannedSets) },
        completion,
        duration: formatDuration(totalDuration),
        volume: formatVolume(totalVolume),
        prsByCategory: Object.values(prsByCategory),
        rawSessions: sessions,
      };
    });

    // Sort by date (newest first)
    const sorted = workouts.sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
    
    console.log('✅ Processed workout sessions:', sorted.length);
    return sorted;
  }, [rawSessions]);

  // Generate weekly overview from processed data
  const weeklyOverview = useMemo(() => {
    if (!weeklyStats && processedWorkoutSessions.length === 0) return null;

    const totalWorkouts = processedWorkoutSessions.length;
    const totalSets = weeklyStats?.total_sets || processedWorkoutSessions.reduce((sum, w) => sum + w.sets.completed, 0);
    const totalDuration = weeklyStats?.total_time || processedWorkoutSessions.reduce((sum, w) => {
      // Parse duration back to seconds for summing
      const duration = w.duration;
      if (duration.includes('h')) {
        const [hours, mins] = duration.split('h ').map(s => parseInt(s) || 0);
        return sum + (hours * 3600) + (mins * 60);
      }
      return sum + (parseInt(duration) * 60 || 0);
    }, 0);

    return {
      workouts: totalWorkouts,
      sets: totalSets,
      duration: formatDuration(totalDuration),
      avgCompletion: totalWorkouts > 0 
        ? Math.round(processedWorkoutSessions.reduce((sum, w) => sum + w.completion, 0) / totalWorkouts)
        : 0,
      prsByCategory: prsByCategory.map(pr => ({
        category: pr.category,
        emoji: getCategoryEmoji(pr.category),
        weight: `${pr.max_weight}${pr.weight_unit || 'kg'}`,
        exercise: pr.exercise_name,
      })),
    };
  }, [weeklyStats, processedWorkoutSessions, prsByCategory]);

  // Handle session click - navigate to detailed view
  const handleSessionClick = useCallback(async (session) => {
    try {
      console.log('📱 Loading session details for:', session.name, session.rawDate);
      
      // Create exercises from session data
      const exerciseGroups = session.rawSessions.reduce((acc, rawSession) => {
        const key = rawSession.user_program_schedule_id;
        if (!acc[key]) {
          acc[key] = {
            id: rawSession.user_program_schedule_id,
            scheduleId: rawSession.user_program_schedule_id,
            workout_id: rawSession.workout_id,
            name: rawSession.exercise_name,
            category: rawSession.exercise_category,
            type: rawSession.exercise_type || 'strength',
            sets: [],
            status: 'done',
          };
        }
        
        // Add set to exercise
        acc[key].sets.push({
          id: rawSession.set_number || acc[key].sets.length + 1,
          reps: rawSession.reps || 0,
          weight: rawSession.weight || 0,
          weightUnit: rawSession.weight_unit || 'kg',
          duration: rawSession.elapsed_time || null,
          status: 'done',
          completedAt: rawSession.created_at,
          isFromSession: true,
          isSynced: true,
        });
        
        return acc;
      }, {});

      // Sort sets within each exercise
      Object.values(exerciseGroups).forEach(exercise => {
        exercise.sets.sort((a, b) => a.id - b.id);
      });

      const exercises = Object.values(exerciseGroups);

      const workoutDetailData = {
        day: session.name,
        category: '',
        scheduleId: session.rawSessions[0]?.user_program_schedule_id,
        exercises: exercises,
        
        // Progress metadata
        totalSets: session.sets.completed,
        completedSets: session.sets.completed,
        progressPercentage: session.completion,
        
        // Workout state - set to review mode for historical data
        isCompleted: true,
        isReviewMode: true,
        
        // Session metadata
        sessionDate: session.rawDate,
        workoutName: session.name,
      };

      console.log('🎯 Navigating to historical workout:', workoutDetailData);

      navigate('/workout-detail', { 
        state: { 
          workoutData: workoutDetailData,
          isHistoryMode: true,
          originalApiData: {
            day_name: session.name,
            workouts: exercises.map(ex => ({
              scheduleId: ex.scheduleId,
              workout_id: ex.workout_id,
              name: ex.name,
              category: ex.category,
              type: ex.type,
              sessions: ex.sets.map(set => ({
                set_number: set.id,
                reps: set.reps,
                weight: { value: set.weight, unit: set.weightUnit },
                elapsed_time: set.duration,
                set_status: 'completed',
                created_at: set.completedAt,
              }))
            })),
          }
        } 
      });

    } catch (err) {
      console.error('❌ Error loading session details:', err);
      alert(`Error loading session: ${err.message}`);
    }
  }, [navigate]);

  // Handle time range change
  const handleTimeRangeChange = useCallback((range) => {
    if (range !== timeRange) {
      setTimeRange(range);
    }
  }, [timeRange]);

  // Handle retry
  const handleRetry = useCallback(() => {
    loadHistoryData(timeRange);
  }, [loadHistoryData, timeRange]);

  // Handle keyboard navigation for session cards
  const handleKeyDown = useCallback((event, session) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSessionClick(session);
    }
  }, [handleSessionClick]);

  // Load data on mount and time range change
  useEffect(() => {
    loadHistoryData(timeRange);
  }, [loadHistoryData, timeRange]);

  // Loading state
  if (loading) {
    return (
      <div className="workout-history-container">
        <div className="loading-state">
          <div className="spinner" role="status" aria-label="Loading workout history"></div>
          <span>Loading history...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="workout-history-container">
        <div className="error-state">
          <div className="error-icon" role="img" aria-label="Error">⚠️</div>
          <div className="error-title">Error Loading History</div>
          <div className="error-message">{error}</div>
          <button 
            onClick={handleRetry}
            className="retry-button"
            aria-label="Retry loading workout history"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="workout-history-container">
      
      {/* Header with time range selector */}
      <div className="history-header">
        
        <div className="time-range-selector" role="tablist" aria-label="Time range selection">
          <button
            onClick={() => handleTimeRangeChange('week')}
            className={`time-range-btn ${timeRange === 'week' ? 'active' : ''}`}
            role="tab"
            aria-selected={timeRange === 'week'}
            aria-controls="history-content"
          >
            Week
          </button>
          <button
            onClick={() => handleTimeRangeChange('month')}
            className={`time-range-btn ${timeRange === 'month' ? 'active' : ''}`}
            role="tab"
            aria-selected={timeRange === 'month'}
            aria-controls="history-content"
          >
            Month
          </button>
        </div>
      </div>

      {/* Main content */}
      <div id="history-content" role="tabpanel">
        
        {/* Weekly Overview */}
        {weeklyOverview && (
          <div className="overview-card">
            <div className="overview-header">
              <span className="overview-icon" role="img" aria-label="Statistics">📊</span>
              <h2 className="overview-title">
                Last {timeRange === 'week' ? '7' : '30'} Days
              </h2>
            </div>
            
            {/* Main Stats */}
            <div className="main-stats">
              <span className="stat-value">{weeklyOverview.workouts}</span> Workouts
              <span className="stat-separator" aria-hidden="true">•</span>
              <span className="stat-value">{weeklyOverview.sets}</span> Sets
              <span className="stat-separator" aria-hidden="true">•</span>
              <span className="stat-value">{weeklyOverview.duration}</span>
              <span className="stat-separator" aria-hidden="true">•</span>
              <span className="stat-value">{weeklyOverview.avgCompletion}%</span> Avg Completion
            </div>

            {/* Weekly PRs */}
            {weeklyOverview.prsByCategory.length > 0 && (
              <div className="pr-section">
                <div className="section-title">PR by Category</div>
                <div className="pr-list">
                  {weeklyOverview.prsByCategory.map((pr, index) => (
                    <div key={`${pr.category}-${index}`} className="pr-item">
                      <div className="pr-category">
                        <span className="category-emoji" role="img" aria-label={pr.category}>
                          {pr.emoji}
                        </span>
                        <span className="category-name">{pr.category}</span>
                      </div>
                      <span className="pr-weight">{pr.weight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        {weeklyOverview && processedWorkoutSessions.length > 0 && (
          <div className="section-divider" aria-hidden="true"></div>
        )}

        {/* Individual Workout Sessions */}
        <div className="sessions-container">
          {processedWorkoutSessions.length > 0 ? (
            processedWorkoutSessions.map((session) => (
              <div 
                key={`${session.rawDate}-${session.name}`} 
                className="session-card"
                onClick={() => handleSessionClick(session)}
                onKeyDown={(e) => handleKeyDown(e, session)}
                tabIndex={0}
                role="button"
                aria-label={`View details for ${session.name} workout on ${session.date}`}
              >
                
                {/* Session Header */}
                <div className="session-header">
                  <div className="session-info">
                    <h3 className="session-name">{session.name}</h3>
                    <p className="session-date">{session.date}</p>
                  </div>
                  <div className="completion-badge">
                    <div className={`completion-pill ${getCompletionColor(session.completion)}`}>
                      {session.completion}%
                    </div>
                  </div>
                </div>

                {/* Performance Stats */}
                <div className="stats-section">
                  <div className="stats-title">Performance</div>
                  <div className="stats-content">
                    <span className="stat-highlight">
                      {session.exercises.completed}/{session.exercises.total}
                    </span> Exercises
                    <span className="stat-separator" aria-hidden="true">•</span>
                    <span className="stat-highlight">
                      {session.sets.completed}/{session.sets.total}
                    </span> Sets
                  </div>
                </div>

                {/* Effort Stats */}
                <div className="stats-section">
                  <div className="stats-title">Effort</div>
                  <div className="stats-content">
                    <span className="stat-highlight">{session.duration}</span> Duration
                    <span className="stat-separator" aria-hidden="true">•</span>
                    <span className="stat-highlight">{session.volume}</span> Volume
                  </div>
                </div>

                {/* Session PRs */}
                {session.prsByCategory.length > 0 && (
                  <>
                    <div className="pr-divider" aria-hidden="true"></div>
                    <div className="session-pr-section">
                      <div className="section-title">PR by Category</div>
                      <div className="session-pr-list">
                        {session.prsByCategory.map((pr, prIndex) => (
                          <div key={`${pr.category}-${prIndex}`} className="session-pr-item">
                            <div className="pr-category">
                              <div className="category-icon" aria-hidden="true"></div>
                              <span className="category-name">{pr.category}</span>
                            </div>
                            <span className="pr-weight">{pr.weight}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-icon" role="img" aria-label="No workouts">💪</div>
              <h3 className="empty-title">No Workouts Yet</h3>
              <p className="empty-message">
                Start your first workout to see your history here.
              </p>
              <button 
                className="cta-button" 
                onClick={() => navigate('/schedule')}
                aria-label="Navigate to workout schedule"
              >
                Start Workout
              </button>
            </div>
          )}
        </div>

        {/* Show more button - only if we have more than 5 sessions */}
        {processedWorkoutSessions.length > 5 && (
          <button 
            className="show-more-button"
            onClick={() => {
              console.log('Show more clicked - implement pagination if needed');
              // Could implement pagination or show all functionality here
            }}
            aria-label="Show more workout history"
          >
            View All History
          </button>
        )}
        
      </div>
    </div>
  );
};

export default WorkoutHistory; 