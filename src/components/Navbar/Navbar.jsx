import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Navbar,
  Container,
  Dropdown,
  Button,
  Spinner
} from 'react-bootstrap';
import { toast } from '../ToastManager';
import UserProfileModal from '../ProfileModal/UserProfileModal';
import SplitSelectionModal from './SplitSelectionModal'; // ✅ NEW: Import split modal

import './Navbar.css';

function formatDate(dateStr) {
  return dateStr
    ? new Date(dateStr).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : '';
}

export default function AppNavbar({
  token,
  setToken,
  meta,
  fetchSchedule,
  loadingWorkout,
  setLoadingWorkout
}) {
  const navigate = useNavigate();
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false); // ✅ NEW: Split modal state
  
  // ✅ RESTORED: Cache profile for validation without duplicate API calls
  const [cachedProfile, setCachedProfile] = useState(null);
  const [lastProfileFetch, setLastProfileFetch] = useState(0);

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('userName');
    setToken('');
    setUserName('');
    navigate('/');
  };

  // ✅ RESTORED: Validate profile completeness with smart caching
  const validateUserProfile = async () => {
    const now = Date.now();
    const CACHE_DURATION = 30000; // 30 seconds cache
    
    // Use cached profile if recent and valid
    if (cachedProfile && (now - lastProfileFetch) < CACHE_DURATION) {
      console.log('📋 Using cached profile for validation');
      return validateProfileData(cachedProfile);
    }

    // Fetch fresh profile data
    try {
      console.log('🔍 Fetching fresh profile for validation...');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/user-profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const profile = await response.json();
      console.log('📋 Profile fetched for validation:', profile);

      // Cache the profile
      setCachedProfile(profile);
      setLastProfileFetch(now);

      return validateProfileData(profile);

    } catch (error) {
      console.error('❌ Profile validation error:', error);
      throw new Error('Unable to validate profile. Please try again.');
    }
  };

  // ✅ RESTORED: Profile validation logic
  const validateProfileData = (profile) => {
    const requiredFields = {
      birthday: profile.birthday,
      height: profile.height > 0 ? profile.height : null,
      weight: profile.weight > 0 ? profile.weight : null,
      training_goal: profile.training_goal,
      training_experience: profile.training_experience
    };

    const missingFields = [];
    
    if (!requiredFields.birthday) missingFields.push('Birthday');
    if (!requiredFields.height) missingFields.push('Height');
    if (!requiredFields.weight) missingFields.push('Weight');
    if (!requiredFields.training_goal) missingFields.push('Training Goal');
    if (!requiredFields.training_experience) missingFields.push('Experience Level');

    console.log('🔍 Profile Validation:', {
      requiredFields,
      missingFields,
      isComplete: missingFields.length === 0
    });

    return {
      isComplete: missingFields.length === 0,
      missingFields,
      profile
    };
  };

  // ✅ RESTORED: Workout generation with validation
  const handleGetWorkout = async () => {
    setLoadingWorkout(true);
    
    try {
      // Step 1: Validate user profile first
      console.log('🔍 Validating user profile...');
      const validation = await validateUserProfile();
      
      if (!validation.isComplete) {
        // Profile is incomplete - show helpful error message
        const fieldList = validation.missingFields.join(', ');
        
        toast.show('warning', 
          `⚠️ Please complete your profile first!\n\nMissing: ${fieldList}\n\nClick "Edit Profile" to add this information, then try "Get Workout" again.`
        );
        
        console.log('❌ Profile incomplete. Missing fields:', validation.missingFields);
        setLoadingWorkout(false);
        return;
      }

      // Step 2: Profile is complete - proceed with workout generation
      console.log('✅ Profile complete. Generating workout...');
      
      const res = await fetch(`${import.meta.env.VITE_API_URL}/personalize/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to generate workout plan');
      }

      toast.show('success', '✅ Personalized workout plan generated!');
      fetchSchedule?.();
      
    } catch (error) {
      console.error('❌ Get workout error:', error);
      toast.show('danger', '❌ ' + error.message);
    } finally {
      setLoadingWorkout(false);
    }
  };

  // ✅ ENHANCED: Handle profile modal and cache management
  const handleEditProfile = () => {
    setShowUserModal(true);
  };

  // ✅ NEW: Handle split selection modal
  const handleConfigureSplit = () => {
    setShowSplitModal(true);
  };

  // ✅ RESTORED: Handle profile save success and invalidate cache
  const handleProfileSaveSuccess = () => {
    toast.show('success', '✅ Profile updated successfully!');
    
    // Invalidate cached profile so it gets re-fetched for validation
    setCachedProfile(null);
    setLastProfileFetch(0);
    
    // Optional: Automatically retry workout generation after profile completion
    setTimeout(() => {
      console.log('🔄 Auto-retrying workout generation after profile update...');
      handleGetWorkout();
    }, 1000);
  };

  // ✅ NEW: Handle split change success
  const handleSplitChanged = (newSplit) => {
    toast.show('success', `✅ Workout split changed to "${newSplit?.name}". Will apply to your next program!`);
    
    // Optional: Refresh schedule if needed
    // fetchSchedule?.();
  };

  const displayName = userName || meta?.user_name || '';
  const programDates = `${formatDate(meta?.program_start)} — ${formatDate(meta?.expires_on)}`;

  return (
    <>
      <Navbar bg="dark" variant="dark" className="custom-navbar">
        <Container fluid className="custom-container">
          <div className="navbar-flex w-100">
            <div className="nav-workout">
              <Dropdown align="start">
                <Dropdown.Toggle variant="dark" className="nav-title text-white p-0">
                  <span className="nav-header-title">
                    {token ? `${displayName}'s Workout` : 'Your Workout'}
                  </span>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {token && (
                    <>
                      <Dropdown.Item onClick={handleEditProfile}>
                        📝 Edit Profile
                      </Dropdown.Item>
                      <Dropdown.Item onClick={handleConfigureSplit}>
                        🏋️ Configure Split
                      </Dropdown.Item>
                      <Dropdown.Item onClick={handleGetWorkout} disabled={loadingWorkout}>
                        {loadingWorkout ? (
                          <>
                            <span className="me-2">Loading</span>
                            <Spinner animation="border" size="sm" />
                          </>
                        ) : (
                          '🎯 Get Custom Workout'
                        )}
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item onClick={handleLogout}>
                        🚪 Logout
                      </Dropdown.Item>
                    </>
                  )}
                </Dropdown.Menu>
              </Dropdown>

              {token && <div className="nav-header-dates-mobile">{programDates}</div>}
            </div>

            {token ? (
              <div className="nav-dates-desktop">{programDates}</div>
            ) : (
              <div className="nav-user-button d-flex gap-2 ms-auto">
                <Button variant="outline-light" onClick={() => navigate('/login')}>Login</Button>
                <Button variant="light" onClick={() => navigate('/register')}>Register</Button>
              </div>
            )}
          </div>
        </Container>
      </Navbar>

      {/* ✅ EXISTING: Profile Modal */}
      {token && showUserModal && (
        <UserProfileModal
          show={showUserModal}
          onHide={() => setShowUserModal(false)}
          token={token}
          setUserName={setUserName}
          onSaveSuccess={handleProfileSaveSuccess}
        />
      )}

      {/* ✅ NEW: Split Selection Modal */}
      {token && showSplitModal && (
        <SplitSelectionModal
          show={showSplitModal}
          onHide={() => setShowSplitModal(false)}
          token={token}
          onSplitChanged={handleSplitChanged}
        />
      )}
    </>
  );
}