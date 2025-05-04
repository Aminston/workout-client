// src/components/Navbar/Navbar.jsx
import { useEffect, useState } from 'react';
import './Navbar.css';
import {
  Navbar,
  Container,
  Dropdown,
  Button,
  Modal,
  Form,
  Spinner,
  InputGroup,
  FormControl
} from 'react-bootstrap';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year:  'numeric',
    month: 'long',
    day:   'numeric'
  });
}

export default function AppNavbar() {
  const [meta, setMeta] = useState({ program_start: '', expires_on: '' });
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', birthday: '',
    height: '', height_unit: 'm',
    weight: '', weight_unit: 'kg',
    background: ''
  });
  const [originalForm, setOriginalForm] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loginTokenInput, setLoginTokenInput] = useState('');
  const [loadingPersonalize, setLoadingPersonalize] = useState(false);
  const [personalized, setPersonalized] = useState(null);

  // Load token & name
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

  // Load or clear form on modal open
  useEffect(() => {
    if (!showUserModal) return;
    if (token) {
      fetch(`${import.meta.env.VITE_API_URL}/api/user-profile`, {
        headers: { 'X-API-Token': token }
      })
        .then(r => r.json())
        .then(data => {
          const birthdayIso = data.birthday
            ? new Date(data.birthday).toISOString().slice(0, 10)
            : '';
          const loaded = {
            name:        data.name        || '',
            email:       data.email       || '',
            birthday:    birthdayIso      || '',
            height:      data.height?.toString()  || '',
            height_unit: data.height_unit        || 'm',
            weight:      data.weight?.toString()  || '',
            weight_unit: data.weight_unit        || 'kg',
            background:  data.background   || ''
          };
          setForm(loaded);
          setOriginalForm(loaded);
          setIsDirty(false);
        })
        .catch(() => {
          setForm(originalForm || {});
          setIsDirty(false);
        });
    } else {
      const empty = {
        name: '', email: '', birthday: '',
        height: '', height_unit: 'm',
        weight: '', weight_unit: 'kg',
        background: ''
      };
      setForm(empty);
      setOriginalForm(empty);
      setIsDirty(false);
    }
  }, [showUserModal, token]);

  // Handlers & validation
  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setIsDirty(true);
  };
  const isProfileValid =
    form.name &&
    form.email &&
    form.birthday &&
    parseFloat(form.height) > 0 &&
    parseFloat(form.weight) > 0;

  const handleSubmitProfile = async e => {
    e?.preventDefault();
    setLoadingProfile(true);
    const hasToken = Boolean(token);
    const method   = hasToken ? 'PUT' : 'POST';
    const url      = `${import.meta.env.VITE_API_URL}/api/user-profile`;
    const headers  = {
      'Content-Type': 'application/json',
      ...(hasToken ? { 'X-API-Token': token } : {})
    };

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          ...form,
          height: parseFloat(form.height),
          weight: parseFloat(form.weight)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      if (!hasToken && data.apiToken) {
        localStorage.setItem('X-API-Token', data.apiToken);
        setToken(data.apiToken);
      }
      localStorage.setItem('userName', form.name);
      setUserName(form.name);

      setOriginalForm(form);
      setIsDirty(false);
      setShowUserModal(false);
      setShowSuccess(true);
    } catch (err) {
      alert('Failed to save profile: ' + err.message);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleLoginChange = e => setLoginTokenInput(e.target.value);
  const handleLoginSubmit = e => {
    e?.preventDefault();
    localStorage.setItem('X-API-Token', loginTokenInput);
    setToken(loginTokenInput);
    setShowUserModal(false);
  };

  const handlePersonalize = async () => {
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
          'X-API-Token':   token
        },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Fetch error');
      setPersonalized(data.personalized);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingPersonalize(false);
    }
  };

  return (
    <>
      <Navbar variant="dark" className="custom-navbar">
        <Container fluid className="custom-container">
          <div className="navbar-flex">
            {/* Workouts dropdown (always left) */}
            <div className="nav-workout">
              <Dropdown align="end">
                <Dropdown.Toggle variant="link" className="text-white fs-4 fw-bold p-0">
                  {token ? `${userName}'s Workouts` : 'Your Workouts'}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => setShowUserModal(true)}>
                    User Information
                  </Dropdown.Item>
                  <Dropdown.Item onClick={handlePersonalize}>
                    Get Workouts
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>

            {/* Program dates (center on desktop) */}
            <div className="nav-dates">
              {formatDate(meta.program_start)} — {formatDate(meta.expires_on)}
            </div>

            {/* Optional “User Information” button on the right (when no token) */}
            <div className="nav-user-button">
              {!token && (
                <Button variant="link" className="text-white p-0" onClick={() => setShowUserModal(true)}>
                  User Information
                </Button>
              )}
            </div>
          </div>
        </Container>
      </Navbar>

      {/* Profile Modal */}
      <Modal
        show={showUserModal}
        onHide={() => setShowUserModal(false)}
        backdrop="static"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{token ? 'Edit Profile' : 'Create Profile'}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {/* If no token yet, allow pasting an existing API token */}
          {!token && (
            <Form onSubmit={handleLoginSubmit} className="mb-3">
              <Form.Group controlId="loginToken">
                <Form.Label>API Token</Form.Label>
                <InputGroup>
                  <FormControl
                    type="text"
                    placeholder="Paste your API token"
                    value={loginTokenInput}
                    onChange={handleLoginChange}
                  />
                  <Button variant="outline-secondary" onClick={handleLoginSubmit}>
                    Login
                  </Button>
                </InputGroup>
              </Form.Group>
            </Form>
          )}

          {/* Main profile form */}
          <Form onSubmit={handleSubmitProfile}>
            <Form.Group className="mb-3" controlId="name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="email">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="birthday">
              <Form.Label>Birthday</Form.Label>
              <Form.Control
                type="date"
                name="birthday"
                value={form.birthday}
                onChange={handleChange}
              />
            </Form.Group>

            <InputGroup className="mb-3">
              <FormControl
                type="number"
                placeholder="Height"
                name="height"
                value={form.height}
                onChange={handleChange}
              />
              <Form.Select
                name="height_unit"
                value={form.height_unit}
                onChange={handleChange}
              >
                <option value="m">m</option>
                <option value="cm">cm</option>
                <option value="in">in</option>
              </Form.Select>
            </InputGroup>

            <InputGroup className="mb-3">
              <FormControl
                type="number"
                placeholder="Weight"
                name="weight"
                value={form.weight}
                onChange={handleChange}
              />
              <Form.Select
                name="weight_unit"
                value={form.weight_unit}
                onChange={handleChange}
              >
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </Form.Select>
            </InputGroup>

            <Form.Group className="mb-3" controlId="background">
              <Form.Label>Background</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="background"
                value={form.background}
                onChange={handleChange}
              />
            </Form.Group>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowUserModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmitProfile}
            disabled={!isProfileValid || loadingProfile}
          >
            {loadingProfile && <Spinner animation="border" size="sm" className="me-2" />}
            {token ? 'Save Changes' : 'Create Profile'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Success Modal */}
      <Modal show={showSuccess} onHide={() => setShowSuccess(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Profile Saved</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Your profile has been successfully {token ? 'updated' : 'created'}.
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setShowSuccess(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
