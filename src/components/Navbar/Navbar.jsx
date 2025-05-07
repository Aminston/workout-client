import { useState } from 'react';
import './Navbar.css';
import {
  Navbar,
  Container,
  Dropdown,
  Button,
} from 'react-bootstrap';
import ProfileModal from '../ProfileModal/ProfileModal';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year:  'numeric',
    month: 'long',
    day:   'numeric'
  });
}

export default function AppNavbar({ onPersonalized, meta }) {
  const [token, setToken] = useState(localStorage.getItem('jwt_token') || '');
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

      alert('✅ Personalized workout plan generated!');
      onPersonalized?.();
    } catch (error) {
      alert('❌ Error: ' + error.message);
    }
  };

  return (
    <>
      <Navbar variant="dark" className="custom-navbar">
        <Container fluid className="custom-container">
          <div className="navbar-flex w-100">
            <div className="nav-workout">
              <Dropdown align="end">
                <Dropdown.Toggle variant="link" className="text-white fs-4 fw-bold p-0">
                  {token ? `${userName || meta.user_name || ''}'s Workouts` : 'Your Workouts'}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {token ? (
                    <>
                      <Dropdown.Item onClick={() => { setAuthMode('profile'); setShowUserModal(true); }}>
                        Edit Profile
                      </Dropdown.Item>
                      <Dropdown.Item onClick={handleGetWorkout}>
                        Get Workout
                      </Dropdown.Item>
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
            </div>

            <div className="nav-dates text-center flex-grow-1">
              {formatDate(meta.program_start)} — {formatDate(meta.expires_on)}
            </div>

            {!token && (
              <div className="nav-user-button d-flex gap-2">
                <Button variant="outline-light" onClick={() => { setAuthMode('login'); setShowUserModal(true); }}>Login</Button>
                <Button variant="light" onClick={() => { setAuthMode('register'); setShowUserModal(true); }}>Register</Button>
              </div>
            )}
          </div>
        </Container>
      </Navbar>

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
          onLoginSuccess={onPersonalized}
        />
      )}
    </>
  );
}
