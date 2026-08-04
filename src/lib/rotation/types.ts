export interface RotationState {
    previousDayEarly: string[];
    previousDayLate: string[];
    lastEarlyShift: Record<string, string>;
    lastLateShift: Record<string, string>;
    earlyShiftCount: Record<string, number>;
    lateShiftCount: Record<string, number>;
    saturdayShiftCount: Record<string, number>;
    lastSaturdayShift: Record<string, string>;
    classAssignmentCount: Record<string, number>;
    lastClassAssignmentDate: Record<string, string>;
    staffClassAssignmentCount: Record<string, Record<string, number>>;
}
