import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';

describe('initial public render', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('管理者の認証確認中でもトップ画面を表示する', async () => {
        let finishAuthCheck!: (response: Response) => void;
        const pendingAuthCheck = new Promise<Response>(resolve => {
            finishAuthCheck = resolve;
        });
        const fetchMock = vi.fn()
            .mockImplementationOnce(() => pendingAuthCheck)
            .mockResolvedValue(new Response(JSON.stringify({ authenticated: false }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            }));
        vi.stubGlobal('fetch', fetchMock);
        window.history.replaceState({}, '', '/');

        render(<App />);

        expect(await screen.findByText('Management Portal')).toBeVisible();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await act(async () => {
            finishAuthCheck(new Response(JSON.stringify({ authenticated: false }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            }));
        });
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    });

    it('ログイン応答のユーザー情報を使い、認証確認を繰り返さない', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const path = new URL(String(input), 'https://example.com').pathname;
            if (path === '/api/auth/me') {
                return new Response(JSON.stringify({ authenticated: false }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (path === '/api/auth/login') {
                return Response.json({
                    success: true,
                    user: { uid: 'admin', email: 'admin' },
                });
            }
            return Response.json([]);
        });
        vi.stubGlobal('fetch', fetchMock);
        window.history.replaceState({}, '', '/login');

        render(<App />);
        fireEvent.change(await screen.findByLabelText('パスワード'), { target: { value: 'admin' } });
        fireEvent.click(screen.getByRole('button', { name: /^ログイン$/ }));

        await waitFor(() => expect(window.location.pathname).toBe('/admin'));
        const authChecks = fetchMock.mock.calls.filter(([input]) => String(input) === '/api/auth/me');
        expect(authChecks).toHaveLength(1);
    });
});
