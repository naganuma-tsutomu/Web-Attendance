export type Role = '正社員' | '準社員' | 'パート' | '特殊スタッフ';
export type ClassType = '虹組' | 'スマイル組' | '特殊';

export interface Staff {
    id: string; // Firestore Doc ID
    name: string;
    role: Role;
    hoursTarget: number; // 月間目標労働時間 (例: 135)
    isHelpStaff?: boolean; // 特殊スタッフ用: シフトエラー時に穴埋め可能か
    availableDays?: number[]; // 出勤可能曜日 (0: 日, 1: 月, ... 6: 土) - 主にパート・特殊スタッフ用
    defaultWorkingHoursStart?: string; // "16:00"
    defaultWorkingHoursEnd?: string;   // "17:00"
}

export interface ShiftPreference {
    id: string; // Firestore Doc ID
    staffId: string;
    yearMonth: string; // "YYYY-MM" (例: "2024-04")
    unavailableDates: string[]; // 出勤不可日の配列 (例: ["2024-04-01", "2024-04-15"])
}

export interface Shift {
    id: string; // Firestore Doc ID
    date: string; // "YYYY-MM-DD"
    staffId: string | 'UNASSIGNED'; // エラーで未割り当ての場合は 'UNASSIGNED'
    startTime: string; // "10:15"
    endTime: string;   // "18:45"
    classType: ClassType;
    isEarlyShift: boolean; // 早番フラグ (正社員の翌日早番制約用)
    isError?: boolean; // 自動計算で割り当て失敗したフラグ
}

export interface RoleSetting {
    role: Role;
    defaultStartTime: string;
    defaultEndTime: string;
}
