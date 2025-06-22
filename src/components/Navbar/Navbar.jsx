import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar, Container, Dropdown, Button, Spinner } from 'react-bootstrap';
import { toast } from '../ToastManager';
import UserProfileModal from '../ProfileModal/UserProfileModal';

import './Navbar.css';

function formatDate(dateStr) {
    return dateStr
        ? new Date(dateStr).toLocaleDateString('es-MX', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : '';
}

export default function AppNavbar({
    token,
    setToken,
    meta,
    fetchSchedule,
    loadingWorkout,
    setLoadingWorkout,
}) {
    const navigate = useNavigate();
    const [userName, setUserName] = useState(
        localStorage.getItem('userName') || ''
    );
    const [showUserModal, setShowUserModal] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('userName');
        setToken('');
        setUserName('');
        navigate('/');
    };

    const handleGetWorkout = async () => {
        setLoadingWorkout(true);
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/personalize/plan`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!res.ok) {
                const err = await res.json();
                throw new Error(
                    err.message || 'Failed to generate workout plan'
                );
            }

            toast.show('success', '✅ Personalized workout plan generated!');
            fetchSchedule?.();
        } catch (error) {
            toast.show('danger', `❌ ${error.message}`);
        } finally {
            setLoadingWorkout(false);
        }
    };

    const displayName = userName || meta?.user_name || '';
    const programDates = `${formatDate(meta?.program_start)} — ${formatDate(meta?.expires_on)}`;

    return (
        <>
            <Navbar bg='dark' variant='dark' className='custom-navbar'>
                <Container fluid className='custom-container'>
                    <div className='navbar-flex w-100'>
                        <div className='nav-workout'>
                            <Dropdown align='start'>
                                <Dropdown.Toggle
                                    variant='dark'
                                    className='nav-title text-white p-0'
                                >
                                    <span className='nav-header-title'>
                                        {token
                                            ? `${displayName}'s Workout`
                                            : 'Your Workout'}
                                    </span>
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    {token && (
                                        <>
                                            <Dropdown.Item
                                                onClick={() =>
                                                    setShowUserModal(true)
                                                }
                                            >
                                                Edit Profile
                                            </Dropdown.Item>
                                            <Dropdown.Item
                                                onClick={handleGetWorkout}
                                                disabled={loadingWorkout}
                                            >
                                                {loadingWorkout ? (
                                                    <>
                                                        <span className='me-2'>
                                                            Loading
                                                        </span>
                                                        <Spinner
                                                            animation='border'
                                                            size='sm'
                                                        />
                                                    </>
                                                ) : (
                                                    'Get Workout'
                                                )}
                                            </Dropdown.Item>
                                            <Dropdown.Divider />
                                            <Dropdown.Item
                                                onClick={handleLogout}
                                            >
                                                Logout
                                            </Dropdown.Item>
                                        </>
                                    )}
                                </Dropdown.Menu>
                            </Dropdown>

                            {token && (
                                <div className='nav-header-dates-mobile'>
                                    {programDates}
                                </div>
                            )}
                        </div>

                        {token ? (
                            <div className='nav-dates-desktop'>
                                {programDates}
                            </div>
                        ) : (
                            <div className='nav-user-button d-flex gap-2 ms-auto'>
                                <Button
                                    variant='outline-light'
                                    onClick={() => navigate('/login')}
                                >
                                    Login
                                </Button>
                                <Button
                                    variant='light'
                                    onClick={() => navigate('/register')}
                                >
                                    Register
                                </Button>
                            </div>
                        )}
                    </div>
                </Container>
            </Navbar>

            {token && showUserModal && (
                <UserProfileModal
                    show={showUserModal}
                    onHide={() => setShowUserModal(false)}
                    token={token}
                    setUserName={setUserName}
                    onSaveSuccess={() =>
                        toast.show(
                            'success',
                            '✅ Profile updated successfully!'
                        )
                    }
                />
            )}
        </>
    );
}
