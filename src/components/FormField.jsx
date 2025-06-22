import { Form } from 'react-bootstrap';

export default function FormField({
    name,
    type = 'text',
    value,
    onChange,
    placeholder,
    autoFocus = false,
    as,
    options = [],
}) {
    return (
        <Form.Group controlId={name} className='mb-2'>
            {as === 'select' ? (
                <Form.Select
                    name={name}
                    value={value}
                    onChange={onChange}
                    autoFocus={autoFocus}
                >
                    {options.map(({ value, label }) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </Form.Select>
            ) : (
                <Form.Control
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    autoComplete='off'
                    autoFocus={autoFocus}
                />
            )}
        </Form.Group>
    );
}
