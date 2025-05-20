import BaseModal from '@/components/BaseModal/BaseModal';
import ProfileForm from './ProfileForm';
import LoginForm from '@/components/Auth/LoginForm';
import RegisterForm from '@/components/Auth/RegisterForm';
import useUserProfile from '@/hooks/useUserProfile';

export default function ProfileModal({
  show, onHide, token, setToken,
  userName, setUserName,
  authMode, setAuthMode,
  onLoginSuccess,
  onSaveSuccess
}) {
  const {
    form, isDirty, loading, error,
    dispatch, fetchProfile, resetForm,
    clearAll, hasFetched, saveProfile
  } = useUserProfile();

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
    <BaseModal show={show} onHide={onHide} title="User Account">
      {token && authMode === 'profile' ? (
        <ProfileForm
          form={form}
          isDirty={isDirty}
          loading={loading}
          handleChange={handleChange}
          handleCancel={handleCancel}
          handleSubmit={handleSubmit}
          isValid={isProfileValid}
        />
      ) : authMode === 'login' ? (
        <LoginForm
          setToken={setToken}
          onHide={onHide}
          onLoginSuccess={onLoginSuccess}
          setAuthMode={setAuthMode}
        />
      ) : (
        <RegisterForm
          setToken={setToken}
          onHide={onHide}
          onLoginSuccess={onLoginSuccess}
          setAuthMode={setAuthMode}
        />
      )}
    </BaseModal>
  );
}
