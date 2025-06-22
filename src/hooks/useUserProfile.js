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
    injury_caution_area: 'none',
};

// 🧠 Reducer for managing form state + dirty tracking
function reducer(state, action) {
    switch (action.type) {
    case 'SET_FORM':
        return {
            ...state,
            form: action.payload,
            originalForm: action.payload,
            isDirty: false,
        };
    case 'CHANGE_FIELD': {
        const updatedForm = { ...state.form, [action.field]: action.value };
        const isDirty =
                JSON.stringify(updatedForm) !==
                JSON.stringify(state.originalForm);
        return {
            ...state,
            form: updatedForm,
            isDirty,
        };
    }
    case 'RESET':
        return { ...state, form: state.originalForm, isDirty: false };
    case 'CLEAR_ALL':
        return {
            form: initialForm,
            originalForm: null,
            isDirty: false,
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
        isDirty: false,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const hasFetchedRef = useRef(false);

    const fetchProfile = async (token, setUserName) => {
        if (!token || hasFetchedRef.current) return;

        setLoading(true);
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/user-profile`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await res.json();

            if (!res.ok)
                throw new Error(data.error || 'Failed to fetch profile');

            const birthdayIso = data.birthday
                ? new Date(data.birthday).toISOString().split('T')[0]
                : '';
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
                injury_caution_area: data.injury_caution_area || 'none',
            };

            dispatch({ type: 'SET_FORM', payload: loadedForm });
            setUserName(data.name || '');
            localStorage.setItem('userName', data.name || '');
            hasFetchedRef.current = true;
            setError('');
        } catch (err) {
            console.error('❌ Profile fetch error:', err);
            setError(err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async token => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/user-profile`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        ...state.form,
                        height: parseFloat(state.form.height),
                        weight: parseFloat(state.form.weight),
                    }),
                }
            );

            const data = await res.json();
            if (!res.ok)
                throw new Error(data.error || 'Failed to update profile');

            dispatch({ type: 'SET_FORM', payload: state.form });
            return { success: true };
        } catch (err) {
            console.error('❌ Profile save error:', err);
            setError(err.message || 'Unknown error');
            return { success: false };
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => dispatch({ type: 'RESET' });

    const clearAll = () => {
        dispatch({ type: 'CLEAR_ALL' });
        hasFetchedRef.current = false;
        setError('');
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
    };
}
