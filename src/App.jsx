import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import WeeklyWorkout from './components/WorkoutSchedule/WeeklyWorkout';
import LandingPage from './pages/Landing/LandingPage';
import ToastManager, { toast } from './components/ToastManager';
import './App.css';

function ProtectedRoute({ token, children }) {
    return token ? children : <Navigate to='/' replace />;
}

export default function App() {
    const [token, setToken] = useState(localStorage.getItem('jwt_token'));
    const [userName, setUserName] = useState(
        localStorage.getItem('userName') || ''
    );
    const [personalized, setPersonalized] = useState([]);
    const [meta, setMeta] = useState({
        program_start: '',
        expires_on: '',
        user_name: '',
    });
    const [loadingWorkout, setLoadingWorkout] = useState(false); // 🔥 added shared loading state

    const fetchSchedule = async customToken => {
        const usedToken = customToken || token;
        if (!usedToken) return;

        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/schedule`,
                {
                    headers: { Authorization: `Bearer ${usedToken}` },
                }
            );

            if (!res.ok) throw new Error('Failed to fetch schedule');
            const data = await res.json();

            setPersonalized(data.schedule || []);
            setMeta({
                program_id: data.program_id,
                program_start: data.program_start,
                expires_on: data.expires_on,
                user_name: data.user_name || '',
            });

            if (data.from_ai) {
                toast.show(
                    'success',
                    '✅ Your personalized workout plan is ready!'
                );
            }
        } catch (err) {
            console.error('❌ Failed to fetch schedule:', err);
            toast.show('danger', '❌ Failed to load schedule');
        }
    };

    useEffect(() => {
        console.log('🔄 App.jsx token updated:', token);
        if (token) {
            fetchSchedule();
            setUserName(localStorage.getItem('userName') || '');
        }
    }, [token]);

    const handleLoginSuccess = () => {
        setUserName(localStorage.getItem('userName') || '');
    };

    const handleSaveSuccess = () => {
        toast.show('success', '✅ Profile updated successfully');
    };

    const isLoggedIn = !!token;

    return (
        <div className='app-root'>
            <Routes>
                <Route
                    path='/'
                    element={
                        isLoggedIn ? (
                            <Navigate to='/schedule' replace />
                        ) : (
                            <LandingPage
                                token={token}
                                setToken={setToken}
                                userName={userName}
                                setUserName={setUserName}
                                onLoginSuccess={handleLoginSuccess}
                                onSaveSuccess={handleSaveSuccess}
                            />
                        )
                    }
                />
                <Route
                    path='/schedule'
                    element={
                        <ProtectedRoute token={token}>
                            <>
                                <Navbar
                                    token={token}
                                    setToken={setToken}
                                    onPersonalized={fetchSchedule}
                                    fetchSchedule={fetchSchedule}
                                    meta={meta}
                                    loadingWorkout={loadingWorkout}
                                    setLoadingWorkout={setLoadingWorkout}
                                />
                                <main className='app-main'>
                                    <div className='content-scrollable'>
                                        <WeeklyWorkout
                                            personalized={personalized}
                                            meta={meta}
                                            setPersonalized={setPersonalized}
                                            loadingWorkout={loadingWorkout}
                                        />
                                    </div>
                                </main>
                            </>
                        </ProtectedRoute>
                    }
                />
            </Routes>
            <ToastManager />
        </div>
    );
}
