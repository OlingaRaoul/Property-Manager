import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

const Login = () => {
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [timeoutMessage, setTimeoutMessage] = useState('');

    const handleGoogleCredentialResponse = async (response) => {
        setLoading(true);
        setError('');
        setTimeoutMessage('');
        try {
            await loginWithGoogle(response.credential);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Google Authentication failed.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (searchParams.get('reason') === 'timeout') {
            setTimeoutMessage('Your session has timed out due to inactivity. Please sign in again.');
        }
    }, [searchParams]);

    useEffect(() => {
        const initGoogle = () => {
            if (window.google) {
                window.google.accounts.id.initialize({
                    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "333165219985-nsqkdf621pmsa93q621v.apps.googleusercontent.com",
                    callback: handleGoogleCredentialResponse
                });
                window.google.accounts.id.renderButton(
                    document.getElementById("google-signin-btn"),
                    { theme: "filled_blue", size: "large", width: "100%", shape: "pill" }
                );
            }
        };
        
        if (window.google) {
            initGoogle();
        } else {
            const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
            if (script) {
                script.addEventListener('load', initGoogle);
            }
        }
    }, [loginWithGoogle]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) {
            setError('Please fill in all fields.');
            return;
        }
        setLoading(true);
        setError('');
        setTimeoutMessage('');
        try {
            await login(email.trim(), password.trim());
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid credentials or connection failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #2D60FF 100%)',
            padding: '1.5rem',
            fontFamily: '"Outfit", "Inter", sans-serif'
        }}>
            {/* Ambient light effects */}
            <div style={{ position: 'absolute', width: '350px', height: '350px', background: 'rgba(45, 96, 255, 0.15)', filter: 'blur(80px)', borderRadius: '50%', top: '15%', left: '15%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: '350px', height: '350px', background: 'rgba(239, 68, 68, 0.08)', filter: 'blur(90px)', borderRadius: '50%', bottom: '15%', right: '15%', pointerEvents: 'none' }} />

            <div style={{
                width: '100%',
                maxWidth: '450px',
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '24px',
                padding: '2.5rem',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                color: 'white',
                zIndex: 10,
                animation: 'fade-in 0.5s ease-out'
            }}>
                {/* Logo Header */}
                <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
                    <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #2D60FF 0%, #396AFF 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem',
                        boxShadow: '0 8px 24px rgba(45, 96, 255, 0.3)'
                    }}>
                        <Building2 size={26} color="white" />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '0.4rem', fontFamily: 'Sora' }}>Property Manager</h2>
                    <p style={{ color: '#94A3B8', fontSize: '0.88rem', fontWeight: '500' }}>Sign in to manage your premium portfolio</p>
                </div>

                {timeoutMessage && !error && (
                    <div style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        color: '#FDE047',
                        padding: '0.85rem 1.1rem',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        marginBottom: '1.5rem',
                        textAlign: 'center'
                    }}>
                        {timeoutMessage}
                    </div>
                )}

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#FCA5A5',
                        padding: '0.85rem 1.1rem',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        marginBottom: '1.5rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Email Input */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                            <input
                                type="email"
                                placeholder="e.g. manager@domain.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.85rem 1rem 0.85rem 2.6rem',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: 'white',
                                    outline: 'none',
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s',
                                    fontWeight: '500'
                                }}
                                onFocus={e => {
                                    e.target.style.border = '1px solid #2D60FF';
                                    e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                                }}
                                onBlur={e => {
                                    e.target.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                                    e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                                }}
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.85rem 1rem 0.85rem 2.6rem',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: 'white',
                                    outline: 'none',
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s',
                                    fontWeight: '500'
                                }}
                                onFocus={e => {
                                    e.target.style.border = '1px solid #2D60FF';
                                    e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                                }}
                                onBlur={e => {
                                    e.target.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                                    e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                                }}
                            />
                        </div>
                        <div style={{ textAlign: 'right', marginTop: '0.45rem' }}>
                            <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: '#2D60FF', fontWeight: '600', textDecoration: 'none', transition: 'color 0.2s' }}
                                onMouseEnter={e => e.target.style.color = '#60a5fa'}
                                onMouseLeave={e => e.target.style.color = '#2D60FF'}>
                                Forgot Password?
                            </Link>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '0.95rem',
                            borderRadius: '12px',
                            background: '#2D60FF',
                            color: 'white',
                            border: 'none',
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.6rem',
                            marginTop: '0.5rem',
                            boxShadow: '0 4px 14px rgba(45, 96, 255, 0.3)',
                            transition: 'all 0.25s'
                        }}
                        onMouseEnter={e => { if(!loading) e.target.style.background = '#1e4fd8'; }}
                        onMouseLeave={e => { if(!loading) e.target.style.background = '#2D60FF'; }}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={18} /> Signing in...
                            </>
                        ) : (
                            <>
                                Sign In <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                        <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600 }}>OR</span>
                        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                    </div>
                    <div id="google-signin-btn" style={{ display: 'flex', justifyContent: 'center' }}></div>
                </div>

                {/* Footer Switcher */}
                <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.85rem', color: '#94A3B8' }}>
                    Don't have an account?{' '}
                    <Link to="/signup" style={{ color: '#2D60FF', fontWeight: '700', textDecoration: 'none', transition: 'color 0.2s' }}
                        onMouseEnter={e => e.target.style.color = '#60a5fa'}
                        onMouseLeave={e => e.target.style.color = '#2D60FF'}>
                        Sign up here
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Login;
