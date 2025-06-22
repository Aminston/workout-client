import { useEffect, useCallback } from 'react';
import BaseModal from '@/components/BaseModal/BaseModal';
import UserProfileForm from './UserProfileForm';
import { toast } from '@/components/ToastManager';
import useUserProfile from '@/hooks/useUserProfile';

export default function UserProfileModal({
    show,
    onHide,
    token,
    setUserName,
    onSaveSuccess,
}) {
    const {
        form,
        isDirty,
        loading,
        dispatch,
        fetchProfile,
        resetForm,
        clearAll,
        hasFetched,
        saveProfile,
    } = useUserProfile();

    useEffect(() => {
        if (show && token && !hasFetched) {
            fetchProfile(token, setUserName);
        }
        if (!show) clearAll();
    }, [show, token, hasFetched, fetchProfile, clearAll, setUserName]);

    const handleChange = useCallback(
        e => {
            dispatch({
                type: 'CHANGE_FIELD',
                field: e.target.name,
                value: e.target.value,
            });
        },
        [dispatch]
    );

    const handleCancel = useCallback(() => {
        if (isDirty) resetForm();
        onHide();
    }, [isDirty, resetForm, onHide]);

    const handleSubmit = useCallback(async () => {
        if (!isDirty) return;

        const result = await saveProfile(token);
        if (result.success) {
            setUserName(form.name);
            resetForm();
            onHide();
            onSaveSuccess?.();
        } else {
            toast.show('danger', '❌ Failed to save profile');
        }
    }, [
        isDirty,
        form.name,
        saveProfile,
        token,
        setUserName,
        resetForm,
        onHide,
        onSaveSuccess,
    ]);

    return (
        <BaseModal show={show} onHide={onHide} title='Edit Profile'>
            {form.name || form.email ? (
                <UserProfileForm
                    form={form}
                    isDirty={isDirty}
                    loading={loading}
                    handleChange={handleChange}
                    handleSubmit={e => {
                        e.preventDefault();
                        handleSubmit();
                    }}
                    handleCancel={handleCancel}
                />
            ) : (
                <div className='p-3 text-center'>Loading profile...</div>
            )}
        </BaseModal>
    );
}
