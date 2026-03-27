/**
 * アプリケーション共通定数
 */

// ── スタッフ関連 ──

/** 未割り当てシフトのスタッフID */
export const UNASSIGNED_STAFF_ID = 'UNASSIGNED';

// ── 曜日パターン（ShiftRequirement.dayOfWeek 用） ──

/** 平日（月〜金） */
export const DAY_WEEKDAYS = 7;

/** 毎日 */
export const DAY_EVERYDAY = 8;

// ── デフォルト休館日 ──

/** デフォルト休館曜日リスト (0=日曜) */
export const DEFAULT_CLOSED_DAYS: number[] = [0];

/** 休館日設定において祝日を意味する特別定数 */
export const CLOSED_DAY_HOLIDAY = 7;

// ── シフト時間グリッド ──

/** シフトのスナップ単位・最小時間・タイムライン表示パディング（分） */
export const SHIFT_STEP_MINS = 15;

// ── カレンダーイベント色 ──

export const CALENDAR_COLORS = {
    /** エラー / 不足 */
    error: '#94a3b8',
    /** 希望休 */
    requestedOff: '#ef4444',
    /** 研修 */
    training: '#f59e0b',
    /** 固定休（背景） */
    fixedOffBg: '#cbd5e1',
    /** 固定休（テキスト） */
    fixedOffText: '#475569',
    /** クラス（フォールバック） */
    classFallback: '#6366f1',
    /** 早番 */
    early: '#3b82f6',
    /** 遅番 */
    late: '#f59e0b',
} as const;
