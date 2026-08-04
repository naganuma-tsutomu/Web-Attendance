import { describe, expect, it } from 'vitest';
import { ReorderRequestSchema } from '../../../shared/reorderSchema';

describe('ReorderRequestSchema', () => {
    it('一意なIDと表示順を受け入れる', () => {
        expect(ReorderRequestSchema.safeParse({ orders: [
            { id: 'a', order: 1 }, { id: 'b', order: 2 },
        ] }).success).toBe(true);
    });

    it.each([
        { orders: [{ id: 'a', order: 1 }, { id: 'a', order: 2 }] },
        { orders: [{ id: 'a', order: 1 }, { id: 'b', order: 1 }] },
        { orders: [{ id: '', order: 1 }] },
        { orders: [{ id: 'a', order: 0 }] },
        { orders: [{ id: 'a', order: 1 }], extra: true },
    ])('不正な並び替え入力を拒否する', (input) => {
        expect(ReorderRequestSchema.safeParse(input).success).toBe(false);
    });
});
