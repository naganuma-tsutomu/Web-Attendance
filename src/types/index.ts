/**
 * 型定義ファイル
 *
 * Zod スキーマ (schemas.ts) を Single Source of Truth とし、
 * z.infer<> で推論した型をベースに、アプリケーション固有の
 * 厳密な型制約を上書き (Override) して公開する。
 *
 * 既存インポート `from '../types'` はそのまま動作する。
 */

import { z } from 'zod';
import type {
    AvailableDayConfig as _AvailableDayConfig,
    StaffInferred,
    ShiftClassInferred,
    ShiftPreferenceDetailInferred,
    ShiftPreferenceInferred,
    ShiftInferred,
    ShiftSnapshotMetadataInferred,
    ShiftTimePatternInferred,
    DynamicRoleInferred,
    ShiftRequirementInferred,
    HolidayInferred,
    BusinessHoursInferred,
    SchedulePreferencesInferred,
    ExcelSettingsSchema,
    ExcelHighlightRuleSchema,
    AuditLogInferred,
} from './schemas';

// ==========================================
// 型エイリアス（単純なもの）
// ==========================================
export type Role = string;
export type ClassType = string;
export type AvailableDayConfig = _AvailableDayConfig;

// ==========================================
// アプリケーション向けの型 (Zod 推論ベース + Override)
// ==========================================

/** スタッフ */
export interface Staff extends Omit<StaffInferred, 'hoursTarget' | 'weeklyHoursTarget' | 'display_order'> {
    hoursTarget: number | null;
    weeklyHoursTarget: number | null;
    display_order?: number;
}

/** シフトクラス（組） */
export interface ShiftClass extends Omit<ShiftClassInferred, 'display_order' | 'auto_allocate' | 'color'> {
    display_order: number;
    auto_allocate: number;
    color?: string;
}

/** 希望休の詳細 */
export type ShiftPreferenceDetail = ShiftPreferenceDetailInferred;

/** 希望休 */
export type ShiftPreference = ShiftPreferenceInferred;

/** シフト */
export interface Shift extends Omit<ShiftInferred, 'isError' | 'isEarlyShift' | 'classType'> {
    classType: ClassType;
    isEarlyShift?: boolean;
    isError?: boolean;
}

/** 自動生成後の簡易レポート */
export interface GenerationReport {
    yearMonth: string;
    generatedAt: string;
    generatedCount: number;
    unassignedCount: number;
    fixedDateCount: number;
    unassignedRows: {
        id: string;
        date: string;
        startTime: string;
        endTime: string;
        className: string;
    }[];
    staffRows: {
        staffId: string;
        staffName: string;
        actualHours: number;
        targetHours: number | null;
        diffHours: number | null;
    }[];
    classRows: {
        classId: string;
        className: string;
        assignedCount: number;
        totalCount: number;
        fillRate: number;
    }[];
}

/** シフトバックアップ */
export type ShiftSnapshotMetadata = ShiftSnapshotMetadataInferred;

/** 勤務時間パターン */
export interface ShiftTimePattern extends Omit<ShiftTimePatternInferred, 'display_order' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'holiday'> {
    display_order?: number;
    sun: number;
    mon: number;
    tue: number;
    wed: number;
    thu: number;
    fri: number;
    sat: number;
    holiday: number;
}

/** スタッフ区分 */
export interface DynamicRole extends Omit<DynamicRoleInferred, 'display_order' | 'targetHours' | 'patterns'> {
    targetHours: number | null;
    display_order: number;
    patterns: ShiftTimePattern[];
}

/** シフト要件 */
export interface ShiftRequirement extends Omit<ShiftRequirementInferred, 'priority'> {
    priority: number;
}

/** 全クラスの必要人数設定をまとめた名前付きテンプレート */
export interface ShiftRequirementTemplate {
    id: string;
    name: string;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
}

/** 祝日 */
export interface Holiday extends Omit<HolidayInferred, 'type' | 'isWorkday' | 'is_workday'> {
    type: 'national' | 'observance' | 'company';
    isWorkday: boolean;
    created_at?: string;
    updated_at?: string;
}

/** 日付単位の施設営業・休業上書き */
export interface BusinessDayOverride {
    id: string;
    date: string;
    status: 'open' | 'closed';
    name: string;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface BusinessHours extends Omit<BusinessHoursInferred, 'closedDays'> {
    closedDays: number[];
}

/** Excel出力設定 */
export type ExcelHighlightRule = z.infer<typeof ExcelHighlightRuleSchema>;
export type ExcelSettings = z.infer<typeof ExcelSettingsSchema>;

/** 休憩設定 */
export interface BreakSettings {
    exceptionEnabled: boolean;
    exceptionThresholdTime: string;  // "HH:MM" (デフォルト: "12:00")
    exceptionBreakMinutes: number;   // デフォルト: 30
    displayActualHoursInModal: boolean;  // シフトモーダルで実労働時間表示
    displayActualHoursInExcel: boolean;  // Excelで実労働時間表示
}

/** シフト画面設定 */
export type SchedulePreferences = SchedulePreferencesInferred;

/** ローテーション設定 */
export interface RotationSettings {
    enabled: boolean;
    roleId: string;
    earlyPatternId: string;
    latePatternId: string;
    weekdayEarlyCount: number;
    weekdayLateCount: number;
    saturdayEnabled: boolean;
    saturdayCount: number;
    saturdayPreferFridayLate: boolean;
    saturdayPatternId?: string;
}

export type AuditLog = AuditLogInferred;
