import { useState } from 'react';
import { Form } from 'react-bootstrap';
import BaseModal from '@/components/BaseModal/BaseModal';

export default function RegisterForm({ show, onHide, setToken, onLoginSuccess, setAuthMode }) {
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [isRegistering, setIsRegistering] = useState(false);

  const handleChange = e => {
    setAuthForm({ ...authForm, [e.target.name]: e.target.value });
  };

  const handleRegister = async e => {
    e.preventDefault();
    setIsRegistering(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
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
      localStorage.setItem('userName', loginData.user.name || '');
      setToken(loginData.token);
      onLoginSuccess?.();
      onHide();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRegistering(false);
    }
  };

  const isValid = authForm.name && authForm.email && authForm.password;

  return (
    <BaseModal
      show={show}
      onHide={onHide}
      title="Register"
      onCancel={onHide}
      onSubmit={handleRegister}
      canSubmit={isValid}
      isSubmitting={isRegistering}
      confirmLabel="Register"
    >
      <div className="modal-body">
        <Form.Control
          type="text"
          name="name"
          placeholder="Name"
          className="mb-2"
          value={authForm.name}
          onChange={handleChange}
          autoComplete="off"
        />
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
          Already have an account?{' '}
          <button className="btn btn-link p-0" type="button" onClick={() => setAuthMode('login')}>
            Login here
          </button>
        </p>
      </div>
    </BaseModal>
  );
}
