import { describe, expect, it, vi } from 'vitest';
import { writeAuditLog } from '../../../functions/utils/auditLog';

describe('writeAuditLog', () => {
    it('認証設定がない環境ではDBへ書き込まない', async () => {
        const prepare = vi.fn();
        await writeAuditLog({ DB: { prepare } as never }, new Request('https://example.com'), {
            action: 'update', entityType: 'shift', summary: '更新',
        });
        expect(prepare).not.toHaveBeenCalled();
    });

    it('機密フィールドを除外して記録する', async () => {
        const run = vi.fn().mockResolvedValue({});
        const bind = vi.fn().mockReturnValue({ run });
        const prepare = vi.fn().mockReturnValue({ bind });
        await writeAuditLog(
            { DB: { prepare } as never, ADMIN_PASSWORD: 'secret' },
            new Request('https://example.com'),
            { action: 'update', entityType: 'staff', summary: 'スタッフ更新', after: { name: '田中', accessKey: '123456' } },
        );
        expect(run).toHaveBeenCalledOnce();
        const serialized = bind.mock.calls[0].find((value: unknown) => typeof value === 'string' && value.includes('田中'));
        expect(serialized).toContain('田中');
        expect(serialized).not.toContain('123456');
    });
});
