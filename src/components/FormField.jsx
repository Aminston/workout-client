// src/components/FormField.jsx
import { Form } from 'react-bootstrap';

export default function FormField({ name, type = 'text', value, onChange, placeholder, autoFocus = false }) {
  return (
    <Form.Group controlId={name} className="mb-2">
      <Form.Control
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
      />
    </Form.Group>
  );
}
