import type { D1Row, Env } from '../../types';
import { createValidationError, handleServerError, safeJsonParse, validateYearMonth } from '../../utils/validation';

const ALLOWED_ACTIONS = new Set(['create', 'update', 'delete', 'replace', 'import', 'restore', 'lock', 'unlock']);

type AuditCursor = { occurredAt: string; id: string };

const parseCursor = (value: string): AuditCursor | null => {
    if (value.length > 500) return null;
    try {
        const parsed: unknown = JSON.parse(value);
        if (
            !Array.isArray(parsed) || parsed.length !== 2 ||
            typeof parsed[0] !== 'string' || !parsed[0] || parsed[0].length > 100 ||
            typeof parsed[1] !== 'string' || !parsed[1] || parsed[1].length > 200
        ) {
            return null;
        }
        return { occurredAt: parsed[0], id: parsed[1] };
    } catch {
        return null;
    }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const action = url.searchParams.get('action');
        const cursorParam = url.searchParams.get('cursor');
        const limitParam = url.searchParams.get('limit');
        const limit = limitParam === null ? 50 : Number(limitParam);
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            return createValidationError('limitは1〜100の整数で指定してください');
        }
        if (yearMonth !== null) {
            const error = validateYearMonth(yearMonth);
            if (error) return createValidationError(error);
        }
        if (action && !ALLOWED_ACTIONS.has(action)) return createValidationError('actionが不正です');
        const cursor = cursorParam === null ? null : parseCursor(cursorParam);
        if (cursorParam !== null && !cursor) return createValidationError('cursorが不正です');

        const clauses: string[] = [];
        const bindings: Array<string | number> = [];
        if (yearMonth) { clauses.push('year_month = ?'); bindings.push(yearMonth); }
        if (action) { clauses.push('action = ?'); bindings.push(action); }
        if (cursor) {
            clauses.push('(occurred_at < ? OR (occurred_at = ? AND id < ?))');
            bindings.push(cursor.occurredAt, cursor.occurredAt, cursor.id);
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const { results } = await context.env.DB.prepare(
            `SELECT id, occurred_at, actor_type, actor_id, action, entity_type, entity_id,
                    year_month, target_date, summary, before_json, after_json, metadata_json, request_id
             FROM audit_logs ${where}
             ORDER BY occurred_at DESC, id DESC LIMIT ?`
        ).bind(...bindings, limit + 1).all();
        const rows = results as D1Row[];
        const hasMore = rows.length > limit;
        const page = rows.slice(0, limit).map(row => ({
            id: String(row.id), occurredAt: String(row.occurred_at), actorType: String(row.actor_type),
            actorId: row.actor_id == null ? null : String(row.actor_id), action: String(row.action),
            entityType: String(row.entity_type), entityId: row.entity_id == null ? null : String(row.entity_id),
            yearMonth: row.year_month == null ? null : String(row.year_month), targetDate: row.target_date == null ? null : String(row.target_date),
            summary: String(row.summary), before: safeJsonParse(row.before_json == null ? null : String(row.before_json), null),
            after: safeJsonParse(row.after_json == null ? null : String(row.after_json), null),
            metadata: safeJsonParse(row.metadata_json == null ? null : String(row.metadata_json), null),
            requestId: row.request_id == null ? null : String(row.request_id),
        }));
        const lastItem = page.at(-1);
        const nextCursor = hasMore && lastItem
            ? JSON.stringify([lastItem.occurredAt, lastItem.id])
            : null;
        return Response.json({ items: page, nextCursor });
    } catch (error) {
        return handleServerError(error, 'GET /audit-logs');
    }
};
