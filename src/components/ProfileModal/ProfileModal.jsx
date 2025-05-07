import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Form,
  Spinner,
  Alert
} from 'react-bootstrap';

export default function ProfileModal({ show, onHide, token, setToken, userName, setUserName, authMode, setAuthMode, onLoginSuccess }) {
  const [form, setForm] = useState({
    name: '', email: '', birthday: '', height: '', height_unit: 'm',
    weight: '', weight_unit: 'kg', background: ''
  });
  const [originalForm, setOriginalForm] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Load profile info on modal open
  useEffect(() => {
    if (!show || authMode !== 'profile' || !token) return;
    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch profile');
        const data = await res.json();
        const birthdayIso = data.birthday ? new Date(data.birthday).toISOString().split('T')[0] : '';
        const loaded = {
          name: data.name || '',
          email: data.email || '',
          birthday: birthdayIso,
          height: data.height?.toString() || '',
          height_unit: data.height_unit || 'm',
          weight: data.weight?.toString() || '',
          weight_unit: data.weight_unit || 'kg',
          background: data.background || ''
        };
        setForm(loaded);
        setOriginalForm(loaded);
        setIsDirty(false);
        setUserName(data.name || '');
        localStorage.setItem('userName', data.name || '');
      } catch (err) {
        console.error('❌ Failed to load profile:', err.message);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [show, authMode, token]);

  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setIsDirty(true);
  };

  const isProfileValid = form.name && form.email && form.birthday && parseFloat(form.height) > 0 && parseFloat(form.weight) > 0;

  const handleSubmitProfile = async e => {
    e.preventDefault();
    setLoadingProfile(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, height: parseFloat(form.height), weight: parseFloat(form.weight) })
      });
      if (!res.ok) throw new Error('Update failed');
      setOriginalForm(form);
      setIsDirty(false);
      localStorage.setItem('userName', form.name);
      setUserName(form.name);
      onHide();
    } catch (err) {
      alert('Failed to update profile: ' + err.message);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleAuthChange = e => setAuthForm(a => ({ ...a, [e.target.name]: e.target.value }));

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, password: authForm.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('jwt_token', data.token);
      setToken(data.token);
      setUserName(data.name || '');
      localStorage.setItem('userName', data.name || '');
      onLoginSuccess?.(); // ✅ trigger schedule refresh
      onHide();
    } catch (err) {
      alert('Login failed: ' + err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async () => {
    setIsRegistering(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, password: authForm.password, name: authForm.name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      // ✅ Auto-login right after register
      const loginRes = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, password: authForm.password })
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error || 'Auto-login failed');

      localStorage.setItem('jwt_token', loginData.token);
      setToken(loginData.token);
      setUserName(authForm.name || '');
      localStorage.setItem('userName', authForm.name || '');
      setShowSuccess(true); // Optional: show success toast
      onLoginSuccess?.();   // ✅ refresh schedule
      onHide();
    } catch (err) {
      alert('Registration failed: ' + err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton><Modal.Title>User Account</Modal.Title></Modal.Header>
      <Modal.Body>
        {showSuccess && (
          <Alert
            variant="success"
            dismissible
            onClose={() => setShowSuccess(false)}
            className="mb-3"
          >
            🎉 Account created successfully. You are now logged in!
          </Alert>
        )}

        {token && authMode === 'profile' ? (
          <>
            <h6>Edit Profile</h6>
            <Form onSubmit={handleSubmitProfile}>
              <Form.Control className="mb-2" name="name" placeholder="Name" value={form.name} onChange={handleChange} />
              <Form.Control className="mb-2" type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} />
              <Form.Control className="mb-2" type="date" name="birthday" value={form.birthday} onChange={handleChange} />
              <div className="d-flex mb-2">
                <Form.Control type="number" step="0.01" name="height" placeholder="Height" value={form.height} onChange={handleChange} />
                <Form.Select name="height_unit" className="ms-2" value={form.height_unit} onChange={handleChange}>
                  <option value="m">m</option><option value="cm">cm</option>
                </Form.Select>
              </div>
              <div className="d-flex mb-2">
                <Form.Control type="number" step="0.1" name="weight" placeholder="Weight" value={form.weight} onChange={handleChange} />
                <Form.Select name="weight_unit" className="ms-2" value={form.weight_unit} onChange={handleChange}>
                  <option value="kg">kg</option><option value="lb">lb</option>
                </Form.Select>
              </div>
              <Form.Control as="textarea" rows={2} name="background" placeholder="Background" value={form.background} onChange={handleChange} />
              {isDirty && (
                <Modal.Footer>
                  <Button variant="secondary" onClick={() => { setForm(originalForm); setIsDirty(false); }}>Cancel</Button>
                  <Button variant="primary" type="submit" disabled={!isProfileValid || loadingProfile}>
                    {loadingProfile ? <Spinner animation="border" size="sm" /> : 'Save'}
                  </Button>
                </Modal.Footer>
              )}
            </Form>
          </>
        ) : authMode === 'login' ? (
          <>
            <h6>Login</h6>
            <Form.Control type="email" name="email" placeholder="Email" className="mb-2" value={authForm.email} onChange={handleAuthChange} />
            <Form.Control type="password" name="password" placeholder="Password" className="mb-3" value={authForm.password} onChange={handleAuthChange} />
            <div className="d-flex justify-content-between">
              <Button variant="link" onClick={() => setAuthMode('register')}>No account? Create one</Button>
              <Button variant="primary" onClick={handleLogin} disabled={isLoggingIn || !authForm.email || !authForm.password}>
                {isLoggingIn ? <Spinner animation="border" size="sm" /> : 'Login'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h6>Register</h6>
            <Form.Control type="text" name="name" placeholder="Name" className="mb-2" value={authForm.name} onChange={handleAuthChange} />
            <Form.Control type="email" name="email" placeholder="Email" className="mb-2" value={authForm.email} onChange={handleAuthChange} />
            <Form.Control type="password" name="password" placeholder="Password" className="mb-3" value={authForm.password} onChange={handleAuthChange} />
            <div className="d-flex justify-content-between">
              <Button variant="link" onClick={() => setAuthMode('login')}>Already have an account?</Button>
              <Button variant="success" onClick={handleRegister} disabled={isRegistering || !authForm.name || !authForm.email || !authForm.password}>
                {isRegistering ? <Spinner animation="border" size="sm" /> : 'Register'}
              </Button>
            </div>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
