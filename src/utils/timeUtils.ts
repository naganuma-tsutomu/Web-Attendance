/**
 * Convert a HH:MM string to total minutes.
 */
export const timeToMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

/**
 * Calculate duration in hours between two HH:MM strings.
 * Supports day-crossing (e.g., 22:00 to 02:00 = 4.0 hours).
 */
export const calculateDuration = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;

    const startMinutes = timeToMinutes(startTime);
    let endMinutes = timeToMinutes(endTime);

    // Handle overnight shifts
    if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
    }

    return (endMinutes - startMinutes) / 60;
};

/**
 * Calculate total hours for each staff member from a list of shifts.
 */
export const calculateTotalHours = (shifts: { staffId: string, startTime: string, endTime: string, isError?: boolean }[]): Record<string, number> => {
    const totals: Record<string, number> = {};

    shifts.forEach(shift => {
        if (!shift.staffId || shift.staffId === 'UNASSIGNED' || shift.isError) return;

        const duration = calculateDuration(shift.startTime, shift.endTime);
        totals[shift.staffId] = (totals[shift.staffId] || 0) + duration;
    });

    return totals;
};
/**
 * Formats hours to 0.25 increments (e.g., 20.25, 20.5, 20.75, 21.0).
 * Rounds to the nearest 0.25.
 */
export const formatHours = (hours: number): string => {
    const rounded = Math.round(hours * 4) / 4;
    if (rounded % 1 === 0) return rounded.toFixed(1); // "20.0"
    if (rounded % 0.5 === 0) return rounded.toFixed(1); // "20.5"
    return rounded.toFixed(2); // "20.25", "20.75"
};
