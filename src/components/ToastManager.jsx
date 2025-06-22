// components/ToastManager.jsx
import React, { useState, useCallback } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';

// This will be updated once the component mounts
export const toast = {
    show: () => {}, // placeholder
};

export default function ToastManager() {
    const [toastData, setToastData] = useState({
        show: false,
        message: '',
        type: 'success',
    });

    const show = useCallback((type, message) => {
        setToastData({ show: true, message, type });
        setTimeout(() => setToastData(t => ({ ...t, show: false })), 3000);
    }, []);

    // 🔥 CRITICAL: link global function to the local one
    toast.show = show;

    return (
        <ToastContainer position='bottom-end' className='p-3'>
            <Toast
                show={toastData.show}
                bg={toastData.type}
                onClose={() => setToastData(t => ({ ...t, show: false }))}
            >
                <Toast.Header closeButton>
                    <strong className='me-auto'>App</strong>
                </Toast.Header>
                <Toast.Body className='text-white'>
                    {toastData.message}
                </Toast.Body>
            </Toast>
        </ToastContainer>
    );
}
