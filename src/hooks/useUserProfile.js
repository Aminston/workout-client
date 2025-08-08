import { useReducer, useState, useRef } from 'react';

// 🟦 Initial form state
const initialForm = {
  name: '',
  email: '',
  birthday: '',
  height: '',
  height_unit: 'cm',
  weight: '',
  weight_unit: 'kg',
  background: '',
  training_goal: 'general_fitness',
  training_experience: 'beginner',
  injury_caution_area: 'none'
};

// 🧠 Reducer for managing form state + dirty tracking
function reducer(state, action) {
  switch (action.type) {
    case 'SET_FORM':
      return {
        ...state,
        form: action.payload,
        originalForm: action.payload,
        isDirty: false
      };
    case 'CHANGE_FIELD': {
      const updatedForm = { ...state.form, [action.field]: action.value };
      const isDirty = JSON.stringify(updatedForm) !== JSON.stringify(state.originalForm);
      return {
        ...state,
        form: updatedForm,
        isDirty
      };
    }
    case 'RESET':
      return { ...state, form: state.originalForm, isDirty: false };
    case 'CLEAR_ALL':
      return {
        form: initialForm,
        originalForm: null,
        isDirty: false
      };
    default:
      return state;
  }
}

// 🧩 Custom React hook for managing user profile form
export default function useUserProfile() {
  const [state, dispatch] = useReducer(reducer, {
    form: initialForm,
    originalForm: null,
    isDirty: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // ✅ FIXED: Use more robust tracking for fetch status
  const hasFetchedRef = useRef(false);
  const isCurrentlyFetchingRef = useRef(false);
  const lastTokenRef = useRef(null);

  const fetchProfile = async (token, setUserName) => {
    // ✅ ENHANCED: Multiple protection layers against duplicate calls
    if (!token) {
      console.log('🚫 No token provided, skipping fetch');
      return;
    }
    
    if (isCurrentlyFetchingRef.current) {
      console.log('🚫 Already fetching profile, ignoring duplicate call');
      return;
    }
    
    if (hasFetchedRef.current && lastTokenRef.current === token) {
      console.log('🚫 Profile already fetched for this token, skipping');
      return;
    }

    console.log('🔄 Fetching user profile...');
    isCurrentlyFetchingRef.current = true;
    setLoading(true);
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/user-profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to fetch profile');

      const birthdayIso = data.birthday ? new Date(data.birthday).toISOString().split('T')[0] : '';
      const loadedForm = {
        name: data.name || '',
        email: data.email || '',
        birthday: birthdayIso,
        height: data.height?.toString() || '',
        height_unit: data.height_unit || 'cm',
        weight: data.weight?.toString() || '',
        weight_unit: data.weight_unit || 'kg',
        background: data.background || '',
        training_goal: data.training_goal || 'general_fitness',
        training_experience: data.training_experience || 'beginner',
        injury_caution_area: data.injury_caution_area || 'none'
      };

      dispatch({ type: 'SET_FORM', payload: loadedForm });
      setUserName(data.name || '');
      localStorage.setItem('userName', data.name || '');
      
      // ✅ FIXED: Mark as fetched and remember the token
      hasFetchedRef.current = true;
      lastTokenRef.current = token;
      setError('');
      
      console.log('✅ Profile fetched successfully');
    } catch (err) {
      console.error('❌ Profile fetch error:', err);
      setError(err.message || 'Unknown error');
      // ✅ Don't mark as fetched if there was an error
      hasFetchedRef.current = false;
      lastTokenRef.current = null;
    } finally {
      setLoading(false);
      isCurrentlyFetchingRef.current = false;
    }
  };

  const saveProfile = async (token) => {
    if (isCurrentlyFetchingRef.current) {
      console.log('🚫 Currently fetching, cannot save');
      return { success: false };
    }
    
    setLoading(true);
    setError('');
    
    try {
      console.log('💾 Saving user profile...');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/user-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...state.form,
          height: parseFloat(state.form.height),
          weight: parseFloat(state.form.weight)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      dispatch({ type: 'SET_FORM', payload: state.form });
      console.log('✅ Profile saved successfully');
      return { success: true };
    } catch (err) {
      console.error('❌ Profile save error:', err);
      setError(err.message || 'Unknown error');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    console.log('🔄 Resetting form to original');
    dispatch({ type: 'RESET' });
  };

  const clearAll = () => {
    console.log('🧹 Clearing all profile data');
    dispatch({ type: 'CLEAR_ALL' });
    
    // ✅ FIXED: Reset all tracking refs when clearing
    hasFetchedRef.current = false;
    isCurrentlyFetchingRef.current = false;
    lastTokenRef.current = null;
    setError('');
  };

  // ✅ NEW: Helper function to check if profile needs to be fetched
  const needsFetch = (token) => {
    return token && 
           !isCurrentlyFetchingRef.current && 
           (!hasFetchedRef.current || lastTokenRef.current !== token);
  };

  return {
    ...state,
    loading,
    error,
    dispatch,
    fetchProfile,
    saveProfile,
    resetForm,
    clearAll,
    hasFetched: hasFetchedRef.current,
    isCurrentlyFetching: isCurrentlyFetchingRef.current, // ✅ NEW: Expose current fetch state
    needsFetch // ✅ NEW: Helper to check if fetch is needed
  };
}