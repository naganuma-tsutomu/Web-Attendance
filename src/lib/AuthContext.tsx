import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';

// Custom lightweight User interface
export interface User {
    uid: string;
    email: string | null;
}

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    login: (password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    loading: true,
    login: async () => { },
    logout: async () => { },
});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                if (data.authenticated) {
                    setCurrentUser(data.user);
                } else {
                    setCurrentUser(null);
                }
            } else {
                setCurrentUser(null);
            }
        } catch {
            setCurrentUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const login = useCallback(async (password: string) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
            if (res.status === 401) throw new Error('パスワードが間違っています。');
            if (res.status === 429) throw new Error(data.error || data.message || 'ログイン試行が多すぎます。しばらく待ってから再試行してください。');
            if (res.status >= 500) throw new Error('ログイン処理でサーバーエラーが発生しました。サーバー設定とデータベースを確認してください。');
            throw new Error(data.error || data.message || 'ログインに失敗しました。');
        }
        const data = await res.json().catch(() => ({})) as { user?: User };
        if (data.user) {
            // ログイン応答で確定した認証状態を使い、直後の /auth/me 往復を省く。
            setCurrentUser(data.user);
        } else {
            // 古いAPI応答との後方互換。
            await checkAuth();
        }
    }, [checkAuth]);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
        } catch (err) {
            console.error('Logout failed:', err);
        } finally {
            setCurrentUser(null);
        }
    }, []);

    const value = {
        currentUser,
        loading,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
