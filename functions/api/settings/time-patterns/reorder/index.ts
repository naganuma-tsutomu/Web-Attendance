export interface Env { DB: D1Database; }

import { handleServerError } from '../../../utils/validation';

// PUT /api/settings/time-patterns/reorder
// Body: { order: [{ id: string, display_order: number }, ...] }
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { 
            order: Array<{ id: string; display_order: number }>;
        };

        if (!body.order || !Array.isArray(body.order) || body.order.length === 0) {
            return Response.json({ error: 'Invalid order data' }, { status: 400 });
        }

        // Batch update using transactions
        const stmt = await context.env.DB.prepare(
            'UPDATE shift_time_patterns SET display_order = ? WHERE id = ?'
        );

        for (const item of body.order) {
            await stmt.bind(item.display_order, item.id).run();
        }

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error reordering time patterns');
    }
};
