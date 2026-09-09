import { createValidationError, handleServerError } from '../../../utils/validation';
import type { Env } from '../../../types';
import { ReorderRequestSchema } from '../../../../shared/reorderSchema';

// PUT /api/settings/time-patterns/reorder
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const parsed = ReorderRequestSchema.safeParse(await context.request.json());
        if (!parsed.success) {
            return createValidationError('Invalid orders data');
        }
        const { orders } = parsed.data;
        if (orders.length === 0) {
            return Response.json({ success: true, message: 'Reordered' });
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
