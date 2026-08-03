import { ADMIN_COOKIE_NAME, STAFF_COOKIE_NAME, verifyCookie, verifyStaffCookie } from '../utils';
import type { Env } from '../types';

export type AuditAction = 'create' | 'update' | 'delete' | 'replace' | 'import' | 'restore' | 'lock' | 'unlock';

export interface AuditLogInput {
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    yearMonth?: string | null;
    targetDate?: string | null;
    summary: string;
    before?: unknown;
    after?: unknown;
    metadata?: unknown;
    requestId?: string | null;
}

const cookieValue = (request: Request, name: string): string | null => {
    const cookie = request.headers.get('Cookie') ?? '';
    const match = cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
    return match ? match.slice(name.length + 1) : null;
};

const sanitize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sanitize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !['accessKey', 'access_key', 'password', 'token', 'cookie'].includes(key))
        .map(([key, item]) => [key, sanitize(item)]));
};

const json = (value: unknown): string | null => value === undefined ? null : JSON.stringify(sanitize(value));

const resolveActor = async (request: Request, secret?: string): Promise<{ type: 'admin' | 'staff' | 'system'; id: string | null }> => {
    if (!secret) return { type: 'system', id: null };
    const adminToken = cookieValue(request, ADMIN_COOKIE_NAME);
    if (adminToken && await verifyCookie(adminToken, secret)) return { type: 'admin', id: null };
    const staffToken = cookieValue(request, STAFF_COOKIE_NAME);
    const staffId = staffToken ? await verifyStaffCookie(staffToken, secret) : null;
    return staffId ? { type: 'staff', id: staffId } : { type: 'system', id: null };
};

/**
 * 監査ログは運用追跡用であり、本体操作を妨げない。
 * マイグレーション未適用や一時的なログ障害は記録して呼び出し側へは送出しない。
 */
export const writeAuditLog = async (env: Env, request: Request, input: AuditLogInput): Promise<void> => {
    // 認証設定がないテスト環境・未初期化環境ではactorを確定できないため記録しない。
    if (!env.ADMIN_PASSWORD) return;
    try {
        const actor = await resolveActor(request, env.ADMIN_PASSWORD);
        await env.DB.prepare(
            `INSERT INTO audit_logs
             (id, actor_type, actor_id, action, entity_type, entity_id, year_month, target_date, summary, before_json, after_json, metadata_json, request_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            `audit_${crypto.randomUUID()}`, actor.type, actor.id, input.action, input.entityType,
            input.entityId ?? null, input.yearMonth ?? null, input.targetDate ?? null, input.summary,
            json(input.before), json(input.after), json(input.metadata), input.requestId ?? null,
        ).run();
    } catch (error) {
        console.error('Failed to write audit log:', error);
    }
};
