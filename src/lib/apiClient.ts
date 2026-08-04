import { ApiError } from './errorHandler';

export const API_BASE = '/api';

type ParseableSchema = {
    safeParse(data: unknown): { success: boolean; data?: unknown; error?: { format(): unknown } };
};

/** 共通のAPIリクエスト関数 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}, schema?: ParseableSchema): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string; message?: string };
        throw new ApiError(response.status, errorData.error || errorData.message || `API Error: ${response.status} ${response.statusText}`);
    }
    if (response.status === 204) return {} as T;

    const data: unknown = await response.json();
    if (!schema) return data as T;

    const result = schema.safeParse(data);
    if (!result.success) {
        console.error(`[API Validation Error] ${endpoint}:`, result.error?.format());
        throw new Error(`API レスポンスの型が不正です: ${endpoint}`);
    }
    return result.data as T;
}
