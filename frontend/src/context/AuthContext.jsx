import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Reusable function to clear all browser data
const clearAllBrowserData = () => {
    // 1. Clear LocalStorage
    try {
        localStorage.clear();
    } catch (e) {
        console.error("Failed to clear localStorage:", e);
    }

    // 2. Clear SessionStorage
    try {
        sessionStorage.clear();
    } catch (e) {
        console.error("Failed to clear sessionStorage:", e);
    }

    // 3. Clear all Cookies
    try {
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i];
            const eqPos = cookie.indexOf("=");
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            if (name) {
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
                
                // Clear on subdomains if applicable
                const hostParts = window.location.hostname.split('.');
                if (hostParts.length > 2) {
                    const baseDomain = `.${hostParts.slice(-2).join('.')}`;
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${baseDomain}`;
                }
            }
        }
    } catch (e) {
        console.error("Failed to clear cookies:", e);
    }

    // 4. Clear Cache Storage
    if ('caches' in window) {
        try {
            caches.keys().then((names) => {
                names.forEach((name) => {
                    caches.delete(name);
                });
            });
        } catch (e) {
            console.error("Failed to clear Cache storage:", e);
        }
    }
};

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => {
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            // Initialize lastActive if it is not set
            if (!localStorage.getItem('lastActive')) {
                localStorage.setItem('lastActive', Date.now().toString());
            }
        }
        return storedToken;
    });
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                return JSON.parse(storedUser);
            } catch (e) {
                console.error("Failed to parse stored user", e);
                return null;
            }
        }
        return null;
    });
    const [authLoading, setAuthLoading] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL || '/api';

    // Axios interceptor to catch any 401 Unauthorized errors (session expiration)
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response && error.response.status === 401) {
                    // Session expired, trigger auto logout and clear all browser data
                    clearAllBrowserData();
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

    // Session Timeout Logic (30 minutes of inactivity)
    useEffect(() => {
        if (!token) return;

        // Initialize last active time if it's not set
        if (!localStorage.getItem('lastActive')) {
            localStorage.setItem('lastActive', Date.now().toString());
        }

        const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
        const CHECK_INTERVAL = 10000; // Check every 10 seconds
        const THROTTLE_MS = 5000; // Throttle storage writes to every 5 seconds
        
        let lastLoggedWrite = Date.now();

        const handleActivity = () => {
            const now = Date.now();
            if (now - lastLoggedWrite > THROTTLE_MS) {
                localStorage.setItem('lastActive', now.toString());
                lastLoggedWrite = now;
            }
        };

        const handleTimeoutLogout = () => {
            clearAllBrowserData();
            setToken(null);
            setUser(null);
            delete axios.defaults.headers.common['Authorization'];
            window.location.href = '/login?reason=timeout';
        };

        // Attach event listeners for user interaction
        const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        events.forEach(event => {
            window.addEventListener(event, handleActivity);
        });

        // Periodic check for timeout (handles background tabs, asleep laptops, or general inactivity)
        const intervalId = setInterval(() => {
            const lastActiveStr = localStorage.getItem('lastActive');
            if (lastActiveStr) {
                const lastActive = parseInt(lastActiveStr, 10);
                if (Date.now() - lastActive > TIMEOUT_MS) {
                    handleTimeoutLogout();
                }
            } else {
                // If lastActive was cleared/missing while token exists, log out as security measure
                handleTimeoutLogout();
            }
        }, CHECK_INTERVAL);

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
            clearInterval(intervalId);
        };
    }, [token]);

    const login = async (email, password) => {
        const { data } = await axios.post(`${API_URL}/auth/login`, { email, password });
        // Clear old browser data first (security baseline)
        clearAllBrowserData();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('lastActive', Date.now().toString());
        setToken(data.token);
        setUser(data.user);
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        return data.user;
    };

    const signup = async (name, email, password) => {
        const { data } = await axios.post(`${API_URL}/auth/signup`, { name, email, password });
        clearAllBrowserData();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('lastActive', Date.now().toString());
        setToken(data.token);
        setUser(data.user);
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        return data.user;
    };

    const loginWithGoogle = async (googleCredential) => {
        const { data } = await axios.post(`${API_URL}/auth/google`, { token: googleCredential });
        clearAllBrowserData();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('lastActive', Date.now().toString());
        setToken(data.token);
        setUser(data.user);
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        return data.user;
    };

    const logout = () => {
        clearAllBrowserData();
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
        // Do a full page reload redirect to ensure all states in all components are completely reset
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, token, authLoading, login, signup, loginWithGoogle, logout, API_URL }}>
            {children}
        </AuthContext.Provider>
    );
};
export default AuthContext;

