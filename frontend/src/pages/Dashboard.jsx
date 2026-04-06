import { useAppState } from '../context/StateContext';
import { Users, Building, Wallet, AlertCircle } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, colorClass, bgClass }) => (
    <div className="stat-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
        <div className="stat-icon-bg" style={{ 
            width: '45px', 
            height: '45px', 
            borderRadius: '50%', 
            background: `var(--bd-${bgClass}-soft)`, 
            color: `var(--bd-${colorClass})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
        }}>
            <Icon size={20} />
        </div>
        <div>
            <div className="stat-label" style={{ color: '#718EBF', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.2rem', letterSpacing: '0.5px' }}>{title}</div>
            <div className="stat-value" style={{ fontSize: '1.3rem', fontWeight: '800', color: '#343C6A' }}>{value}</div>
        </div>
    </div>
);

const Dashboard = () => {
    const { state, loading } = useAppState();

    if (loading) return <div className="loader">Loading dashboard...</div>;

    // Calculate metrics
    const activeTenantsCount = state.tenants.length;
    const totalCollected = state.payments.reduce((sum, p) => sum + p.amount, 0);
    const overdueCount = state.tenants.filter(t => !t.lastPaidMonth).length; 
    const totalDue = overdueCount * 1400; // Mock calculation based on screenshot

    return (
        <div className="view-container" style={{ paddingTop: '1.25rem' }}>
            <div className="stats-grid" style={{ gap: '1.5rem', marginBottom: '2.5rem' }}>
                <StatCard 
                    title="ACTIVE TENANTS" 
                    value={activeTenantsCount} 
                    icon={Users}
                    colorClass="yellow"
                    bgClass="yellow"
                />
                <StatCard 
                    title="COLLECTED RENT" 
                    value={`${totalCollected.toLocaleString()} ${state.settings.currency}`}
                    icon={Wallet}
                    colorClass="blue"
                    bgClass="blue"
                />
                 <StatCard 
                    title="TOTAL DUE" 
                    value={`${totalDue.toLocaleString()} ${state.settings.currency}`}
                    icon={AlertCircle}
                    colorClass="pink"
                    bgClass="pink"
                />
            </div>
            
            <div className="data-table-container animate-slide-in">
                <div className="table-header" style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ color: '#343C6A', fontWeight: '700', fontSize: '1.1rem' }}>Recent Transactions</h2>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Tenant</th>
                            <th className="hide-mobile">Unit</th>
                            <th className="hide-mobile">month</th>
                            <th className="hide-mobile">date_paid</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th className="hide-mobile">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {state.payments.slice(-5).reverse().map(pay => {
                            const tenant = state.tenants.find(t => t.id === pay.tenantId);
                            const apartment = tenant ? state.apartments.find(a => String(a.id) === String(tenant.apartmentId)) : null;
                            const property = apartment ? state.properties.find(p => String(p.id) === String(apartment.propertyId)) : null;

                            return (
                                <tr key={pay.id}>
                                    <td style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderTop: 'none' }}>
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${tenant ? tenant.name : 'User'}`} style={{ width: '28px', height: '28px', borderRadius: '50%' }} alt="T" />
                                        <span style={{ fontWeight: '500' }}>{tenant ? tenant.name : 'Unknown User'}</span>
                                    </td>
                                    <td className="hide-mobile">
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: '600', color: '#343C6A' }}>{property ? property.name : 'Property'}</span>
                                            <span style={{ fontSize: '0.75rem', color: '#718EBF' }}>{apartment ? `Apt ${apartment.unitNumber}` : 'Unit'}</span>
                                        </div>
                                    </td>
                                    <td className="hide-mobile">{pay.monthPaid}</td>
                                    <td className="hide-mobile" style={{ color: '#718EBF' }}>{pay.date}</td>
                                    <td style={{ fontWeight: '700', color: '#343C6A' }}>{pay.amount.toLocaleString()} {state.settings.currency}</td>
                                    <td>
                                        <span className="status-pill paid" style={{ background: '#EDF9F0', color: '#41D433', fontSize: '0.75rem', padding: '0.4rem 1rem' }}>Paid</span>
                                    </td>
                                    <td className="hide-mobile">
                                        <div style={{ display: 'flex', gap: '0.75rem', color: '#2D60FF' }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#41D433" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2D60FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                        {state.payments.length === 0 && <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No recent transactions found.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Dashboard;
