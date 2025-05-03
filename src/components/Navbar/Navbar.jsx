import React, { useEffect, useState, useCallback } from 'react';
import './Navbar.css';
import {
  Navbar as BSNavbar,
  Dropdown,
  Container,
  Button,
  Spinner
} from 'react-bootstrap';
import ProfileModal from '../ProfileModal/ProfileModal';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year:  'numeric',
    month: 'long',
    day:   'numeric'
  });
}

export default function Navbar({ onPersonalized }) {
  const [meta, setMeta] = useState({ program_start: '', expires_on: '' });
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [loadingPersonalize, setLoadingPersonalize] = useState(false);

  // Load token & name once
  useEffect(() => {
    const t = localStorage.getItem('X-API-Token');
    const n = localStorage.getItem('userName');
    if (t) setToken(t);
    if (n) setUserName(n);
  }, []);

  // Fetch program dates
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/weekly-schedule`)
      .then(r => r.json())
      .then(d => setMeta({ program_start: d.program_start, expires_on: d.expires_on }))
      .catch(console.error);
  }, []);

  const handlePersonalize = useCallback(async () => {
    if (!token) {
      alert('Please create a profile or login first.');
      return;
    }
    setLoadingPersonalize(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/personalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Token': token
        },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Fetch error');
      onPersonalized(data.personalized);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingPersonalize(false);
    }
  }, [token, onPersonalized]);

  return (
    <>
      <BSNavbar bg="dark" variant="dark" className="custom-navbar" expand="lg">
        <Container fluid className="custom-container d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between">
          <div>
            <Dropdown align="center">
              <Dropdown.Toggle variant="link" className="text-white fs-4 fw-bold p-0" aria-label="Workouts menu">
                {token ? `${userName}'s Workouts` : 'Your Workouts'}
              </Dropdown.Toggle>
              <Dropdown.Menu align="center">
                <Dropdown.Item onClick={() => setShowUserModal(true)}>
                  User Information
                </Dropdown.Item>
                <Dropdown.Item onClick={handlePersonalize}>
                  {loadingPersonalize ? <Spinner animation="border" size="sm" /> : 'Get Workouts'}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>

          <div className="subtitle text-white">
            {formatDate(meta.program_start)} — {formatDate(meta.expires_on)}
          </div>

          {!token && (
            <Button variant="primary" onClick={() => setShowUserModal(true)}>
              User Information
            </Button>
          )}
        </Container>
      </BSNavbar>

      <ProfileModal
        show={showUserModal}
        onHide={() => setShowUserModal(false)}
        token={token}
        setToken={setToken}
        setUserName={setUserName}
      />
    </>
  );
}