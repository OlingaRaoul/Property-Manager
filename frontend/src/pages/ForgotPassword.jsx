import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, Mail, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const ForgotPassword = () => {
    const { API_URL } = useAuth();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [simulatedLink, setSimulatedLink] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }
        setLoading(true);
        setError('');
        setMessage('');
        setSimulatedLink('');
        try {
            const { data } = await axios.post(`${API_URL}/auth/forgot-password`, { email: email.trim() });
            setMessage(data.message || 'If that email address exists, a password reset link has been sent.');
            if (data.simulatedLink) {
                setSimulatedLink(data.simulatedLink);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send reset link. Please try again.');
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
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '0.4rem', fontFamily: 'Sora' }}>Forgot Password</h2>
                    <p style={{ color: '#94A3B8', fontSize: '0.88rem', fontWeight: '500' }}>Enter your email to receive a password reset link</p>
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
                    </div>
                )}

                {/* Development Mode Helper Link */}
                {simulatedLink && (
                    <div style={{
                        background: 'rgba(249, 115, 22, 0.1)',
                        border: '1px solid rgba(249, 115, 22, 0.2)',
                        color: '#FDBA74',
                        padding: '0.85rem 1.1rem',
                        borderRadius: '12px',
                        fontSize: '0.82rem',
                        fontWeight: '500',
                        marginBottom: '1.5rem',
                        textAlign: 'left'
                    }}>
                        <span style={{ fontWeight: '700', color: '#FB923C', display: 'block', marginBottom: '0.25rem' }}>⚙️ Local Simulation Mode:</span>
                        You can copy or click this link directly to reset the password:
                        <a href={simulatedLink} style={{ color: '#3B82F6', textDecoration: 'underline', display: 'block', wordBreak: 'break-all', marginTop: '0.4rem', fontWeight: '600' }}>
                            Reset Link
                        </a>
                    </div>
                )}

                {!message && (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Email Input */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                                <input
                                    type="email"
                                    placeholder="manager@domain.com"
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
                                    <Loader2 className="animate-spin" size={18} /> Sending Link...
                                </>
                            ) : (
                                <>
                                    Send Reset Link <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                )}

                {/* Back to Login Footer */}
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

export default ForgotPassword;
