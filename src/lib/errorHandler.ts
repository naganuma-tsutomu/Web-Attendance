import { toast } from 'sonner';

type ApiErrorKind = 'network' | 'auth' | 'validation' | 'conflict' | 'server' | 'unknown';

function classifyError(err: unknown): { kind: ApiErrorKind; message: string } {
    if (!(err instanceof Error)) {
        return { kind: 'unknown', message: String(err) };
    }

    const msg = err.message;

    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('net::')) {
        return { kind: 'network', message: 'ネットワークエラーが発生しました。接続を確認してください。' };
    }
    if (msg.includes('401') || msg.includes('認証')) {
        return { kind: 'auth', message: '認証が必要です。再ログインしてください。' };
    }
    if (msg.includes('409')) {
        return { kind: 'conflict', message: msg };
    }
    if (msg.includes('400') || msg.includes('422') || msg.includes('型が不正')) {
        return { kind: 'validation', message: msg };
    }
    if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
        return { kind: 'server', message: 'サーバーエラーが発生しました。しばらく後に再試行してください。' };
    }

    return { kind: 'unknown', message: msg };
}

export function handleApiError(err: unknown, fallbackMessage: string): void {
    console.error(err);
    const { message } = classifyError(err);
    toast.error(message || fallbackMessage);
}
