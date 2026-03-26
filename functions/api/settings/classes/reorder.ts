import { createValidationError, handleServerError } from '../../../utils/validation';
import type { Env } from '../../../types';

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const { orders }: { orders: { id: string, order: number }[] } = await context.request.json();

        if (!orders || !Array.isArray(orders)) {
            return createValidationError('Invalid orders data');
        }

        const statements = orders.map(item =>
            context.env.DB.prepare("UPDATE classes SET display_order = ? WHERE id = ?")
                .bind(item.order, item.id)
        );

        await context.env.DB.batch(statements);

        return Response.json({ success: true, message: 'Reordered' });
    } catch (e) {
        return handleServerError(e, 'Database error reordering classes');
    }
};
