// src/components/Auth/UserAccountModal.jsx - Complete Final Version
import { useEffect } from 'react';
import BaseModal from '@/components/BaseModal/BaseModal';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import UserProfileForm from '@/components/ProfileModal/UserProfileForm';
import useUserProfile from '@/hooks/useUserProfile';
import { toast } from '@/components/ToastManager';
import './AuthModal.css'; // Import auth styles

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
  }, [authMode, show, token, hasFetched, fetchProfile, setUserName, clearAll]);

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

  // Enhanced login success handler
  const handleAuthSuccess = () => {
    console.log('✅ Auth success - closing modal');
    onHide();
    onLoginSuccess?.();
  };

  // Get modal title based on auth mode
  const getModalTitle = () => {
    switch (authMode) {
      case 'login':
        return 'Welcome Back';
      case 'register':
        return 'Create Account';
      case 'profile':
        return 'Edit Profile';
      default:
        return 'User Account';
    }
  };

  // Determine if we should show footer buttons (only for profile mode)
  const showFooterButtons = authMode === 'profile';

  return (
    <BaseModal
      show={show}
      onHide={onHide}
      title={getModalTitle()}
      onCancel={showFooterButtons ? handleCancel : undefined}
      onSubmit={showFooterButtons ? handleSubmit : undefined}
      canSubmit={showFooterButtons ? isDirty && isProfileValid : undefined}
      isSubmitting={loading}
      confirmLabel={showFooterButtons ? 'Save' : undefined}
      className="user-account-modal" // Add class for CSS targeting
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
          setToken={setToken}
          onLoginSuccess={handleAuthSuccess}
          setAuthMode={setAuthMode}
        />
      ) : (
        <RegisterForm
          setToken={setToken}
          onLoginSuccess={handleAuthSuccess}
          setAuthMode={setAuthMode}
        />
      )}
    </BaseModal>
  );
}