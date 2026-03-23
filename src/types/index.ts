export type Role = string; // 動的役職 (DBから取得)
export type ClassType = string; // クラスID (DBから取得)

export interface ShiftClass {
    id: string;
    name: string;
    display_order: number;
    auto_allocate: number; // 1: ON, 0: OFF
    color?: string;
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
    weeklyHoursTarget?: number | null; // 週間目標時間
    isHelpStaff?: boolean;
    classIds?: string[];
    availableDays?: (number | AvailableDayConfig)[];
    defaultWorkingHoursStart?: string;
    defaultWorkingHoursEnd?: string;
    display_order?: number;
    accessKey?: string;
}

export interface ShiftPreferenceDetail {
    date: string;
    startTime: string | null;
    endTime: string | null;
    type?: string | null;
}

export interface ShiftPreference {
    id: string;
    staffId: string;
    yearMonth: string;
    unavailableDates: string[];
    details?: ShiftPreferenceDetail[];
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
    display_order?: number;
    roleIds?: string[];
    sun: number;
    mon: number;
    tue: number;
    wed: number;
    thu: number;
    fri: number;
    sat: number;
    holiday: number;
}

// 役職 (DB管理・動的)
export interface DynamicRole {
    id: string;
    name: string;
    targetHours: number | null;
    weeklyHoursTarget?: number | null; // 週間目標時間
    display_order: number;
    patterns: ShiftTimePattern[];
}

// シフト要件
export interface ShiftRequirement {
    id: string;
    classId: string;
    dayOfWeek: number;      // 0:日, 1:月, ..., 6:土, 7:平日, 8:毎日
    startTime: string;      // HH:MM
    endTime: string;        // HH:MM
    minStaffCount: number;  // 最小スタッフ数
    maxStaffCount?: number; // 最大スタッフ数（オプション）
    priority: number;       // 優先度（高いほど優先）
}

// 祝日
export interface Holiday {
    id: string;
    date: string;           // YYYY-MM-DD
    name: string;           // 祝日名
    type: 'national' | 'observance' | 'company';
    isWorkday: boolean;     // 振替休日等の特別対応用
    created_at?: string;
    updated_at?: string;
}
