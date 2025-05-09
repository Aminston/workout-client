import { useReducer, useState, useRef } from 'react';

const initialForm = {
  name: '', email: '', birthday: '', height: '', height_unit: 'm',
  weight: '', weight_unit: 'kg', background: ''
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FORM':
      return { ...state, form: action.payload, originalForm: action.payload, isDirty: false };
    case 'CHANGE_FIELD':
      return {
        ...state,
        form: { ...state.form, [action.field]: action.value },
        isDirty: true
      };
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

export default function useUserProfile() {
  const [state, dispatch] = useReducer(reducer, {
    form: initialForm,
    originalForm: null,
    isDirty: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasFetchedRef = useRef(false); // 🔁 Synchronous flag

  const fetchProfile = async (token, setUserName) => {
    if (!token || hasFetchedRef.current) return;

    console.log('🔁 Fetching user profile...');
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      console.log('👤 /me response:', res.status, data);

      if (!res.ok) throw new Error(data.error || 'Failed to fetch profile');

      const birthdayIso = data.birthday ? new Date(data.birthday).toISOString().split('T')[0] : '';
      const loadedForm = {
        name: data.name || '',
        email: data.email || '',
        birthday: birthdayIso,
        height: data.height?.toString() || '',
        height_unit: data.height_unit || 'm',
        weight: data.weight?.toString() || '',
        weight_unit: data.weight_unit || 'kg',
        background: data.background || ''
      };

      dispatch({ type: 'SET_FORM', payload: loadedForm });
      setUserName(data.name || '');
      localStorage.setItem('userName', data.name || '');
      hasFetchedRef.current = true; // ✅ Prevent second call
      setError('');
    } catch (err) {
      console.error('❌ Profile fetch error:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    dispatch({ type: 'RESET' });
  };

  const clearAll = () => {
    dispatch({ type: 'CLEAR_ALL' });
    hasFetchedRef.current = false; // ✅ Reset on modal close
    setError('');
  };

  return {
    ...state,
    loading,
    error,
    dispatch,
    fetchProfile,
    resetForm,
    clearAll
  };
}
