import { toast } from 'sonner';

export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}

type ApiErrorKind = 'network' | 'auth' | 'validation' | 'conflict' | 'server' | 'unknown';

function classifyError(err: unknown): { kind: ApiErrorKind; message: string } {
    // ネットワーク到達前エラー（fetch 自体が TypeError を投げる）
    if (err instanceof TypeError) {
        return { kind: 'network', message: 'ネットワークエラーが発生しました。接続を確認してください。' };
    }

    if (err instanceof ApiError) {
        if (err.status === 401) return { kind: 'auth', message: '認証が必要です。再ログインしてください。' };
        if (err.status === 409) return { kind: 'conflict', message: err.message };
        if (err.status === 400 || err.status === 422) return { kind: 'validation', message: err.message };
        if (err.status >= 500) return { kind: 'server', message: 'サーバーエラーが発生しました。しばらく後に再試行してください。' };
        return { kind: 'unknown', message: err.message };
    }

    if (!(err instanceof Error)) {
        return { kind: 'unknown', message: String(err) };
    }

    // ApiError に移行できていない呼び出し箇所向けのフォールバック
    const msg = err.message;
    if (msg.includes('型が不正')) return { kind: 'validation', message: msg };
    if (msg.includes('認証')) return { kind: 'auth', message: '認証が必要です。再ログインしてください。' };

    return { kind: 'unknown', message: msg };
}

export function handleApiError(err: unknown, fallbackMessage: string): void {
    console.error(err);
    const { message } = classifyError(err);
    toast.error(message || fallbackMessage);
}
