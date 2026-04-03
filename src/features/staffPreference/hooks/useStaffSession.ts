import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useStaffSession() {
    const navigate = useNavigate();
    const [staff, setStaff] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/staff-me');
                if (!res.ok) { navigate('/staff/login'); return; }
                const data = await res.json() as { authenticated: boolean; staff?: { id: string; name: string } };
                if (!data.authenticated || !data.staff) { navigate('/staff/login'); return; }
                setStaff(data.staff);
            } catch {
                navigate('/staff/login');
            }
        };
        checkSession();
    }, [navigate]);

    return { staff };
}
