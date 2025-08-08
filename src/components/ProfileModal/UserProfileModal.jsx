import { useEffect, useCallback } from 'react';
import BaseModal from '@/components/BaseModal/BaseModal';
import UserProfileForm from './UserProfileForm';
import { toast } from '@/components/ToastManager';
import useUserProfile from '@/hooks/useUserProfile';

export default function UserProfileModal({ show, onHide, token, setUserName, onSaveSuccess }) {
  const {
    form, 
    isDirty, 
    loading,
    dispatch, 
    fetchProfile, 
    resetForm,
    clearAll, 
    hasFetched, 
    isCurrentlyFetching,
    needsFetch,
    saveProfile
  } = useUserProfile();

  // ✅ FIXED: More controlled useEffect to prevent duplicate API calls
  useEffect(() => {
    if (show && token) {
      // Only fetch if we actually need to
      if (needsFetch(token)) {
        console.log('📋 Modal opened - fetching profile');
        fetchProfile(token, setUserName);
      } else if (hasFetched) {
        console.log('📋 Modal opened - using cached profile');
      }
    }
    
    // ✅ CHANGED: Only clear when modal is hidden AND we're not currently fetching
    if (!show && !isCurrentlyFetching) {
      console.log('🧹 Modal closed - clearing profile data');
      clearAll();
    }
  }, [show, token, needsFetch, hasFetched, isCurrentlyFetching, fetchProfile, clearAll, setUserName]);

  const handleChange = useCallback(e => {
    dispatch({ type: 'CHANGE_FIELD', field: e.target.name, value: e.target.value });
  }, [dispatch]);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      console.log('📝 User cancelled with unsaved changes - resetting form');
      resetForm();
    }
    onHide();
  }, [isDirty, resetForm, onHide]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!isDirty) {
      console.log('📝 No changes to save');
      return;
    }
  
    console.log('💾 Saving profile changes...');
    const result = await saveProfile(token);
    
    if (result.success) {
      setUserName(form.name);
      resetForm();
      onHide();
      onSaveSuccess?.();
      console.log('✅ Profile saved and modal closed');
    } else {
      toast.show('danger', '❌ Failed to save profile');
      console.log('❌ Profile save failed');
    }
  }, [isDirty, form.name, saveProfile, token, setUserName, resetForm, onHide, onSaveSuccess]);

  // ✅ IMPROVED: Show loading state while fetching
  const showLoadingState = loading && !hasFetched;
  const showFormState = (form.name || form.email) && !showLoadingState;

  return (
    <BaseModal show={show} onHide={onHide} title="Edit Profile">
      {showLoadingState ? (
        <div className="p-3 text-center">
          <div className="spinner-border text-primary mb-2" role="status" />
          <div>Loading profile...</div>
        </div>
      ) : showFormState ? (
        <UserProfileForm
          form={form}
          isDirty={isDirty}
          loading={loading}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          handleCancel={handleCancel}
        />
      ) : (
        <div className="p-3 text-center text-muted">
          No profile data available
        </div>
      )}
    </BaseModal>
  );
}