import { z } from 'zod';

export const ReorderRequestSchema = z.object({
    orders: z.array(z.object({
        id: z.string().trim().min(1).max(200),
        order: z.number().int().nonnegative().max(999_999),
    })).max(1000),
}).strict().superRefine(({ orders }, context) => {
    const ids = new Set<string>();
    const positions = new Set<number>();
    orders.forEach((item, index) => {
        if (ids.has(item.id)) {
            context.addIssue({ code: 'custom', path: ['orders', index, 'id'], message: 'IDが重複しています' });
        }
        if (positions.has(item.order)) {
            context.addIssue({ code: 'custom', path: ['orders', index, 'order'], message: '表示順が重複しています' });
        }
        ids.add(item.id);
        positions.add(item.order);
    });
});

export type ReorderRequest = z.infer<typeof ReorderRequestSchema>;
