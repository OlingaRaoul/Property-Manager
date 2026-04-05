import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAppState } from '../context/StateContext';
import { Bell, Shield, Search } from 'lucide-react';

const Header = () => {
    const location = useLocation();
    const { state } = useAppState();

    const getTitle = () => {
        const path = location.pathname;
        if (path === '/') return 'Dashboard';
        const page = path.substring(1);
        return page.charAt(0).toUpperCase() + page.slice(1);
    };

    return (
        <header className="top-bar">
            <h1>{getTitle()}</h1>
            <div className="top-bar-actions">
                <div className="search-box">
                    <Search size={18} />
                    <input type="text" placeholder="Search for something" />
                </div>
                <button className="btn-icon" style={{ background: '#F5F7FA', width: '45px', height: '45px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={20} color="#718EBF" />
                </button>
                <button className="btn-icon" style={{ background: '#F5F7FA', width: '45px', height: '45px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bell size={20} color="#718EBF" />
                </button>
                <div className="user-profile">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Olivia" alt="Profile" style={{ width: '45px', height: '45px', borderRadius: '50%', border: '2px solid white' }} />
                </div>
            </div>
        </header>
    );
};

export default Header;
