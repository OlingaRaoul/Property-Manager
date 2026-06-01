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
        settings: { currency: 'FCFA', lang: 'en', notificationThresholdDays: 3 }
    });
    const [loading, setLoading] = useState(true);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
                    settings: { currency: 'FCFA', lang: 'en', notificationThresholdDays: 3 }
                });
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const { data } = await axios.get(`${API_URL}/data`);
                setState({
                    properties: data.properties || [],
                    apartments: data.apartments || [],
                    tenants: data.tenants || [],
                    payments: data.payments || [],
                    unit_types: data.unit_types || [],
                    contracts: data.contracts || [],
                    utilities: data.utilities || [],
                    settings: { currency: 'FCFA', lang: 'en', notificationThresholdDays: 3, ...data.settings }
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
