export interface Env { DB: D1Database; }

import { handleServerError } from '../../../utils/validation';

// PUT /api/settings/time-patterns/reorder
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const { orders } = await context.request.json() as { orders: { id: string, order: number }[] };

        if (!orders || !Array.isArray(orders)) {
            return new Response(JSON.stringify({ message: 'Invalid orders' }), { status: 400 });
        }

        const statements = orders.map(item =>
            context.env.DB.prepare('UPDATE shift_time_patterns SET display_order = ? WHERE id = ?')
                .bind(item.order, item.id)
        );

        await context.env.DB.batch(statements);

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error reordering time patterns');
    }
};
