import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const StateContext = createContext();

export const useAppState = () => useContext(StateContext);

export const StateProvider = ({ children }) => {
    const { token } = useAuth();
    const [state, setState] = useState({
        properties: [],
        apartments: [],
        tenants: [],
        payments: [],
        unit_types: [],
        contracts: [],
        utilities: [],
        settings: { currency: 'CFA', lang: 'en', notificationThresholdDays: 3 }
    });
    const [loading, setLoading] = useState(true);

    const API_URL = import.meta.env.VITE_API_URL || '/api';

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!token) {
                setState({
                    properties: [],
                    apartments: [],
                    tenants: [],
                    payments: [],
                    unit_types: [],
                    contracts: [],
                    utilities: [],
                    settings: { currency: 'CFA', lang: 'en', notificationThresholdDays: 3 }
                });
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const { data } = await axios.get(`${API_URL}/data`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                const payments = data.payments || [];
                const tenants = (data.tenants || []).map(t => {
                    const tenantPayments = payments.filter(p => String(p.tenantId) === String(t.id) && p.type === 'Deposit');
                    const calculatedMonths = tenantPayments.reduce((sum, p) => sum + (p.depositMonths || (t.rentAmount > 0 ? Math.round(p.amount / t.rentAmount) : 1)), 0);
                    return {
                        ...t,
                        depositMonthsPaid: t.depositMonthsPaid !== undefined && t.depositMonthsPaid !== 0 ? t.depositMonthsPaid : calculatedMonths
                    };
                });

                setState({
                    properties: data.properties || [],
                    apartments: data.apartments || [],
                    tenants,
                    payments,
                    unit_types: data.unit_types || [],
                    contracts: data.contracts || [],
                    utilities: data.utilities || [],
                    settings: { currency: 'CFA', lang: 'en', notificationThresholdDays: 3, ...data.settings }
                });
            } catch (error) {
                console.error("Failed to load backend state", error);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [token]);

    return (
        <StateContext.Provider value={{ state, setState, API_URL, loading }}>
            {children}
        </StateContext.Provider>
    );
};
