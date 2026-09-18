import { afterEach, describe, expect, it } from 'vitest';
import { onRequestDelete as deleteStaff } from '../../../functions/api/staffs/[id]';
import { onRequestDelete as permanentlyDeleteStaff, onRequestPost as restoreStaff } from '../../../functions/api/staffs/retired/[id]';
import { onRequestGet as getRetiredStaff } from '../../../functions/api/staffs/retired/index';
import { createD1Miniflare } from './miniflareTestUtils';

describe('staff retirement with D1', () => {
    let miniflare: ReturnType<typeof createD1Miniflare> | undefined;

    afterEach(async () => {
        await miniflare?.dispose();
        miniflare = undefined;
    });

    it.each(['NO ACTION', 'CASCADE'] as const)(
        'shift_preferencesが%sでも退職・復職で履歴を保ち、完全削除時に関連データを消す',
        async (preferenceDeleteAction) => {
            miniflare = createD1Miniflare();
            const db = await miniflare.getD1Database('DB');
            await db.batch([
                db.prepare('CREATE TABLE staffs (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, retired_at TEXT, access_key TEXT)'),
                db.prepare('CREATE UNIQUE INDEX idx_staffs_access_key ON staffs(access_key) WHERE access_key IS NOT NULL'),
                db.prepare('CREATE TABLE shifts (id TEXT PRIMARY KEY, staffId TEXT NOT NULL, date TEXT NOT NULL)'),
                db.prepare(`CREATE TABLE staff_classes (
                    staffId TEXT NOT NULL, classId TEXT NOT NULL,
                    PRIMARY KEY (staffId, classId),
                    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
                )`),
                db.prepare(`CREATE TABLE staff_available_days (
                    id TEXT PRIMARY KEY, staffId TEXT NOT NULL,
                    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
                )`),
                db.prepare(`CREATE TABLE shift_preferences (
                    id TEXT PRIMARY KEY, staffId TEXT NOT NULL,
                    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE ${preferenceDeleteAction}
                )`),
                db.prepare(`CREATE TABLE shift_preference_dates (
                    id TEXT PRIMARY KEY, staffId TEXT NOT NULL,
                    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
                )`),
                db.prepare(`CREATE TABLE shift_snapshots (
                    id TEXT PRIMARY KEY, shifts_json TEXT NOT NULL, shift_count INTEGER NOT NULL
                )`),
            ]);
            await db.batch([
                db.prepare("INSERT INTO staffs (id, name, role, access_key) VALUES ('s1', '削除対象', 'バイト', '123456'), ('s2', '維持対象', 'バイト', '654321')"),
                db.prepare("INSERT INTO shifts (id, staffId, date) VALUES ('shift1', 's1', '2026-08-01'), ('shift2', 's2', '2026-08-01')"),
                db.prepare("INSERT INTO staff_classes (staffId, classId) VALUES ('s1', 'c1'), ('s2', 'c1')"),
                db.prepare("INSERT INTO staff_available_days (id, staffId) VALUES ('available1', 's1'), ('available2', 's2')"),
                db.prepare("INSERT INTO shift_preferences (id, staffId) VALUES ('preference1', 's1'), ('preference2', 's2')"),
                db.prepare("INSERT INTO shift_preference_dates (id, staffId) VALUES ('date1', 's1'), ('date2', 's2')"),
                db.prepare("INSERT INTO shift_snapshots (id, shifts_json, shift_count) VALUES ('snap1', '[{\"staffId\":\"s1\"},{\"staffId\":\"s2\"}]', 2)"),
            ]);

            const response = await deleteStaff({
                request: new Request('https://example.com/api/staffs/s1', { method: 'DELETE' }),
                env: { DB: db },
            } as never);

            expect(response.status).toBe(200);
            await expect(db.prepare('SELECT id, access_key, retired_at FROM staffs WHERE id = ?').bind('s1').first())
                .resolves.toMatchObject({ id: 's1', access_key: null, retired_at: expect.any(String) });
            await expect(db.prepare('SELECT id FROM shifts WHERE staffId = ?').bind('s1').all())
                .resolves.toMatchObject({ results: [{ id: 'shift1' }] });
            const historyResponse = await getRetiredStaff({ env: { DB: db } } as never);
            expect(historyResponse.status).toBe(200);
            await expect(historyResponse.json()).resolves.toEqual([
                expect.objectContaining({ id: 's1', name: '削除対象', shiftCount: 1 }),
            ]);

            const restoreResponse = await restoreStaff({
                params: { id: 's1' },
                request: new Request('https://example.com/api/staffs/retired/s1', { method: 'POST' }),
                env: { DB: db },
            } as never);
            expect(restoreResponse.status).toBe(200);
            const restored = await db.prepare('SELECT id, access_key, retired_at FROM staffs WHERE id = ?').bind('s1').first<{ id: string; access_key: string; retired_at: string | null }>();
            expect(restored).toMatchObject({ id: 's1', retired_at: null });
            expect(restored!.access_key).toMatch(/^\d{6}$/);
            expect(restored!.access_key).not.toBe('654321');
            await expect(db.prepare('SELECT id FROM shifts WHERE staffId = ?').bind('s1').all())
                .resolves.toMatchObject({ results: [{ id: 'shift1' }] });
            await expect(db.prepare('SELECT staffId FROM shift_preferences WHERE staffId = ?').bind('s1').all())
                .resolves.toMatchObject({ results: [{ staffId: 's1' }] });
            const restoredSnapshot = await db.prepare('SELECT shifts_json FROM shift_snapshots WHERE id = ?').bind('snap1').first<{ shifts_json: string }>();
            expect(JSON.parse(restoredSnapshot!.shifts_json)).toEqual([{ staffId: 's1' }, { staffId: 's2' }]);
            await expect((await getRetiredStaff({ env: { DB: db } } as never)).json()).resolves.toEqual([]);

            const secondRestore = await restoreStaff({
                params: { id: 's1' },
                request: new Request('https://example.com/api/staffs/retired/s1', { method: 'POST' }),
                env: { DB: db },
            } as never);
            expect(secondRestore.status).toBe(404);
            expect((await db.prepare('SELECT access_key FROM staffs WHERE id = ?').bind('s1').first<{ access_key: string }>())?.access_key).toBe(restored!.access_key);

            expect((await deleteStaff({
                request: new Request('https://example.com/api/staffs/s1', { method: 'DELETE' }),
                env: { DB: db },
            } as never)).status).toBe(200);

            const permanentResponse = await permanentlyDeleteStaff({
                params: { id: 's1' },
                request: new Request('https://example.com/api/staffs/retired/s1', { method: 'DELETE' }),
                env: { DB: db },
            } as never);
            expect(permanentResponse.status).toBe(200);
            await expect(db.prepare('SELECT id FROM staffs ORDER BY id').all())
                .resolves.toMatchObject({ results: [{ id: 's2' }] });
            await expect(db.prepare('SELECT id, staffId FROM shifts ORDER BY id').all())
                .resolves.toMatchObject({ results: [{ id: 'shift2', staffId: 's2' }] });
            for (const table of ['staff_classes', 'staff_available_days', 'shift_preferences', 'shift_preference_dates']) {
                await expect(db.prepare(`SELECT staffId FROM ${table} ORDER BY staffId`).all())
                    .resolves.toMatchObject({ results: [{ staffId: 's2' }] });
            }
            const snapshot = await db.prepare('SELECT shifts_json, shift_count FROM shift_snapshots WHERE id = ?').bind('snap1').first<{ shifts_json: string; shift_count: number }>();
            expect(JSON.parse(snapshot!.shifts_json)).toEqual([{ staffId: 's2' }]);
            expect(snapshot!.shift_count).toBe(1);

            const deletedRestore = await restoreStaff({
                params: { id: 's1' },
                request: new Request('https://example.com/api/staffs/retired/s1', { method: 'POST' }),
                env: { DB: db },
            } as never);
            expect(deletedRestore.status).toBe(404);
        },
        15_000,
    );
});
