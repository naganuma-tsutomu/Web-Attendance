import { format, parse, isValid } from 'date-fns';

const STORAGE_KEY = 'active_working_month';

/**
 * Save the active month to localStorage.
 */
export const saveActiveMonth = (date: Date): void => {
    localStorage.setItem(STORAGE_KEY, format(date, 'yyyy-MM'));
};

/**
 * Load the active month from localStorage.
 * Returns the current date if no saved month exists or if it's invalid.
 */
export const loadActiveMonth = (): Date => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return new Date();

    try {
        const parsed = parse(saved, 'yyyy-MM', new Date());
        if (!isValid(parsed)) return new Date();
        return parsed;
    } catch (e) {
        console.error('Failed to parse saved month', e);
        return new Date();
    }
};
