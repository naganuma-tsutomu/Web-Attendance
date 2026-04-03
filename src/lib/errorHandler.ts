import { toast } from 'sonner';

/**
 * APIエラーを統一的に処理する
 * - console.error でログ出力
 * - toast.error でユーザーに通知
 * - Error.message があればそれを表示、なければ fallbackMessage を表示
 */
export function handleApiError(err: unknown, fallbackMessage: string): void {
    console.error(err);
    const message = err instanceof Error && err.message ? err.message : fallbackMessage;
    toast.error(message);
}
