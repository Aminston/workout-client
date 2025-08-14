// src/components/Auth/RegisterForm.jsx - Complete Final Version
import React, { useState } from 'react';
import { Modal, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { IoEye, IoEyeOff } from 'react-icons/io5';
import './AuthModal.css';

export default function RegisterForm({ 
  show,           // For direct modal usage (LandingPage)
  onHide,         // For direct modal usage
  setToken, 
  onLoginSuccess, 
  setAuthMode 
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear specific field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one letter and one number';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      console.log('🔐 Attempting registration for:', formData.email);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          password: formData.password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.log('❌ Registration failed:', data);
        
        // Handle specific error cases
        if (response.status === 400 && data.error?.includes('email is already registered')) {
          setErrors({ email: 'This email is already registered. Try logging in instead.' });
        } else if (response.status === 400) {
          setErrors({ general: data.error || 'Registration failed. Please check your information.' });
        } else if (response.status >= 500) {
          setErrors({ general: 'Server error. Please try again in a moment.' });
        } else {
          setErrors({ general: data.error || 'Registration failed' });
        }
        return;
      }

      console.log('✅ Registration successful');
      
      // Store token and user info
      localStorage.setItem('jwt_token', data.token);
      localStorage.setItem('userName', formData.name.trim());
      setToken(data.token);
      
      // Reset form
      setFormData({ name: '', email: '', password: '', confirmPassword: '' });
      setShowPassword(false);
      setShowConfirmPassword(false);
      setErrors({});
      
      // Success callback
      onLoginSuccess?.();
      
    } catch (error) {
      console.error('❌ Registration error:', error);
      
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
    setFormData({ name: '', email: '', password: '', confirmPassword: '' });
    setShowPassword(false);
    setShowConfirmPassword(false);
    onHide?.();
  };

  // Form content (used both for direct modal and UserAccountModal)
  const formContent = (
    <div className="auth-form">
      <div className="text-center mb-3">
        <p className="text-muted small">Start your personalized fitness journey</p>
      </div>

      {errors.general && (
        <Alert variant="danger" className="mb-3" dismissible onClose={() => setErrors(prev => ({ ...prev, general: '' }))}>
          ⚠️ {errors.general}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>Full Name</Form.Label>
          <Form.Control
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter your full name"
            disabled={loading}
            isInvalid={!!errors.name}
            autoComplete="name"
            required
          />
          <Form.Control.Feedback type="invalid">
            {errors.name}
          </Form.Control.Feedback>
        </Form.Group>

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
                // Prevent Enter from triggering form submit when focused on password field
                if (e.key === 'Enter') {
                  e.preventDefault();
                  // Focus next field
                  const confirmPasswordField = e.target.form.elements.confirmPassword;
                  if (confirmPasswordField) {
                    confirmPasswordField.focus();
                  }
                }
              }}
              placeholder="Create a secure password"
              disabled={loading}
              isInvalid={!!errors.password}
              autoComplete="new-password"
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

        <Form.Group className="mb-3">
          <Form.Label>Confirm Password</Form.Label>
          <div className="password-input-container">
            <Form.Control
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              onKeyDown={(e) => {
                // Allow Enter to submit form from confirm password field
                if (e.key === 'Enter' && !loading && formData.password && formData.confirmPassword) {
                  // Let the form submit naturally
                  return;
                }
              }}
              placeholder="Confirm your password"
              disabled={loading}
              isInvalid={!!errors.confirmPassword}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowConfirmPassword(!showConfirmPassword);
              }}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent focus stealing
              }}
              disabled={loading}
              title={showConfirmPassword ? "Hide password" : "Show password"}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              tabIndex="-1"
            >
              {showConfirmPassword ? (
                <IoEyeOff size={18} />
              ) : (
                <IoEye size={18} />
              )}
              <span className="sr-only">
                {showConfirmPassword ? "Hide password" : "Show password"}
              </span>
            </button>
          </div>
          <Form.Control.Feedback type="invalid">
            {errors.confirmPassword}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Text className="text-muted small d-block mb-3">
          Password must be at least 6 characters with letters and numbers
        </Form.Text>

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
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
        </Button>
      </Form>

      <div className="auth-switch-section">
        <p className="auth-switch-text">
          Already have an account?{' '}
          <button 
            type="button"
            className="btn btn-link p-0"
            onClick={() => setAuthMode?.('login')}
            disabled={loading}
          >
            Sign in here
          </button>
        </p>
      </div>
    </div>
  );

  // If show prop is provided, render as direct modal (for LandingPage)
  if (show !== undefined) {
    return (
      <Modal show={show} onHide={handleModalHide} centered size="lg" className="auth-modal">
        <Modal.Header closeButton>
          <Modal.Title>Create Account</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formContent}
        </Modal.Body>
      </Modal>
    );
  }

  // Otherwise, render as form component (for UserAccountModal)
  return formContent;
}