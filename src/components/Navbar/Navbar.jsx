import { useState } from 'react';
import {
  Navbar,
  Container,
  Dropdown,
  Button,
} from 'react-bootstrap';
import ProfileModal from '../ProfileModal/ProfileModal';
import { toast } from '../ToastManager'; // ✅ Import global toast
import './Navbar.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default function AppNavbar({ token, setToken, meta, onPersonalized, fetchSchedule }) {
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [showUserModal, setShowUserModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('userName');
    setToken('');
    setUserName('');
  };

  const handleGetWorkout = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/personalize/plan`, {
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

      toast.show('success', '✅ Personalized workout plan generated!'); // ✅ Toast on success
      fetchSchedule?.();
    } catch (error) {
      toast.show('danger', '❌ ' + error.message); // ✅ Toast on error
    }
  };

  const displayName = userName || meta?.user_name || '';

  return (
    <>
      <Navbar bg="dark" variant="dark" className="custom-navbar">
        <Container fluid className="custom-container">
          <div className="navbar-flex w-100">

            {/* Left: Dropdown title */}
            <div className="nav-workout">
              <Dropdown align="start">
                <Dropdown.Toggle variant="dark" className="nav-title text-white p-0">
                  <span className="nav-header-title">
                    {token ? `${displayName}'s Workout` : 'Your Workout'}
                  </span>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {token ? (
                    <>
                      <Dropdown.Item onClick={() => { setAuthMode('profile'); setShowUserModal(true); }}>
                        Edit Profile
                      </Dropdown.Item>
                      <Dropdown.Item onClick={handleGetWorkout}>Get Workout</Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item onClick={handleLogout}>Logout</Dropdown.Item>
                    </>
                  ) : (
                    <Dropdown.Item onClick={() => { setAuthMode('login'); setShowUserModal(true); }}>
                      Login / Register
                    </Dropdown.Item>
                  )}
                </Dropdown.Menu>
              </Dropdown>

              {/* Mobile-only stacked date */}
              {token && (
                <div className="nav-header-dates-mobile">
                  {formatDate(meta.program_start)} — {formatDate(meta.expires_on)}
                </div>
              )}
            </div>

            {/* Desktop-only centered date */}
            {token && (
              <div className="nav-dates-desktop">
                {formatDate(meta.program_start)} — {formatDate(meta.expires_on)}
              </div>
            )}

            {/* Right: Auth Buttons */}
            {!token && (
              <div className="nav-user-button d-flex gap-2 ms-auto">
                <Button variant="outline-light" onClick={() => { setAuthMode('login'); setShowUserModal(true); }}>Login</Button>
                <Button variant="light" onClick={() => { setAuthMode('register'); setShowUserModal(true); }}>Register</Button>
              </div>
            )}
          </div>
        </Container>
      </Navbar>

      {/* Profile modal when user logs in or clicks edit */}
      {showUserModal && (
        <ProfileModal
          show={showUserModal}
          onHide={() => setShowUserModal(false)}
          token={token}
          setToken={setToken}
          userName={userName}
          setUserName={setUserName}
          authMode={authMode}
          setAuthMode={setAuthMode}
          onLoginSuccess={() => {
            onPersonalized?.();
            fetchSchedule?.();
          }}
          onSaveSuccess={() => {
            toast.show('success', '✅ Profile updated successfully!');
          }}
        />
      )}
    </>
  );
}
