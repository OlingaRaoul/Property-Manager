import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, Lock, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const ResetPassword = () => {
    const { API_URL } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    const token = searchParams.get('token') || '';
    const email = searchParams.get('email') || '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token || !email) {
            setError('Invalid or expired password reset link. Please request a new one.');
        }
    }, [token, email]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!token || !email) {
            setError('Invalid or expired password reset link. Please request a new one.');
            return;
        }

        if (!password || !confirmPassword) {
            setError('Please fill in all fields.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const { data } = await axios.post(`${API_URL}/auth/reset-password`, {
                email,
                token,
                newPassword: password
            });
            
            setMessage(data.message || 'Your password has been reset successfully!');
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password. The link may have expired.');
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
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '0.4rem', fontFamily: 'Sora' }}>Reset Password</h2>
                    <p style={{ color: '#94A3B8', fontSize: '0.88rem', fontWeight: '500' }}>Choose a new password for your account</p>
                </div>

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

                {message && (
                    <div style={{
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                        color: '#86EFAC',
                        padding: '0.85rem 1.1rem',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        marginBottom: '1.5rem',
                        textAlign: 'center'
                    }}>
                        {message}
                        <div style={{ fontSize: '0.78rem', color: '#A7F3D0', marginTop: '0.5rem', fontWeight: '500' }}>
                            Redirecting to sign in page...
                        </div>
                    </div>
                )}

                {!message && (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* New Password Input */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>New Password (min 6 chars)</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    disabled={!token || !email}
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

                        {/* Confirm Password Input */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={!token || !email}
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

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || !token || !email}
                            style={{
                                width: '100%',
                                padding: '0.95rem',
                                borderRadius: '12px',
                                background: '#2D60FF',
                                color: 'white',
                                border: 'none',
                                fontSize: '0.95rem',
                                fontWeight: '600',
                                cursor: (loading || !token || !email) ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.6rem',
                                marginTop: '0.5rem',
                                boxShadow: '0 4px 14px rgba(45, 96, 255, 0.3)',
                                transition: 'all 0.25s'
                            }}
                            onMouseEnter={e => { if(!loading && token && email) e.target.style.background = '#1e4fd8'; }}
                            onMouseLeave={e => { if(!loading && token && email) e.target.style.background = '#2D60FF'; }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} /> Resetting Password...
                                </>
                            ) : (
                                <>
                                    Reset Password <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                )}

                {/* Back to Login Link */}
                <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.85rem' }}>
                    <Link to="/login" style={{ color: '#94A3B8', fontWeight: '700', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', transition: 'color 0.2s' }}
                        onMouseEnter={e => e.target.style.color = 'white'}
                        onMouseLeave={e => e.target.style.color = '#94A3B8'}>
                        <ArrowLeft size={16} /> Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
