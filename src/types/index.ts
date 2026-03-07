export type Role = string; // 動的役職 (DBから取得)
export type ClassType = string; // クラスID (DBから取得)

export interface ShiftClass {
    id: string;
    name: string;
    display_order: number;
    auto_allocate: number; // 1: ON, 0: OFF
}

export interface AvailableDayConfig {
    day: number;    // 0:日, 1:月, ..., 6:土
    weeks?: number[]; // [1, 2, 3, 4, 5] (空または未定義なら「全週」)
}

export interface Staff {
    id: string;
    name: string;
    role: string; // 役職名 (動的)
    hoursTarget: number | null;
    isHelpStaff?: boolean;
    classIds?: string[];
    availableDays?: (number | AvailableDayConfig)[];
    defaultWorkingHoursStart?: string;
    defaultWorkingHoursEnd?: string;
    display_order?: number;
}

export interface ShiftPreference {
    id: string;
    staffId: string;
    yearMonth: string;
    unavailableDates: string[];
}

export interface Shift {
    id: string;
    date: string;
    staffId: string | 'UNASSIGNED';
    startTime: string;
    endTime: string;
    classType: ClassType;
    isEarlyShift: boolean;
    isError?: boolean;
}

// 勤務時間パターン (役職と無関係な時間定義)
export interface ShiftTimePattern {
    id: string;
    name: string;     // 例: "早番", "遅番"
    startTime: string;
    endTime: string;
}

// 役職 (DB管理・動的)
export interface DynamicRole {
    id: string;
    name: string;
    targetHours: number | null;
    patterns: ShiftTimePattern[];
}
