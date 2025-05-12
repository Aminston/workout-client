import './ProfileModal.css';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Button,
  Form,
  Spinner,
  Alert
} from 'react-bootstrap';
import useUserProfile from './hooks/useUserProfile';
import { toast } from '../ToastManager';

export default function ProfileModal({
  show, onHide, token, setToken,
  userName, setUserName,
  authMode, setAuthMode,
  onLoginSuccess,
  onSaveSuccess
}) {
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    form, isDirty, loading, error,
    dispatch, fetchProfile, resetForm,
    clearAll, hasFetched, saveProfile
  } = useUserProfile();

  useEffect(() => {
    if (show && authMode === 'profile' && token && !hasFetched) {
      fetchProfile(token, setUserName);
    }
    if (!show) clearAll();
  }, [show, authMode, token]);

  const handleChange = e => {
    dispatch({ type: 'CHANGE_FIELD', field: e.target.name, value: e.target.value });
  };

  const isProfileValid =
    form.name &&
    form.email &&
    form.birthday &&
    parseFloat(form.height) > 0 &&
    parseFloat(form.weight) > 0 &&
    form.training_goal &&
    form.training_experience;

  const handleSubmitProfile = async e => {
    e.preventDefault();
    const result = await saveProfile(token);
    if (result.success) {
      setUserName(form.name);
      resetForm();
      onHide();
      onSaveSuccess?.();
    } else {
      toast.show('danger', '❌ Failed to save profile');
    }
  };

  const handleAuthChange = e => {
    setAuthForm(a => ({ ...a, [e.target.name]: e.target.value }));
  };

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
      onLoginSuccess?.();
      onHide();
    } catch (err) {
      toast.show('danger', `❌ Login failed: ${err.message}`);
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

      const loginRes = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, password: authForm.password })
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error || 'Auto-login failed');

      localStorage.setItem('jwt_token', loginData.token);
      setToken(loginData.token);
      setShowSuccess(true);
      onLoginSuccess?.();
      onHide();
    } catch (err) {
      toast.show('danger', `❌ Registration failed: ${err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>User Account</Modal.Title>
      </Modal.Header>

      {token && authMode === 'profile' ? (
        <Form onSubmit={handleSubmitProfile}>
          <Modal.Body>
            <h6>Edit Profile</h6>
            {loading ? (
              <div className="text-center my-3"><Spinner animation="border" /></div>
            ) : (
              <fieldset disabled={loading} className="form-spaced">
                <Form.Control name="name" placeholder="Name" value={form.name} onChange={handleChange} autoComplete="off" />
                <Form.Control type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} autoComplete="off" />
                <Form.Control type="date" name="birthday" value={form.birthday} onChange={handleChange} />

                <div className="d-flex">
                  <Form.Control type="number" step="0.01" name="height" placeholder="Height" value={form.height} onChange={handleChange} />
                  <Form.Select name="height_unit" className="ms-2" value={form.height_unit} onChange={handleChange}>
                    <option value="cm">cm</option>
                    <option value="in">in</option>
                  </Form.Select>
                </div>

                <div className="d-flex">
                  <Form.Control type="number" step="0.1" name="weight" placeholder="Weight" value={form.weight} onChange={handleChange} />
                  <Form.Select name="weight_unit" className="ms-2" value={form.weight_unit} onChange={handleChange}>
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </Form.Select>
                </div>

                <Form.Control as="textarea" rows={2} name="background" placeholder="Background" value={form.background} onChange={handleChange} />

                <Form.Label>Training Goal</Form.Label>
                <Form.Select name="training_goal" value={form.training_goal} onChange={handleChange}>
                  <option value="">Select goal</option>
                  <option value="muscle_gain">Build Muscle</option>
                  <option value="fat_loss">Lose Fat</option>
                  <option value="tone_up">Tone Up</option>
                  <option value="improve_strength">Build Strength</option>
                  <option value="general_fitness">Improve Fitness</option>
                </Form.Select>

                <Form.Label>Training Experience</Form.Label>
                <Form.Select name="training_experience" value={form.training_experience} onChange={handleChange}>
                  <option value="">Select experience</option>
                  <option value="beginner">Beginner</option>
                  <option value="casual">Casual Lifter</option>
                  <option value="consistent">Consistent Trainer</option>
                  <option value="advanced">Advanced Lifter</option>
                </Form.Select>

                <Form.Label>Injury Caution Area</Form.Label>
                <Form.Select name="injury_caution_area" value={form.injury_caution_area} onChange={handleChange}>
                  <option value="none">None</option>
                  <option value="shoulders">Shoulders</option>
                  <option value="lower_back">Lower Back</option>
                  <option value="knees">Knees</option>
                  <option value="wrists">Wrists</option>
                  <option value="elbows">Elbows</option>
                  <option value="neck">Neck</option>
                  <option value="ankles">Ankles</option>
                  <option value="hips">Hips</option>
                </Form.Select>
              </fieldset>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button className="btn-standard btn-secondary" onClick={resetForm} disabled={!isDirty}>
              Cancel
            </Button>
            <Button className="btn-standard btn-primary" type="submit" disabled={!isProfileValid || !isDirty || loading}>
              Save
            </Button>
          </Modal.Footer>
        </Form>
      ) : authMode === 'login' ? (
        <Modal.Body>
          <h6>Login</h6>
          <Form.Control type="email" name="email" placeholder="Email" className="mb-2" value={authForm.email} onChange={handleAuthChange} autoComplete="off" />
          <Form.Control type="password" name="password" placeholder="Password" className="mb-3" value={authForm.password} onChange={handleAuthChange} autoComplete="off" />
          <div className="cta-row">
            <Button variant="link" className="me-auto" onClick={() => setAuthMode('register')}>No account? Create one</Button>
            <Button className="btn-accent" onClick={handleLogin} disabled={isLoggingIn || !authForm.email || !authForm.password}>
              {isLoggingIn ? <Spinner animation="border" size="sm" /> : 'Login'}
            </Button>
          </div>
        </Modal.Body>
      ) : (
        <Modal.Body>
          <h6>Register</h6>
          <Form.Control type="text" name="name" placeholder="Name" className="mb-2" value={authForm.name} onChange={handleAuthChange} autoComplete="off" />
          <Form.Control type="email" name="email" placeholder="Email" className="mb-2" value={authForm.email} onChange={handleAuthChange} autoComplete="off" />
          <Form.Control type="password" name="password" placeholder="Password" className="mb-3" value={authForm.password} onChange={handleAuthChange} autoComplete="off" />
          <div className="cta-row">
            <Button variant="link" className="me-auto" onClick={() => setAuthMode('login')}>Already have an account?</Button>
            <Button className="btn-accent" onClick={handleRegister} disabled={isRegistering || !authForm.name || !authForm.email || !authForm.password}>
              {isRegistering ? <Spinner animation="border" size="sm" /> : 'Register'}
            </Button>
          </div>
        </Modal.Body>
      )}
    </Modal>
  );
}
