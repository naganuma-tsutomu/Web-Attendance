import { createValidationError, handleServerError } from '../../../../utils/validation';
import type { Env, D1Row } from '../../../../types';
import { parseSnapshotShifts } from '../index';

const escapeCsv = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
};

const toCsv = (headers: string[], rows: unknown[][]): string => {
    const lines = [
        headers.map(escapeCsv).join(','),
        ...rows.map(row => row.map(escapeCsv).join(',')),
    ];
    return `${lines.join('\r\n')}\r\n`;
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        if (!id) return createValidationError('snapshot id は必須です');

        const snapshot = await context.env.DB.prepare(
            `SELECT yearMonth, label, shifts_json
             FROM shift_snapshots
             WHERE id = ?`
        ).bind(id).first<D1Row>();

        if (!snapshot) {
            return new Response(JSON.stringify({ error: 'バックアップが見つかりません' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const [{ results: staffRows }, { results: classRows }] = await Promise.all([
            context.env.DB.prepare('SELECT id, name FROM staffs').all(),
            context.env.DB.prepare('SELECT id, name FROM classes').all(),
        ]);

        const staffNames = new Map((staffRows as D1Row[]).map(row => [String(row.id), String(row.name)]));
        const classNames = new Map((classRows as D1Row[]).map(row => [String(row.id), String(row.name)]));
        const shifts = parseSnapshotShifts(String(snapshot.shifts_json));

        const csv = toCsv(
            ['日付', 'スタッフ名', 'クラス', '開始', '終了', '当番番号'],
            shifts.map(shift => [
                shift.date,
                staffNames.get(shift.staffId) ?? shift.staffId,
                classNames.get(shift.classType) ?? shift.classType,
                shift.startTime,
                shift.endTime,
                shift.duty_number ?? '',
            ])
        );

        const rawLabel = snapshot.label ? String(snapshot.label) : 'backup';
        const safeLabel = rawLabel.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
        const filename = `shift_backup_${snapshot.yearMonth}_${safeLabel}.csv`;

        return new Response(`\uFEFF${csv}`, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
            },
        });
    } catch (e) {
        return handleServerError(e, 'GET /shifts/snapshots/:id/export');
    }
};
