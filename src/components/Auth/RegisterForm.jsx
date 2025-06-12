import { useState } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import BaseModal from '@/components/BaseModal/BaseModal';
import { useNavigate } from 'react-router-dom';

export default function RegisterForm({ show, onHide, setToken, onLoginSuccess, setAuthMode }) {
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setAuthForm({ ...authForm, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsRegistering(true);
    try {
      const registerRes = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });
      const registerData = await registerRes.json();
      if (!registerRes.ok) throw new Error(registerData.error || 'Registration failed');

      const loginRes = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, password: authForm.password }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error || 'Auto-login failed');

      const userName = loginData.user?.name || '';
      localStorage.setItem('jwt_token', loginData.token);
      localStorage.setItem('userName', userName);
      setToken(loginData.token);
      onLoginSuccess?.();
      navigate('/schedule');
      onHide();
    } catch (err) {
      console.error('❌ Registration error:', err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <BaseModal show={show} onHide={onHide} title="Register">
      <Form onSubmit={handleSubmit}>
        <Form.Control
          type="text"
          name="name"
          placeholder="Name"
          className="mb-2"
          value={authForm.name}
          onChange={handleChange}
          autoComplete="off"
          required
        />
        <Form.Control
          type="email"
          name="email"
          placeholder="Email"
          className="mb-2"
          value={authForm.email}
          onChange={handleChange}
          autoComplete="off"
          required
        />
        <Form.Control
          type="password"
          name="password"
          placeholder="Password"
          className="mb-2"
          value={authForm.password}
          onChange={handleChange}
          autoComplete="off"
          required
        />
        <p className="text-sm mt-2">
          Already have an account?{' '}
          <button className="btn btn-link p-0" type="button" onClick={() => setAuthMode('login')}>
            Login here
          </button>
        </p>
        <div className="modal-footer modal-footer-actions mt-3">
          <Button type="button" onClick={onHide} className="btn-outline-secondary btn-modal-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isRegistering} className="btn-modal-confirm btn-accent">
            {isRegistering ? <Spinner size="sm" animation="border" /> : 'Register'}
          </Button>
        </div>
      </Form>
    </BaseModal>
  );
}
