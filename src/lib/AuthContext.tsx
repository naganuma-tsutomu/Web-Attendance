import React, { createContext, useContext, useEffect, useState } from 'react';

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

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
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
    };

    const login = async (password: string) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        if (!res.ok) {
            throw new Error('パスワードが間違っています。');
        }
        await checkAuth();
    };

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setCurrentUser(null);
    };

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
