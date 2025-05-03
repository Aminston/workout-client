import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Form,
  Spinner,
  InputGroup,
  FormControl
} from 'react-bootstrap';

export default function ProfileModal({ show, onHide, token, setToken, setUserName }) {
  const [form, setForm] = useState({ name: '', email: '', birthday: '', height: '', height_unit: 'm', weight: '', weight_unit: 'kg', background: '' });
  const [originalForm, setOriginalForm] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loginTokenInput, setLoginTokenInput] = useState('');

  useEffect(() => {
    if (!show) return;
    if (token) {
      fetch(`${import.meta.env.VITE_API_URL}/api/user-profile`, { headers: { 'X-API-Token': token } })
        .then(r => r.json())
        .then(data => {
          const birthdayIso = data.birthday ? new Date(data.birthday).toISOString().slice(0, 10) : '';
          const loaded = { name: data.name || '', email: data.email || '', birthday: birthdayIso, height: data.height?.toString() || '', height_unit: data.height_unit || 'm', weight: data.weight?.toString() || '', weight_unit: data.weight_unit || 'kg', background: data.background || '' };
          setForm(loaded);
          setOriginalForm(loaded);
          setIsDirty(false);
        })
        .catch(() => { setForm(originalForm || {}); setIsDirty(false); });
    } else {
      const empty = { name: '', email: '', birthday: '', height: '', height_unit: 'm', weight: '', weight_unit: 'kg', background: '' };
      setForm(empty);
      setOriginalForm(empty);
      setIsDirty(false);
    }
  }, [show, token]);

  const handleChange = e => { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setIsDirty(true); };
  const isProfileValid = form.name && form.email && form.birthday && parseFloat(form.height) > 0 && parseFloat(form.weight) > 0;

  const handleSubmitProfile = async e => {
    e.preventDefault(); setLoadingProfile(true);
    const hasToken = Boolean(token);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user-profile`, {
        method: hasToken ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(hasToken && { 'X-API-Token': token }) },
        body: JSON.stringify({ ...form, height: parseFloat(form.height), weight: parseFloat(form.weight) })
      });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Save failed');
      if (!hasToken && data.apiToken) { localStorage.setItem('X-API-Token', data.apiToken); setToken(data.apiToken); }
      localStorage.setItem('userName', form.name); setUserName(form.name);
      setOriginalForm(form); setIsDirty(false); onHide();
    } catch (err) {
      alert('Failed to save profile: ' + err.message);
    } finally { setLoadingProfile(false); }
  };

  const handleLoginChange = e => { setLoginTokenInput(e.target.value); setIsDirty(false); };
  const handleLoginSubmit = () => { localStorage.setItem('X-API-Token', loginTokenInput); setToken(loginTokenInput); onHide(); };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton><Modal.Title>User Information</Modal.Title></Modal.Header>
      <Modal.Body>
        <h6>Create / Edit Profile</h6>
        <Form onSubmit={handleSubmitProfile}>
          <Form.Control className="mb-2" name="name" placeholder="Name" value={form.name} onChange={handleChange} />
          <Form.Control className="mb-2" type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} />
          <Form.Control className="mb-2" type="date" name="birthday" value={form.birthday} onChange={handleChange} />
          <div className="d-flex mb-2">
            <Form.Control type="number" step="0.01" name="height" placeholder="Height" value={form.height} onChange={handleChange} />
            <Form.Select name="height_unit" className="ms-2" value={form.height_unit} onChange={handleChange}> <option value="m">m</option><option value="cm">cm</option> </Form.Select>
          </div>
          <div className="d-flex mb-2">
            <Form.Control type="number" step="0.1" name="weight" placeholder="Weight" value={form.weight} onChange={handleChange} />
            <Form.Select name="weight_unit" className="ms-2" value={form.weight_unit} onChange={handleChange}> <option value="kg">kg</option><option value="lb">lb</option> </Form.Select>
          </div>
          <Form.Control as="textarea" rows={2} name="background" placeholder="Background" value={form.background} onChange={handleChange} />
          {isDirty && (
            <Modal.Footer>
              <Button variant="secondary" onClick={() => { setForm(originalForm); setIsDirty(false); }}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={!isProfileValid || loadingProfile}>{loadingProfile ? <Spinner animation="border" size="sm" /> : 'Save'}</Button>
            </Modal.Footer>
          )}
        </Form>
        <hr/>
        <h6>Or Login</h6>
        <InputGroup>
          <FormControl placeholder="Enter your token" value={loginTokenInput} onChange={handleLoginChange} />
          <Button variant="secondary" onClick={handleLoginSubmit} disabled={!loginTokenInput}>Login</Button>
        </InputGroup>
      </Modal.Body>
    </Modal>
  );
}