import type { D1Row, Env } from '../../types';
import { createValidationError, handleServerError, validateYearMonth } from '../../utils/validation';

const ALLOWED_ACTIONS = new Set(['create', 'update', 'delete', 'replace', 'import', 'restore', 'lock', 'unlock']);

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const action = url.searchParams.get('action');
        const cursor = url.searchParams.get('cursor');
        const requestedLimit = Number(url.searchParams.get('limit') ?? 50);
        const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;
        if (yearMonth) {
            const error = validateYearMonth(yearMonth);
            if (error) return createValidationError(error);
        }
        if (action && !ALLOWED_ACTIONS.has(action)) return createValidationError('actionが不正です');

        const clauses: string[] = [];
        const bindings: Array<string | number> = [];
        if (yearMonth) { clauses.push('year_month = ?'); bindings.push(yearMonth); }
        if (action) { clauses.push('action = ?'); bindings.push(action); }
        if (cursor) { clauses.push('occurred_at < ?'); bindings.push(cursor); }
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
            summary: String(row.summary), before: row.before_json ? JSON.parse(String(row.before_json)) : null,
            after: row.after_json ? JSON.parse(String(row.after_json)) : null,
            metadata: row.metadata_json ? JSON.parse(String(row.metadata_json)) : null,
            requestId: row.request_id == null ? null : String(row.request_id),
        }));
        return Response.json({ items: page, nextCursor: hasMore ? page.at(-1)?.occurredAt ?? null : null });
    } catch (error) {
        return handleServerError(error, 'GET /audit-logs');
    }
};
