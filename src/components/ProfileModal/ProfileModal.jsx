import { useEffect } from 'react';
import BaseModal from '@/components/BaseModal/BaseModal';
import ProfileForm from './ProfileForm';
import useUserProfile from '@/hooks/useUserProfile';
import { toast } from '@/components/ToastManager';

export default function ProfileModal({ show, onHide, token, setUserName, onSaveSuccess }) {
  const {
    form, isDirty, loading,
    dispatch, fetchProfile, resetForm,
    clearAll, hasFetched, saveProfile
  } = useUserProfile();

  useEffect(() => {
    if (show && token && !hasFetched) {
      fetchProfile(token, setUserName);
    }
    if (!show) clearAll();
  }, [show, token]);

  const handleChange = e => {
    dispatch({ type: 'CHANGE_FIELD', field: e.target.name, value: e.target.value });
  };

  const handleCancel = () => {
    if (isDirty) resetForm();
    onHide();
  };

  const handleSubmit = async () => {
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
      title="Edit Profile"
      onCancel={handleCancel}
      onSubmit={handleSubmit}
      canSubmit={isDirty && isProfileValid}
      isSubmitting={loading}
    >
      <ProfileForm
        form={form}
        isDirty={isDirty}
        loading={loading}
        handleChange={handleChange}
      />
    </BaseModal>
  );
}
