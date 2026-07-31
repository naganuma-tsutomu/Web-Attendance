import { describe, expect, it, vi } from 'vitest';
import { onRequestPost as createTemplate } from '../../../functions/api/settings/shift-requirement-templates/index';
import { onRequestPost as applyTemplate } from '../../../functions/api/settings/shift-requirement-templates/[id]/apply';
import { onRequestPost as overwriteTemplate } from '../../../functions/api/settings/shift-requirement-templates/[id]/capture';
import { onRequestPost as saveRequirements } from '../../../functions/api/settings/shift-requirements/index';

type Row = Record<string, unknown>;

const makeStatement = (sql: string, rows: Row[] = []) => {
    const statement = {
        sql,
        binds: [] as unknown[],
        bind: (...values: unknown[]) => {
            statement.binds = values;
            return statement;
        },
        first: async () => rows[0] ?? null,
        all: async () => ({ results: rows }),
        run: async () => ({ success: true, meta: { changes: 1 } }),
    };
    return statement;
};

describe('shift requirement template API', () => {
    it('空配列を現在の必要人数設定の全件削除として保存する', async () => {
        const batch = vi.fn().mockResolvedValue([]);
        const db = {
            prepare: (sql: string) => makeStatement(sql),
            batch,
        };
        const response = await saveRequirements({
            request: { json: async () => [] },
            env: { DB: db },
        } as never);

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({ ids: [], count: 0 });
        const statements = batch.mock.calls[0][0] as Array<{ sql: string }>;
        expect(statements).toHaveLength(1);
        expect(statements[0].sql).toBe('DELETE FROM shift_requirements');
    });

    it('現在の全クラス設定を1回のbatchでテンプレートに保存する', async () => {
        const requirements = [
            { classId: 'class-a', dayOfWeek: 7, startTime: '09:00', endTime: '12:00', minStaffCount: 2, maxStaffCount: null, priority: 3 },
            { classId: 'class-b', dayOfWeek: 7, startTime: '13:00', endTime: '18:00', minStaffCount: 3, maxStaffCount: 4, priority: 4 },
        ];
        const batch = vi.fn().mockResolvedValue([]);
        const db = {
            prepare: (sql: string) => {
                if (sql.includes('FROM shift_requirements')) return makeStatement(sql, requirements);
                return makeStatement(sql);
            },
            batch,
        };
        const response = await createTemplate({
            request: { json: async () => ({ name: '夏休み' }) },
            env: { DB: db },
        } as never);

        expect(response.status).toBe(201);
        expect(batch).toHaveBeenCalledOnce();
        const statements = batch.mock.calls[0][0] as Array<{ sql: string; binds: unknown[] }>;
        expect(statements).toHaveLength(3);
        expect(statements[0].sql).toContain('INSERT INTO shift_requirement_templates');
        expect(statements[1].binds).toContain('class-a');
        expect(statements[2].binds).toContain('class-b');
    });

    it('テンプレート適用時に現在設定の削除と全件挿入を同じbatchで行う', async () => {
        const items = [
            { classId: 'class-a', dayOfWeek: 7, startTime: '09:00', endTime: '12:00', minStaffCount: 1, maxStaffCount: null, priority: 3, display_order: 0 },
            { classId: 'class-b', dayOfWeek: 6, startTime: '08:00', endTime: '14:00', minStaffCount: 2, maxStaffCount: null, priority: 4, display_order: 1 },
        ];
        const batch = vi.fn().mockResolvedValue([]);
        const db = {
            prepare: (sql: string) => {
                if (sql.includes('SELECT id FROM shift_requirement_templates')) return makeStatement(sql, [{ id: 'template-1' }]);
                if (sql.includes('FROM shift_requirement_template_items')) return makeStatement(sql, items);
                return makeStatement(sql);
            },
            batch,
        };
        const response = await applyTemplate({
            params: { id: 'template-1' },
            env: { DB: db },
        } as never);

        expect(response.status).toBe(200);
        expect(batch).toHaveBeenCalledOnce();
        const statements = batch.mock.calls[0][0] as Array<{ sql: string; binds: unknown[] }>;
        expect(statements).toHaveLength(3);
        expect(statements[0].sql).toBe('DELETE FROM shift_requirements');
        expect(statements[1].binds).toContain('class-a');
        expect(statements[2].binds).toContain('class-b');
    });

    it('テンプレート上書き時に旧明細の削除と新明細の挿入を同じbatchで行う', async () => {
        const requirements = [
            { classId: 'class-a', dayOfWeek: 7, startTime: '08:00', endTime: '16:00', minStaffCount: 3, maxStaffCount: null, priority: 5 },
        ];
        const batch = vi.fn().mockResolvedValue([]);
        const db = {
            prepare: (sql: string) => {
                if (sql.includes('SELECT id FROM shift_requirement_templates')) return makeStatement(sql, [{ id: 'template-1' }]);
                if (sql.includes('FROM shift_requirements')) return makeStatement(sql, requirements);
                return makeStatement(sql);
            },
            batch,
        };
        const response = await overwriteTemplate({
            params: { id: 'template-1' },
            env: { DB: db },
        } as never);

        expect(response.status).toBe(200);
        const statements = batch.mock.calls[0][0] as Array<{ sql: string; binds: unknown[] }>;
        expect(statements[0].sql).toContain('DELETE FROM shift_requirement_template_items');
        expect(statements[1].binds).toContain('class-a');
        expect(statements[2].sql).toContain('UPDATE shift_requirement_templates');
    });

    it('空の現在設定はテンプレートとして保存しない', async () => {
        const batch = vi.fn();
        const db = {
            prepare: (sql: string) => makeStatement(sql),
            batch,
        };
        const response = await createTemplate({
            request: { json: async () => ({ name: '空設定' }) },
            env: { DB: db },
        } as never);

        expect(response.status).toBe(400);
        expect(batch).not.toHaveBeenCalled();
    });
});
