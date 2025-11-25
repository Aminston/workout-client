import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SplitSelectionModal.css';

export default function SplitSelectionModal({
  show,
  onHide,
  token,
  onSplitChanged
}) {
  const apiBase = import.meta.env.VITE_API_URL;
  const [splits, setSplits] = useState([]);
  const [currentSplit, setCurrentSplit] = useState(null);
  const [selectedSplitId, setSelectedSplitId] = useState(null);
  const [locations, setLocations] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [activeSection, setActiveSection] = useState('splits');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const splitsSectionRef = useRef(null);
  const locationsSectionRef = useRef(null);
  const scrollContainerRef = useRef(null);
  
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

    if (!apiBase) {
      cache.isLoading = false;
      setLoading(false);
      setError('Missing API configuration. Please set VITE_API_URL.');
      return null;
    }

    try {
      // Fetch available splits/locations and current user preferences in parallel
      const [splitsResponse, userPreferenceResponse, locationsResponse] = await Promise.all([
        fetch(`${apiBase}/schedule/v2/splits`, {
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${apiBase}/schedule/v2/user/split-preference`, {
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${apiBase}/schedule/v2/locations`, {
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
        throw new Error('Failed to fetch user split preference');
      }

      if (locationsResponse && !locationsResponse.ok) {
        throw new Error('Failed to fetch available locations');
      }

      const splitsData = await splitsResponse.json();
      const userPreferenceData = await userPreferenceResponse.json();
      const locationsData = await locationsResponse.json();

      // Some environments return the current selection alongside the location list
      const currentLocationFromLocations = locationsData.current_location || locationsData.selected_location;

      console.log('📋 Available splits:', splitsData);
      console.log('👤 User current split:', userPreferenceData);

      // ✅ BETTER: Store in cache and component state
      const fetchedData = {
        splits: splitsData.available_splits || [],
        currentSplit: userPreferenceData.current_split,
        locations: locationsData.available_locations || [],
        currentLocation: currentLocationFromLocations || null
      };

      // Update cache
      cache.data = fetchedData;
      cache.timestamp = Date.now();
      cache.isLoading = false;

      // Update component state
      setSplits(fetchedData.splits);
      setCurrentSplit(fetchedData.currentSplit);
      setSelectedSplitId(fetchedData.currentSplit?.id);
      setLocations(fetchedData.locations);
      setCurrentLocation(fetchedData.currentLocation);
      setSelectedLocationId(fetchedData.currentLocation?.id);

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
      setLocations(cachedData.locations);
      setCurrentLocation(cachedData.currentLocation);
      setSelectedLocationId(cachedData.currentLocation?.id);
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

  const handleApplyConfiguration = useCallback(async () => {
    const splitChanged = selectedSplitId && selectedSplitId !== currentSplit?.id;
    const locationChanged = selectedLocationId && selectedLocationId !== currentLocation?.id;

    if (!splitChanged && !locationChanged) {
      onHide();
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage('');

    if (!apiBase) {
      setSaving(false);
      setError('Missing API configuration. Please set VITE_API_URL.');
      return;
    }

    try {
      const messages = [];

      if (splitChanged) {
        const splitResponse = await fetch(
          `${apiBase}/schedule/v2/user/split-preference`,
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

        if (!splitResponse.ok) {
          const errorData = await splitResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to update split preference');
        }

        await splitResponse.json();
        const newSplit = splits.find(s => s.id === selectedSplitId);
        setCurrentSplit(newSplit);
        messages.push(`Workout split changed to "${newSplit?.name}".`);

        if (cacheRef.current.data) {
          cacheRef.current.data.currentSplit = newSplit;
        }

        if (onSplitChanged) {
          onSplitChanged(newSplit);
        }
      }

      if (locationChanged) {
        const locationResponse = await fetch(
          `${apiBase}/schedule/v2/locations`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              location_id: selectedLocationId
            })
          }
        );

        if (!locationResponse.ok) {
          const errorData = await locationResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to update location preference');
        }

        await locationResponse.json();
        const newLocation = locations.find(l => l.id === selectedLocationId);
        setCurrentLocation(newLocation);
        messages.push(`Workout location changed to "${newLocation?.name}".`);

        if (cacheRef.current.data) {
          cacheRef.current.data.currentLocation = newLocation;
        }
      }

      setSuccessMessage(messages.join(' '));

      setTimeout(() => {
        onHide();
      }, 2000);

    } catch (err) {
      console.error('❌ Error updating workout configuration:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [selectedSplitId, currentSplit?.id, selectedLocationId, currentLocation?.id, token, splits, locations, onSplitChanged, onHide]);

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

  const getLocationDescription = useCallback((location) => {
    if (!location) return '';

    if (location.description) return location.description;
    if (location.type) return location.type.replace(/_/g, ' ');
    return 'Preferred workout location';
  }, []);

  const getLocationTitle = useCallback((location) => {
    const isCurrent = location.id === currentLocation?.id;
    if (isCurrent) {
      return (
        <>
          {location.name}
          <span className="status-indicator current">(current)</span>
        </>
      );
    }

    return location.name;
  }, [currentLocation?.id]);

  const handleTabClick = useCallback((section) => {
    setActiveSection(section);
    const ref = section === 'splits' ? splitsSectionRef : locationsSectionRef;
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !show) return undefined;

    const handleScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      const sections = [
        { key: 'splits', ref: splitsSectionRef },
        { key: 'locations', ref: locationsSectionRef }
      ];

      const closest = sections.reduce((closestSection, current) => {
        if (!current.ref.current) return closestSection;
        const rect = current.ref.current.getBoundingClientRect();
        const distance = Math.abs(rect.top - containerTop);
        if (!closestSection || distance < closestSection.distance) {
          return { key: current.key, distance };
        }
        return closestSection;
      }, null);

      if (closest && closest.key !== activeSection) {
        setActiveSection(closest.key);
      }
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [show, activeSection]);

  const splitChanged = selectedSplitId && selectedSplitId !== currentSplit?.id;
  const locationChanged = selectedLocationId && selectedLocationId !== currentLocation?.id;
  const applyDisabled = saving || loading || (!selectedSplitId && !selectedLocationId);
  const applyVariant = splitChanged || locationChanged ? 'primary' : 'no-change';

  // Don't render if modal is not shown
  if (!show) return null;

  return (
    <div className="split-modal-overlay" onClick={(e) => e.target === e.currentTarget && onHide()}>
      <div className="split-modal-content">
        {/* Header */}
        <div className="split-modal-header">
          <h3 className="split-modal-title">
            🏋️ Workout Configuration
          </h3>
          <button className="split-modal-close" onClick={onHide}>
            ×
          </button>
        </div>

        {/* Body */}
        <div className="split-modal-body" ref={scrollContainerRef}>
          {loading ? (
            <div className="split-modal-loading">
              <div className="split-modal-loading-icon">⏳</div>
              <span>Loading workout configuration...</span>
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

              <div className="split-modal-tabs">
                <button
                  className={`split-modal-tab ${activeSection === 'splits' ? 'active' : ''}`}
                  onClick={() => handleTabClick('splits')}
                >
                  Splits
                </button>
                <button
                  className={`split-modal-tab ${activeSection === 'locations' ? 'active' : ''}`}
                  onClick={() => handleTabClick('locations')}
                >
                  Locations
                </button>
              </div>

              <section ref={splitsSectionRef} className="config-section" id="splits">
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
              </section>

              <section ref={locationsSectionRef} className="config-section" id="locations">
                <div className="split-modal-current-info">
                  <p className="split-modal-current-title">
                    <strong>Current Location:</strong> {currentLocation?.name || 'Default Location'}
                  </p>
                  <small className="split-modal-current-subtitle">
                    💡 Updating your location helps us tailor equipment and exercise recommendations.
                  </small>
                </div>

                <div className="split-selection-list">
                  {locations.length === 0 ? (
                    <div className="split-option empty">No available locations.</div>
                  ) : (
                    locations.map(location => (
                      <div
                        key={location.id}
                        className={`split-option ${selectedLocationId === location.id ? 'selected' : ''}`}
                        onClick={() => setSelectedLocationId(location.id)}
                      >
                        <div className="split-option-content">
                          <div className="split-option-radio">
                            <input
                              type="radio"
                              name="location-selection"
                              checked={selectedLocationId === location.id}
                              onChange={() => setSelectedLocationId(location.id)}
                            />
                          </div>
                          <div className="split-option-details">
                            <div className="split-option-header">
                              <h6 className="split-option-name">
                                {getLocationTitle(location)}
                              </h6>
                            </div>

                            <p className="split-option-description">
                              {getLocationDescription(location)}
                            </p>

                            {location.notes && (
                              <div className="split-option-summary">
                                📍 {location.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
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
            className={`split-modal-btn ${applyVariant}`}
            onClick={handleApplyConfiguration}
            disabled={applyDisabled}
          >
            {saving ? (
              <>
                <span className="split-modal-btn-spinner"></span>
                Saving...
              </>
            ) : 'Apply Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}