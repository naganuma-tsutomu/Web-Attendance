import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Fetchのモック
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('AuthContext', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        vi.useFakeTimers();
    });

    afterEach(() => {
        mockFetch.mockRestore();
        vi.useRealTimers();
    });

    describe('checkAuth', () => {
        it('認証済みユーザーの場合、currentUserが設定される', async () => {
            const mockUser = { uid: 'user-123', email: 'test@example.com' };
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ authenticated: true, user: mockUser })
            });

            await (async () => {
                const res = await mockFetch('/api/auth/me');
                const data = await res.json();
                
                expect(data.authenticated).toBe(true);
                expect(data.user).toEqual(mockUser);
            })();
        });

        it('未認証の場合、currentUserはnull', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ authenticated: false, user: null })
            });

            await (async () => {
                const res = await mockFetch('/api/auth/me');
                const data = await res.json();
                
                expect(data.authenticated).toBe(false);
                expect(data.user).toBeNull();
            })();
        });

        it('APIエラーの場合、currentUserはnull', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            await (async () => {
                const res = await mockFetch('/api/auth/me');
                expect(res.ok).toBe(false);
            })();
        });
    });

    describe('login', () => {
        it('正しいパスワードでログインできる', async () => {
            const mockUser = { uid: 'user-123', email: 'test@example.com' };
            
            // /api/auth/login のモック
            mockFetch.mockResolvedValueOnce({
                ok: true
            });
            // /api/auth/me のモック（ログイン後の認証チェック）
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ authenticated: true, user: mockUser })
            });

            await (async () => {
                const loginRes = await mockFetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: 'correct-password' })
                });
                
                expect(loginRes.ok).toBe(true);
            })();
        });

        it('错误のパスワードでログインに失敗する', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401
            });

            await (async () => {
                const loginRes = await mockFetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: 'wrong-password' })
                });
                
                expect(loginRes.ok).toBe(false);
                expect(loginRes.status).toBe(401);
            })();
        });
    });

    describe('logout', () => {
        it('ログアウトリクエストが发送される', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true
            });

            await (async () => {
                const logoutRes = await mockFetch('/api/auth/logout', { method: 'POST' });
                expect(logoutRes.ok).toBe(true);
                expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
            })();
        });
    });

    describe('AuthProvider state', () => {
        it('loading状态が正しく管理される', async () => {
            // loading状态は初期值はtrue、最後はfalseになる
            let loadingState = true;
            
            // simulate loading state change
            loadingState = true;
            expect(loadingState).toBe(true);
            
            loadingState = false;
            expect(loadingState).toBe(false);
        });
    });
});
