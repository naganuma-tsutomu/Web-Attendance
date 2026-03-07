/**
 * Validation utility functions for Web-Attendance API
 */

// Helper to create consistent error responses
export function createValidationError(message: string): Response {
    return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
    });
}

// Helper to create consistent server error responses
export function createServerError(): Response {
    return new Response(JSON.stringify({ error: '保存に失敗しました。時間をおいて再度お試しください' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
}

// Log error for debugging but return user-friendly message
export function handleServerError(e: unknown, context: string): Response {
    console.error(`${context}:`, e);
    return createServerError();
}

// Validate name field (min 1, max 50 chars for most entities)
export function validateName(name: string, fieldName: string = '名前', maxLength: number = 50): string | null {
    if (!name || name.trim().length === 0) {
        return `${fieldName}を入力してください`;
    }
    if (name.trim().length > maxLength) {
        return `${fieldName}は${maxLength}文字以内で入力してください`;
    }
    return null;
}

// Validate time format (HH:MM)
export function validateTimeFormat(time: string, fieldName: string): string | null {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!time || !timeRegex.test(time)) {
        return `${fieldName}の形式が正しくありません（HH:MM形式で入力してください）`;
    }
    return null;
}

// Validate that startTime is before endTime
export function validateTimeRange(startTime: string, endTime: string): string | null {
    // First validate both times have correct format
    const startError = validateTimeFormat(startTime, '開始時間');
    if (startError) return startError;
    
    const endError = validateTimeFormat(endTime, '終了時間');
    if (endError) return endError;

    // Compare times
    if (startTime >= endTime) {
        return '開始時間は終了時間より前に設定してください';
    }
    return null;
}

// Validate targetHours (optional field, must be >= 0 and <= 999)
export function validateTargetHours(hours: number | null | undefined): string | null {
    if (hours === null || hours === undefined) {
        return null; // Optional field
    }
    if (typeof hours !== 'number' || isNaN(hours)) {
        return '目標時間は数値で入力してください';
    }
    if (hours < 0) {
        return '目標時間は0以上の値を入力してください';
    }
    if (hours > 999) {
        return '目標時間は999以下の値を入力してください';
    }
    return null;
}

// Validate role field (must not be empty)
export function validateRole(role: string): string | null {
    if (!role || role.trim().length === 0) {
        return '役職を入力してください';
    }
    return null;
}

// Validate dayOfWeek (0-6: 日-土, 7: 平日, 8: 毎日)
export function validateDayOfWeek(day: number): string | null {
    if (typeof day !== 'number' || !Number.isInteger(day)) {
        return '曜日は整数値で指定してください';
    }
    if (day < 0 || day > 8) {
        return '曜日は0〜8の範囲で指定してください（0:日, 1:月, ..., 6:土, 7:平日, 8:毎日）';
    }
    return null;
}

// Validate minStaffCount (must be > 0)
export function validateMinStaffCount(count: number): string | null {
    if (typeof count !== 'number' || !Number.isInteger(count)) {
        return '最小スタッフ数は整数値で指定してください';
    }
    if (count < 1) {
        return '最小スタッフ数は1以上を指定してください';
    }
    if (count > 999) {
        return '最小スタッフ数は999以下で指定してください';
    }
    return null;
}

// Validate maxStaffCount (must be >= minStaffCount if provided)
export function validateMaxStaffCount(count: number | null | undefined, minCount: number): string | null {
    if (count === null || count === undefined) {
        return null; // Optional field
    }
    if (typeof count !== 'number' || !Number.isInteger(count)) {
        return '最大スタッフ数は整数値で指定してください';
    }
    if (count < 1) {
        return '最大スタッフ数は1以上を指定してください';
    }
    if (count > 999) {
        return '最大スタッフ数は999以下で指定してください';
    }
    if (count < minCount) {
        return '最大スタッフ数は最小スタッフ数以上に設定してください';
    }
    return null;
}
