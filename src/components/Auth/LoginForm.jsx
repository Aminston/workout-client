import BaseModal from '@/components/BaseModal/BaseModal';
import { useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

import services from '@/services';

export default function LoginForm({
    show,
    onHide,
    setToken,
    onLoginSuccess,
    setAuthMode,
}) {
    const [authForm, setAuthForm] = useState({ email: '', password: '' });
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const navigate = useNavigate();

    const handleChange = e => {
        setAuthForm({ ...authForm, [e.target.name]: e.target.value });
    };

    const handleLogin = async e => {
        e.preventDefault();
        setIsLoggingIn(true);
        services.auth
            .login(authForm)
            .then(res => {
                localStorage.setItem('jwt_token', res.token);
                setToken(res.token);
                onHide();
            })
            .catch(err => {
                console.error('❌ Login error:', err.message);
            })
            .finally(() => {
                setIsLoggingIn(false);
            });
    };

    return (
        <BaseModal show={show} onHide={onHide} title='Login'>
            <Form onSubmit={handleLogin}>
                <Form.Control
                    type='email'
                    name='email'
                    placeholder='Email'
                    className='mb-2'
                    value={authForm.email}
                    onChange={handleChange}
                    autoComplete='off'
                    required
                />
                <Form.Control
                    type='password'
                    name='password'
                    placeholder='Password'
                    className='mb-2'
                    value={authForm.password}
                    onChange={handleChange}
                    autoComplete='off'
                    required
                />
                <p className='text-sm mt-2'>
                    No account?{' '}
                    <button
                        className='btn btn-link p-0'
                        type='button'
                        onClick={() => setAuthMode('register')}
                    >
                        Register here
                    </button>
                </p>
                <div className='modal-footer modal-footer-actions mt-3'>
                    <Button
                        type='button'
                        onClick={onHide}
                        className='btn-outline-secondary btn-modal-cancel'
                    >
                        Cancel
                    </Button>
                    <Button
                        type='submit'
                        disabled={isLoggingIn}
                        className='btn-modal-confirm btn-accent'
                    >
                        {isLoggingIn ? (
                            <Spinner size='sm' animation='border' />
                        ) : (
                            'Login'
                        )}
                    </Button>
                </div>
            </Form>
        </BaseModal>
    );
}
