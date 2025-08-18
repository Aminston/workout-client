import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SplitSelectionModal.css';

export default function SplitSelectionModal({ 
  show, 
  onHide, 
  token, 
  onSplitChanged 
}) {
  const [splits, setSplits] = useState([]);
  const [currentSplit, setCurrentSplit] = useState(null);
  const [selectedSplitId, setSelectedSplitId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  // ✅ BETTER: Single cache object with all data
  const cacheRef = useRef({
    data: null,
    token: null,
    timestamp: 0,
    isLoading: false
  });
  
  // ✅ BETTER: Cache duration
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  // ✅ BETTER: Check if cache is valid without causing re-renders
  const isCacheValid = useCallback((currentToken) => {
    const cache = cacheRef.current;
    const now = Date.now();
    
    return cache.data && 
           cache.token === currentToken && 
           (now - cache.timestamp) < CACHE_DURATION &&
           !cache.isLoading;
  }, [CACHE_DURATION]);

  // ✅ BETTER: Single fetch function that prevents duplicate calls
  const fetchData = useCallback(async (currentToken) => {
    const cache = cacheRef.current;
    
    // Prevent duplicate calls - check if already loading for this token
    if (cache.isLoading && cache.token === currentToken) {
      console.log('📋 Fetch already in progress for this token');
      return cache.data;
    }
    
    // Use cache if valid
    if (isCacheValid(currentToken)) {
      console.log('📋 Using cached data');
      return cache.data;
    }

    console.log('📋 Starting fresh fetch');
    
    // Mark as loading
    cache.isLoading = true;
    cache.token = currentToken;
    setLoading(true);
    setError(null);
    
    try {
      // Fetch available splits and current user preference in parallel
      const [splitsResponse, userPreferenceResponse] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/schedule/v2/splits`, {
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${import.meta.env.VITE_API_URL}/schedule/v2/user/split-preference`, {
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (!splitsResponse.ok) {
        throw new Error('Failed to fetch available splits');
      }
      
      if (!userPreferenceResponse.ok) {
        throw new Error('Failed to fetch user preference');
      }

      const splitsData = await splitsResponse.json();
      const userPreferenceData = await userPreferenceResponse.json();

      console.log('📋 Available splits:', splitsData);
      console.log('👤 User current split:', userPreferenceData);

      // ✅ BETTER: Store in cache and component state
      const fetchedData = {
        splits: splitsData.available_splits || [],
        currentSplit: userPreferenceData.current_split
      };

      // Update cache
      cache.data = fetchedData;
      cache.timestamp = Date.now();
      cache.isLoading = false;

      // Update component state
      setSplits(fetchedData.splits);
      setCurrentSplit(fetchedData.currentSplit);
      setSelectedSplitId(fetchedData.currentSplit?.id);

      return fetchedData;

    } catch (err) {
      console.error('❌ Error fetching split data:', err);
      
      // Clear loading state in cache
      cache.isLoading = false;
      
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isCacheValid]);

  // ✅ BETTER: Simple effect that only runs when absolutely necessary
  useEffect(() => {
    if (!show) {
      // Reset UI states when modal closes (but keep cache)
      setError(null);
      setSuccessMessage('');
      return;
    }

    if (!token) {
      return;
    }

    // ✅ KEY IMPROVEMENT: Check cache WITHOUT triggering effect dependencies
    if (isCacheValid(token)) {
      const cachedData = cacheRef.current.data;
      console.log('📋 Modal opened - loading from cache');
      
      setSplits(cachedData.splits);
      setCurrentSplit(cachedData.currentSplit);
      setSelectedSplitId(cachedData.currentSplit?.id);
      setLoading(false);
    } else {
      console.log('📋 Modal opened - need to fetch');
      fetchData(token);
    }
  }, [show, token]); // ✅ STABLE: Only show and token as dependencies

  // ✅ BETTER: Force refresh function that bypasses cache
  const handleRetry = useCallback(() => {
    // Clear cache to force fresh fetch
    cacheRef.current = {
      data: null,
      token: null,
      timestamp: 0,
      isLoading: false
    };
    
    if (token) {
      fetchData(token);
    }
  }, [token, fetchData]);

  // ✅ OPTIMIZED: Memoized split selection handler
  const handleSplitSelection = useCallback(async () => {
    if (!selectedSplitId || selectedSplitId === currentSplit?.id) {
      onHide();
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/schedule/v2/user/split-preference`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            split_id: selectedSplitId
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update split preference');
      }

      const result = await response.json();
      console.log('✅ Split preference updated:', result);
      
      const newSplit = splits.find(s => s.id === selectedSplitId);
      setCurrentSplit(newSplit);
      setSuccessMessage(`Workout split changed to "${newSplit?.name}". This will apply to your next workout program.`);
      
      // ✅ BETTER: Update cache with new current split
      if (cacheRef.current.data) {
        cacheRef.current.data.currentSplit = newSplit;
      }
      
      // Notify parent component
      if (onSplitChanged) {
        onSplitChanged(newSplit);
      }

      // Auto-close modal after success
      setTimeout(() => {
        onHide();
      }, 2000);

    } catch (err) {
      console.error('❌ Error updating split preference:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [selectedSplitId, currentSplit?.id, token, splits, onSplitChanged, onHide]);

  // ✅ OPTIMIZED: Memoized utility functions
  const getSplitSummary = useCallback((split) => {
    if (!split.summary) return '';
    
    const { workout_days, total_exercises, exercises_per_day } = split.summary;
    return `${workout_days} workout days • ${total_exercises} exercises • ~${exercises_per_day} per day`;
  }, []);

  const getSplitDescription = useCallback((splitType) => {
    const descriptions = {
      'upper_lower': 'Alternates between upper body and lower body focus days',
      'push_pull_legs': 'Separates pushing, pulling, and leg movements',
      'body_part_split': 'Targets specific muscle groups each day',
      'full_body': 'Works all major muscle groups each session'
    };
    return descriptions[splitType] || 'Structured workout routine';
  }, []);

  // ✅ OPTIMIZED: Memoized split title function
  const getSplitTitle = useCallback((split) => {
    const isDefault = split.is_default;
    const isCurrent = split.id === currentSplit?.id;
    
    if (isCurrent) {
      return (
        <>
          {split.name}
          <span className="status-indicator current">(current)</span>
        </>
      );
    }
    
    if (isDefault) {
      return (
        <>
          {split.name}
          <span className="status-indicator">(default)</span>
        </>
      );
    }
    
    return split.name;
  }, [currentSplit?.id]);

  // Don't render if modal is not shown
  if (!show) return null;

  return (
    <div className="split-modal-overlay" onClick={(e) => e.target === e.currentTarget && onHide()}>
      <div className="split-modal-content">
        {/* Header */}
        <div className="split-modal-header">
          <h3 className="split-modal-title">
            🏋️ Choose Your Workout Split
          </h3>
          <button className="split-modal-close" onClick={onHide}>
            ×
          </button>
        </div>
        
        {/* Body */}
        <div className="split-modal-body">
          {loading ? (
            <div className="split-modal-loading">
              <div className="split-modal-loading-icon">⏳</div>
              <span>Loading workout splits...</span>
            </div>
          ) : error ? (
            <div className="split-modal-error">
              <strong>Error:</strong> {error}
              <div>
                <button className="split-modal-error-retry" onClick={handleRetry}>
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <>
              {successMessage && (
                <div className="split-modal-success">
                  ✅ {successMessage}
                </div>
              )}
              
              <div className="split-modal-current-info">
                <p className="split-modal-current-title">
                  <strong>Current Split:</strong> {currentSplit?.name || 'Default Split'}
                </p>
                <small className="split-modal-current-subtitle">
                  💡 Changing your split will apply to your next workout program (when current one expires).
                </small>
              </div>

              <div className="split-selection-list">
                {splits.map(split => (
                  <div
                    key={split.id}
                    className={`split-option ${selectedSplitId === split.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSplitId(split.id)}
                  >
                    <div className="split-option-content">
                      <div className="split-option-radio">
                        <input
                          type="radio"
                          name="split-selection"
                          checked={selectedSplitId === split.id}
                          onChange={() => setSelectedSplitId(split.id)}
                        />
                      </div>
                      <div className="split-option-details">
                        <div className="split-option-header">
                          <h6 className="split-option-name">
                            {getSplitTitle(split)}
                          </h6>
                        </div>
                        
                        <p className="split-option-description">
                          {getSplitDescription(split.type)}
                        </p>
                        
                        {split.summary && (
                          <div className="split-option-summary">
                            📊 {getSplitSummary(split)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {splits.length === 0 && (
                <div className="split-modal-empty">
                  No workout splits available. Please contact support.
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="split-modal-footer">
          <button
            className="split-modal-btn cancel"
            onClick={onHide}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className={`split-modal-btn ${selectedSplitId === currentSplit?.id ? 'no-change' : 'primary'}`}
            onClick={handleSplitSelection}
            disabled={saving || loading || !selectedSplitId}
          >
            {saving ? (
              <>
                <span className="split-modal-btn-spinner"></span>
                Saving...
              </>
            ) : selectedSplitId === currentSplit?.id ? (
              'No Change'
            ) : (
              'Apply Split'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}