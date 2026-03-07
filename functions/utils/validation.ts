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
