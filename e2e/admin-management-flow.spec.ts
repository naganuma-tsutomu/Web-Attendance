import { expect, test, type Page, type Route } from '@playwright/test';

const authenticatedUser = {
    authenticated: true,
    user: { uid: 'admin', email: null },
};

const fulfillJson = (route: Route, json: unknown, status = 200) =>
    route.fulfill({ status, json });

const collectPageErrors = (page: Page) => {
    const errors: Error[] = [];
    page.on('pageerror', error => errors.push(error));
    return errors;
};

test('クラスを追加し、基本情報を更新できる', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    let classes = [
        { id: 'class-1', name: 'A組', display_order: 0, auto_allocate: 1, color: '#818cf8' },
    ];
    let createdBody: Record<string, unknown> | null = null;
    let updatedBody: Record<string, unknown> | null = null;

    await page.route('http://127.0.0.1:5173/api/**', async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;

        if (path === '/api/auth/me') return fulfillJson(route, authenticatedUser);
        if (path === '/api/settings/facility') return fulfillJson(route, { name: 'E2E保育園' });
        if (path === '/api/settings/classes' && request.method() === 'GET') return fulfillJson(route, classes);
        if (path === '/api/settings/classes' && request.method() === 'POST') {
            createdBody = request.postDataJSON();
            classes = [...classes, { id: 'class-2', display_order: 1, ...createdBody } as typeof classes[number]];
            return fulfillJson(route, { id: 'class-2' }, 201);
        }
        if (path === '/api/settings/classes/class-2' && request.method() === 'PUT') {
            updatedBody = request.postDataJSON();
            classes = classes.map(item => item.id === 'class-2' ? { ...item, ...updatedBody } : item);
            return fulfillJson(route, { success: true });
        }
        if (path === '/api/staffs') return fulfillJson(route, []);
        if (path === '/api/settings/shift-requirements') return fulfillJson(route, []);
        if (path === '/api/settings/shift-requirement-templates') return fulfillJson(route, []);
        return fulfillJson(route, []);
    });

    await page.goto('/admin/settings/classes');

    await expect(page.getByRole('heading', { name: 'クラス管理' })).toBeVisible();
    await page.getByRole('button', { name: '新規追加' }).click();
    await page.getByPlaceholder('例：虹組').fill('虹組');
    await page.getByRole('button', { name: '追加', exact: true }).click();

    await expect(page.getByRole('button', { name: '虹組' })).toBeVisible();
    expect(createdBody).toMatchObject({ name: '虹組', auto_allocate: 1, color: '#818cf8' });

    await page.getByRole('button', { name: '虹組' }).click();
    await expect(page.getByLabel('クラス名')).toHaveValue('虹組');
    await page.getByLabel('クラス名').fill('虹組（新）');
    await page.getByRole('button', { name: '保存', exact: true }).click();

    await expect(page.getByRole('button', { name: '虹組（新）' })).toBeVisible();
    expect(updatedBody).toMatchObject({ name: '虹組（新）', auto_allocate: 1, color: '#818cf8' });
    await expect.poll(() => pageErrors.map(error => error.message)).toEqual([]);
});

test('勤務パターンを追加し、利用中パターンの削除エラーを表示できる', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    let patterns = [{
        id: 'pattern-1',
        name: '早番',
        startTime: '07:30',
        endTime: '16:30',
        roleIds: [],
        display_order: 0,
        sun: 0,
        mon: 1,
        tue: 1,
        wed: 1,
        thu: 1,
        fri: 1,
        sat: 1,
        holiday: 0,
    }];
    let createdBody: Record<string, unknown> | null = null;
    let deletedPatternId: string | null = null;

    await page.route('http://127.0.0.1:5173/api/**', async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;

        if (path === '/api/auth/me') return fulfillJson(route, authenticatedUser);
        if (path === '/api/settings/facility') return fulfillJson(route, { name: 'E2E保育園' });
        if (path === '/api/settings/business-hours') {
            return fulfillJson(route, { startHour: 8, endHour: 19, closedDays: [0, 7] });
        }
        if (path === '/api/settings/roles') return fulfillJson(route, []);
        if (path === '/api/settings/time-patterns' && request.method() === 'GET') return fulfillJson(route, patterns);
        if (path === '/api/settings/time-patterns' && request.method() === 'POST') {
            createdBody = request.postDataJSON();
            patterns = [...patterns, {
                id: 'pattern-2',
                display_order: 1,
                ...createdBody,
            } as typeof patterns[number]];
            return fulfillJson(route, { id: 'pattern-2' }, 201);
        }
        if (path === '/api/settings/time-patterns/pattern-1' && request.method() === 'DELETE') {
            deletedPatternId = 'pattern-1';
            return fulfillJson(route, { error: 'ローテーション設定で使用中のため削除できません' }, 409);
        }
        return fulfillJson(route, []);
    });

    await page.goto('/admin/settings/patterns');

    await expect(page.getByRole('heading', { name: '勤務時間パターン' })).toBeVisible();
    await page.getByRole('button', { name: 'パターン追加' }).click();
    await page.getByLabel('パターン名称').fill('遅番');
    await page.getByLabel('開始時間').fill('10:00');
    await page.getByLabel('終了時間').fill('19:00');
    await page.getByRole('button', { name: 'パターンを登録' }).click();

    await expect(page.getByText('遅番', { exact: true })).toBeVisible();
    expect(createdBody).toMatchObject({
        name: '遅番',
        startTime: '10:00',
        endTime: '19:00',
        roleIds: [],
        sun: 0,
        holiday: 0,
    });

    await page.getByTitle('削除').first().click();
    const confirmDialog = page.getByRole('dialog', { name: 'パターンの削除' });
    await confirmDialog.getByRole('button', { name: '削除する' }).click();

    await expect(page.getByText('ローテーション設定で使用中のため削除できません')).toBeVisible();
    await expect(confirmDialog).toBeVisible();
    await expect(page.getByText('早番', { exact: true })).toBeVisible();
    expect(deletedPatternId).toBe('pattern-1');
    await expect.poll(() => pageErrors.map(error => error.message)).toEqual([]);
});

test('スタッフ区分を追加し、編集画面から表示順を変更できる', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    const timePatterns = [{
        id: 'pattern-1',
        name: '早番',
        startTime: '07:30',
        endTime: '16:30',
        roleIds: [],
        display_order: 0,
        sun: 0,
        mon: 1,
        tue: 1,
        wed: 1,
        thu: 1,
        fri: 1,
        sat: 1,
        holiday: 0,
    }];
    let roles = [
        { id: 'role-1', name: '常勤', targetHours: 160, weeklyHoursTarget: 40, display_order: 1, patterns: [] },
        { id: 'role-2', name: '非常勤', targetHours: null, weeklyHoursTarget: null, display_order: 2, patterns: [] },
    ];
    let createdBody: Record<string, unknown> | null = null;
    let reorderBody: { orders: Array<{ id: string; order: number }> } | null = null;
    const roleUpdates: Record<string, unknown>[] = [];

    await page.route('http://127.0.0.1:5173/api/**', async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;

        if (path === '/api/auth/me') return fulfillJson(route, authenticatedUser);
        if (path === '/api/settings/facility') return fulfillJson(route, { name: 'E2E保育園' });
        if (path === '/api/settings/time-patterns') return fulfillJson(route, timePatterns);
        if (path === '/api/settings/roles' && request.method() === 'GET') return fulfillJson(route, roles);
        if (path === '/api/settings/roles' && request.method() === 'POST') {
            createdBody = request.postDataJSON();
            const patternIds = createdBody?.patternIds as string[] ?? [];
            roles = [...roles, {
                id: 'role-3',
                name: createdBody?.name as string,
                targetHours: createdBody?.targetHours as number | null,
                weeklyHoursTarget: createdBody?.weeklyHoursTarget as number | null,
                display_order: 3,
                patterns: timePatterns.filter(pattern => patternIds.includes(pattern.id)),
            }];
            return fulfillJson(route, { id: 'role-3' }, 201);
        }
        if (path === '/api/settings/roles/reorder' && request.method() === 'PUT') {
            reorderBody = request.postDataJSON();
            const orders = reorderBody?.orders ?? [];
            roles = roles
                .map(role => ({ ...role, display_order: orders.find(item => item.id === role.id)?.order ?? role.display_order }))
                .sort((left, right) => left.display_order - right.display_order);
            return fulfillJson(route, { success: true });
        }
        if (path === '/api/settings/roles/role-1' && request.method() === 'PUT') {
            const body = request.postDataJSON() as Record<string, unknown>;
            roleUpdates.push(body);
            roles = roles.map(role => {
                if (role.id !== 'role-1') return role;
                if (Array.isArray(body.patternIds)) {
                    return { ...role, patterns: timePatterns.filter(pattern => body.patternIds?.includes(pattern.id)) };
                }
                return { ...role, ...body };
            });
            return fulfillJson(route, { success: true });
        }
        return fulfillJson(route, []);
    });

    await page.goto('/admin/settings/roles');

    await expect(page.getByRole('heading', { name: 'スタッフ区分管理' })).toBeVisible();
    await page.getByRole('button', { name: 'スタッフ区分追加' }).click();
    await page.getByLabel('スタッフ区分名').fill('補助');
    await page.getByRole('button', { name: '早番' }).click();
    await page.getByRole('button', { name: 'スタッフ区分を登録' }).click();

    await expect(page.getByText('補助', { exact: true }).last()).toBeVisible();
    expect(createdBody).toEqual({
        name: '補助',
        targetHours: null,
        patternIds: ['pattern-1'],
        weeklyHoursTarget: null,
    });

    await page.getByTitle('編集').nth(1).click();
    await page.getByLabel('スタッフ区分名').fill('常勤職員');
    await page.getByLabel('表示順').fill('2');
    await page.getByRole('button', { name: '保存', exact: true }).click();

    await expect(page.getByText('常勤職員', { exact: true }).last()).toBeVisible();
    expect(reorderBody).toEqual({
        orders: [
            { id: 'role-2', order: 1 },
            { id: 'role-1', order: 2 },
            { id: 'role-3', order: 3 },
        ],
    });
    expect(roleUpdates).toContainEqual({ name: '常勤職員', targetHours: 160, weeklyHoursTarget: 40 });
    expect(roleUpdates).toContainEqual({ patternIds: [] });
    await expect.poll(() => pageErrors.map(error => error.message)).toEqual([]);
});

test('操作履歴を追加で読み込み、変更内容を確認できる', async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    const auditRequests: string[] = [];

    await page.route('http://127.0.0.1:5173/api/**', async route => {
        const request = route.request();
        const url = new URL(request.url());

        if (url.pathname === '/api/auth/me') return fulfillJson(route, authenticatedUser);
        if (url.pathname === '/api/settings/facility') return fulfillJson(route, { name: 'E2E保育園' });
        if (url.pathname === '/api/audit-logs') {
            auditRequests.push(url.search);
            if (url.searchParams.get('cursor') === 'cursor-1') {
                return fulfillJson(route, {
                    items: [{
                        id: 'audit-2',
                        occurredAt: '2026-09-08 11:00:00',
                        actorType: 'admin',
                        actorId: 'admin',
                        action: 'update',
                        entityType: 'class',
                        entityId: 'class-1',
                        yearMonth: '2026-09',
                        targetDate: null,
                        summary: 'クラス「虹組」を更新しました',
                        before: { name: 'A組' },
                        after: { name: '虹組' },
                        metadata: null,
                        requestId: 'request-2',
                    }],
                    nextCursor: null,
                });
            }
            return fulfillJson(route, {
                items: [{
                    id: 'audit-1',
                    occurredAt: '2026-09-08 10:00:00',
                    actorType: 'admin',
                    actorId: 'admin',
                    action: 'create',
                    entityType: 'time_pattern',
                    entityId: 'pattern-2',
                    yearMonth: '2026-09',
                    targetDate: null,
                    summary: '勤務パターン「遅番」を追加しました',
                    before: null,
                    after: { name: '遅番' },
                    metadata: null,
                    requestId: 'request-1',
                }],
                nextCursor: 'cursor-1',
            });
        }
        return fulfillJson(route, []);
    });

    await page.goto('/admin/audit-logs');

    await expect(page.getByRole('heading', { name: '操作履歴' })).toBeVisible();
    await expect(page.getByText('勤務パターン「遅番」を追加しました')).toBeVisible();
    await page.getByRole('button', { name: 'さらに読み込む' }).click();

    await expect(page.getByText('クラス「虹組」を更新しました')).toBeVisible();
    expect(auditRequests.some(query => new URLSearchParams(query).get('cursor') === 'cursor-1')).toBe(true);

    await page.getByRole('button', { name: /クラス「虹組」を更新しました/ }).click();
    await expect(page.getByText('変更前')).toBeVisible();
    await expect(page.getByText('変更後')).toBeVisible();
    await expect(page.getByText(/"name": "A組"/)).toBeVisible();
    await expect(page.getByText(/"name": "虹組"/)).toBeVisible();
    await expect.poll(() => pageErrors.map(error => error.message)).toEqual([]);
});
