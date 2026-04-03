import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useStaffSession() {
    const navigate = useNavigate();
    const [staff, setStaff] = useState<{ id: string, name: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const abortController = new AbortController();
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/staff-me', { signal: abortController.signal });
                if (!res.ok) { navigate('/staff/login'); return; }
                const data = await res.json() as { authenticated: boolean; staff?: { id: string; name: string } };
                if (!data.authenticated || !data.staff) { navigate('/staff/login'); return; }
                setStaff(data.staff);
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                navigate('/staff/login');
            } finally {
                setIsLoading(false);
            }
        };
        checkSession();
        return () => abortController.abort();
    }, [navigate]);

    return { staff, isLoading };
}
