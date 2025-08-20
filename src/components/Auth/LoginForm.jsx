// src/components/Auth/LoginForm.jsx - Complete with React Icons
import React, { useState } from 'react';
import { Modal, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { IoEye, IoEyeOff } from 'react-icons/io5';
import './AuthModal.css';

export default function LoginForm({ 
  show,
  onHide,
  setToken, 
  onLoginSuccess, 
  setAuthMode 
}) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      console.log('🔐 Attempting login for:', formData.email);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.toLowerCase().trim(),
          password: formData.password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log('❌ Login failed:', data);
        
        if (response.status === 401) {
          setErrors({ general: 'Invalid email or password. Please try again.' });
        } else if (response.status >= 500) {
          setErrors({ general: 'Server error. Please try again in a moment.' });
        } else {
          setErrors({ general: data.error || 'Login failed' });
        }
        return;
      }

      console.log('✅ Login successful');

      localStorage.setItem('jwt_token', data.token);
      setToken(data.token);
      
      setFormData({ email: '', password: '' });
      setShowPassword(false);
      setErrors({});
      
      onLoginSuccess?.();
      
    } catch (error) {
      console.error('❌ Login error:', error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setErrors({ general: 'Connection error. Please check your internet connection and try again.' });
      } else {
        setErrors({ general: 'An unexpected error occurred. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleModalHide = () => {
    setErrors({});
    setFormData({ email: '', password: '' });
    setShowPassword(false);
    onHide?.();
  };

  const formContent = (
    <div className="auth-form">
      <div className="text-center mb-3">
        <p className="text-muted small">Welcome back! Please sign in to continue</p>
      </div>

      {errors.general && (
        <Alert variant="danger" className="mb-3" dismissible onClose={() => setErrors(prev => ({ ...prev, general: '' }))}>
          ⚠️ {errors.general}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>Email Address</Form.Label>
          <Form.Control
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            disabled={loading}
            isInvalid={!!errors.email}
            autoComplete="email"
            required
          />
          <Form.Control.Feedback type="invalid">
            {errors.email}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Password</Form.Label>
          <div className="password-input-container">
            <Form.Control
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              onKeyDown={(e) => {
                // Allow Enter to submit form from password field
                if (e.key === 'Enter' && !loading && formData.email && formData.password) {
                  // Let the form submit naturally
                  return;
                }
              }}
              placeholder="Enter your password"
              disabled={loading}
              isInvalid={!!errors.password}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowPassword(!showPassword);
              }}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent focus stealing
              }}
              disabled={loading}
              title={showPassword ? "Hide password" : "Show password"}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex="-1"
            >
              {showPassword ? (
                <IoEyeOff size={18} />
              ) : (
                <IoEye size={18} />
              )}
              <span className="sr-only">
                {showPassword ? "Hide password" : "Show password"}
              </span>
            </button>
          </div>
          <Form.Control.Feedback type="invalid">
            {errors.password}
          </Form.Control.Feedback>
        </Form.Group>

        <Button
          variant="primary"
          type="submit"
          className="w-100 py-2 mb-3"
          disabled={loading}
        >
          {loading ? (
            <>
              <Spinner
                animation="border"
                size="sm"
                className="me-2"
                role="status"
                aria-hidden="true"
              />
              Signing In...
            </>
          ) : (
            'Sign In'
          )}
        </Button>
      </Form>

      <div className="auth-switch-section">
        <p className="auth-switch-text">
          Don't have an account?{' '}
          <button 
            type="button"
            className="btn btn-link p-0"
            onClick={() => setAuthMode?.('register')}
            disabled={loading}
          >
            Create one here
          </button>
        </p>
      </div>
    </div>
  );

  if (show !== undefined) {
    return (
      <Modal show={show} onHide={handleModalHide} centered size="lg" className="auth-modal">
        <Modal.Header closeButton>
          <Modal.Title>Welcome Back</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formContent}
        </Modal.Body>
      </Modal>
    );
  }

  return formContent;
}