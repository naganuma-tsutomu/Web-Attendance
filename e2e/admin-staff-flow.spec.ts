import { expect, test } from '@playwright/test';

test('キーボードで管理者ログイン後にスタッフを登録できる', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', error => pageErrors.push(error));
    let authenticated = false;
    let staffs: Array<Record<string, unknown>> = [];
    let createdStaff: Record<string, unknown> | null = null;

    await page.route('http://127.0.0.1:5173/api/**', async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (path === '/api/auth/me') {
            return route.fulfill({ json: authenticated
                ? { authenticated: true, user: { uid: 'admin', email: null } }
                : { authenticated: false } });
        }
        if (path === '/api/auth/login' && request.method() === 'POST') {
            authenticated = true;
            return route.fulfill({ json: { success: true } });
        }
        if (path === '/api/staffs' && request.method() === 'GET') return route.fulfill({ json: staffs });
        if (path === '/api/staffs' && request.method() === 'POST') {
            const body = request.postDataJSON();
            createdStaff = body;
            staffs = [...staffs, { id: 'staff-1', ...body }];
            return route.fulfill({ json: { id: 'staff-1' } });
        }
        if (path === '/api/settings/roles') return route.fulfill({ json: [{ id: 'role-1', name: '常勤', targetHours: 160, weeklyHoursTarget: 40, patterns: [] }] });
        if (path === '/api/settings/classes') return route.fulfill({ json: [{ id: 'class-1', name: 'A組', display_order: 1, auto_allocate: 1, color: '#818cf8' }] });
        if (path === '/api/settings/business-hours') return route.fulfill({ json: { startHour: 8, endHour: 19, closedDays: [0] } });
        if (path === '/api/settings/break-rules') return route.fulfill({ json: { enabled: false, rules: [] } });
        if (path === '/api/shifts') return route.fulfill({ json: [] });
        return route.fulfill({ json: [] });
    });

    await page.goto('/login');
    await page.getByLabel('パスワード').fill('test-password');
    await page.getByLabel('パスワード').press('Enter');
    await expect(page).toHaveURL(/\/admin/);
    await page.goto('/admin/staff');

    await expect(page).toHaveURL(/\/admin\/staff$/);
    await expect.poll(() => pageErrors.map(error => error.message)).toEqual([]);
    await expect(page.getByRole('heading', { name: 'スタッフ管理' })).toBeVisible();
    await page.getByRole('button', { name: 'スタッフ追加' }).focus();
    await page.keyboard.press('Enter');
    await page.getByLabel('氏名').fill('山田 太郎');
    await page.getByLabel('アクセスキー (6桁の数字)').fill('123456');
    await page.getByRole('button', { name: '保存' }).click();

    await expect(page.getByRole('table').getByText('山田 太郎')).toBeVisible();
    expect(createdStaff).toMatchObject({
        name: '山田 太郎',
        defaultWorkingHoursStart: null,
        defaultWorkingHoursEnd: null,
    });
});

test('ログインAPIのサーバー障害をパスワード違いと誤表示しない', async ({ page }) => {
    await page.route('http://127.0.0.1:5173/api/**', async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (path === '/api/auth/me') return route.fulfill({ json: { authenticated: false } });
        if (path === '/api/auth/login' && request.method() === 'POST') {
            return route.fulfill({ status: 500, json: { error: 'internal detail' } });
        }
        return route.fulfill({ json: [] });
    });

    await page.goto('/login');
    await page.getByLabel('パスワード').fill('admin');
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();

    await expect(page.getByText('ログイン処理でサーバーエラーが発生しました。サーバー設定とデータベースを確認してください。')).toBeVisible();
    await expect(page.getByText('パスワードが間違っています。')).toHaveCount(0);
});
