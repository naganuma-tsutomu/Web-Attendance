/**
 * Calculate duration in hours between two HH:MM strings.
 * Supports day-crossing (e.g., 22:00 to 02:00 = 4.0 hours).
 */
export const calculateDuration = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;

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
