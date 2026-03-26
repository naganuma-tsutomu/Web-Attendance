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
    ShiftTimePatternInferred,
    DynamicRoleInferred,
    ShiftRequirementInferred,
    HolidayInferred,
    BusinessHoursInferred,
    ExcelSettingsSchema,
    ExcelHighlightRuleSchema
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
export interface Staff extends Omit<StaffInferred, 'isHelpStaff' | 'hoursTarget' | 'display_order'> {
    hoursTarget: number | null;
    isHelpStaff?: boolean;
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
export interface Shift extends Omit<ShiftInferred, 'isEarlyShift' | 'isError' | 'classType'> {
    classType: ClassType;
    isEarlyShift: boolean;
    isError?: boolean;
}

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

/** 祝日 */
export interface Holiday extends Omit<HolidayInferred, 'type' | 'isWorkday' | 'is_workday'> {
    type: 'national' | 'observance' | 'company';
    isWorkday: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface BusinessHours extends Omit<BusinessHoursInferred, 'closedDays'> {
    closedDays: number[];
}

/** Excel出力設定 */
export type ExcelHighlightRule = z.infer<typeof ExcelHighlightRuleSchema>;
export type ExcelSettings = z.infer<typeof ExcelSettingsSchema>;
