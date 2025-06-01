// src/components/Auth/UserAccountModal.jsx

import { useEffect } from 'react';
import BaseModal from '@/components/BaseModal/BaseModal';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import UserProfileForm from '@/components/ProfileModal/UserProfileForm';
import useUserProfile from '@/hooks/useUserProfile';
import { toast } from '@/components/ToastManager';

export default function UserAccountModal({
  show,
  onHide,
  token,
  setToken,
  userName,
  setUserName,
  authMode,
  setAuthMode,
  onLoginSuccess,
  onSaveSuccess
}) {
  const {
    form, isDirty, loading,
    dispatch, fetchProfile, resetForm,
    clearAll, hasFetched, saveProfile
  } = useUserProfile();

  useEffect(() => {
    if (authMode === 'profile' && show && token && !hasFetched) {
      fetchProfile(token, setUserName);
    }
    if (!show) clearAll();
  }, [authMode, show, token]);

  const handleChange = e => {
    dispatch({ type: 'CHANGE_FIELD', field: e.target.name, value: e.target.value });
  };

  const handleCancel = () => {
    if (isDirty) resetForm();
    onHide();
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const result = await saveProfile(token);
    if (result.success) {
      setUserName(form.name);
      resetForm();
      onHide();
      onSaveSuccess?.();
    } else {
      toast.show('danger', '❌ Failed to save profile');
    }
  };

  const isProfileValid =
    form.name &&
    form.email &&
    form.birthday &&
    parseFloat(form.height) > 0 &&
    parseFloat(form.weight) > 0 &&
    form.training_goal &&
    form.training_experience;

  return (
    <BaseModal
      show={show}
      onHide={onHide}
      title="User Account"
      onCancel={handleCancel}
      onSubmit={handleSubmit}
      canSubmit={authMode === 'profile' ? isDirty && isProfileValid : undefined}
      isSubmitting={loading}
      confirmLabel={authMode === 'profile' ? 'Save' : undefined}
    >
      {authMode === 'profile' && token ? (
        <UserProfileForm
          form={form}
          isDirty={isDirty}
          isValid={isProfileValid}
          loading={loading}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          handleCancel={handleCancel}
        />
      ) : authMode === 'login' ? (
        <LoginForm
          show={show}
          onHide={onHide}
          setToken={setToken}
          onLoginSuccess={onLoginSuccess}
          setAuthMode={setAuthMode}
        />
      ) : (
        <RegisterForm
          show={show}
          onHide={onHide}
          setToken={setToken}
          onLoginSuccess={onLoginSuccess}
          setAuthMode={setAuthMode}
        />
      )}
    </BaseModal>
  );
}
