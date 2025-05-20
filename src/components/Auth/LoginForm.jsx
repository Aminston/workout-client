import { useState } from 'react';
import { Form } from 'react-bootstrap';
import BaseModal from '@/components/BaseModal/BaseModal';

export default function LoginForm({ show, onHide, setToken, onLoginSuccess, setAuthMode }) {
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleChange = e => {
    setAuthForm({ ...authForm, [e.target.name]: e.target.value });
  };

  const handleLogin = async e => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('jwt_token', data.token);
      localStorage.setItem('userName', data.user.name || '');
      setToken(data.token);
      onLoginSuccess?.();
      onHide();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const isValid = authForm.email && authForm.password;

  return (
    <BaseModal
      show={show}
      onHide={onHide}
      title="Login"
      onCancel={onHide}
      onSubmit={handleLogin}
      canSubmit={isValid}
      isSubmitting={isLoggingIn}
      confirmLabel="Login"
    >
      <div className="modal-body">
        <Form.Control
          type="email"
          name="email"
          placeholder="Email"
          className="mb-2"
          value={authForm.email}
          onChange={handleChange}
          autoComplete="off"
        />
        <Form.Control
          type="password"
          name="password"
          placeholder="Password"
          className="mb-2"
          value={authForm.password}
          onChange={handleChange}
          autoComplete="off"
        />
        <p className="text-sm mt-2">
          No account?{' '}
          <button className="btn btn-link p-0" type="button" onClick={() => setAuthMode('register')}>
            Register here
          </button>
        </p>
      </div>
    </BaseModal>
  );
}