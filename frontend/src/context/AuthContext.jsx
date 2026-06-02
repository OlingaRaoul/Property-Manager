import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [authLoading, setAuthLoading] = useState(true);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');
        if (storedToken && storedUser) {
            setToken(storedToken);
            try {
                setUser(JSON.parse(storedUser));
            } catch(e) {
                console.error("Failed to parse stored user", e);
            }
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
        setAuthLoading(false);
    }, []);

    // Axios interceptor to catch any 401 Unauthorized errors (session expiration)
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response && error.response.status === 401) {
                    // Session expired, trigger auto logout
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setToken(null);
                    setUser(null);
                    delete axios.defaults.headers.common['Authorization'];
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            }
        );
        return () => axios.interceptors.response.eject(interceptor);
    }, []);

    const login = async (email, password) => {
        const { data } = await axios.post(`${API_URL}/auth/login`, { email, password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        return data.user;
    };

    const signup = async (name, email, password) => {
        const { data } = await axios.post(`${API_URL}/auth/signup`, { name, email, password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        return data.user;
    };

    const loginWithGoogle = async (googleCredential) => {
        const { data } = await axios.post(`${API_URL}/auth/google`, { token: googleCredential });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        return data.user;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
    };

    return (
        <AuthContext.Provider value={{ user, token, authLoading, login, signup, loginWithGoogle, logout, API_URL }}>
            {children}
        </AuthContext.Provider>
    );
};
export default AuthContext;
