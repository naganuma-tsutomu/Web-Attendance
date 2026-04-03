export interface DayStatus {
    dateStr: string;
    dayOfWeek: string;
    isHoliday: boolean;
    status: 'available' | 'unavailable' | 'fixed';
    startTime?: string | null;
    endTime?: string | null;
    type?: string | null;
    isNationalHoliday?: boolean;
    holidayName?: string;
}

export type AllPrefsForMonth = Record<string, {
    details: { date: string; startTime?: string | null; endTime?: string | null; type?: string | null }[];
    submitted: boolean;
}>;
