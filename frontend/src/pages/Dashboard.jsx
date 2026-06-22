import { useAppState } from '../context/StateContext';
import { Users, Building, Wallet, AlertCircle, Shield } from 'lucide-react';
import { getMonthsDifference } from '../utils';

const StatCard = ({ title, value, icon: Icon, colorClass, bgClass, subtext }) => (
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
            {subtext && <div style={{ fontSize: '0.7rem', color: '#718EBF', marginTop: '0.1rem', fontWeight: '500' }}>{subtext}</div>}
        </div>
    </div>
);

const Dashboard = () => {
    const { state, loading } = useAppState();

    if (loading) return <div className="loader">Loading dashboard...</div>;

    // Calculate metrics
    const activeTenantsCount = state.tenants.length;
    
    // Count only Rent payments
    const totalCollectedRent = state.payments
        .filter(p => p.type === 'Rent')
        .reduce((sum, p) => sum + p.amount, 0);

    // Count only Deposit payments
    const totalCollectedDeposits = state.payments
        .filter(p => p.type === 'Deposit')
        .reduce((sum, p) => sum + p.amount, 0);

    const totalDepositMonths = state.tenants.reduce((sum, t) => {
        return sum + (t.depositMonthsPaid || 0);
    }, 0);

    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
    const currentDay = today.getDate();

    let overdueCount = 0;
    let totalDue = 0;

    state.tenants.forEach(tenant => {
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const daysInMonth = new Date(year, month, 0).getDate();
        const actualDueDay = Math.min(tenant.dueDateDay || 1, daysInMonth);

        let overdueMonths = 0;
        if (tenant.lastPaidMonth) {
            overdueMonths = getMonthsDifference(tenant.lastPaidMonth, currentMonthStr);
            if (currentDay <= actualDueDay) {
                overdueMonths = Math.max(0, overdueMonths - 1);
            }
        } else if (currentDay > actualDueDay) {
            overdueMonths = 1;
        }

        const depositPaidMonths = tenant.depositMonthsPaid || 0;

        if (overdueMonths > depositPaidMonths) {
            overdueCount++;
            const netOverdue = overdueMonths - depositPaidMonths;
            totalDue += netOverdue * (tenant.rentAmount || 0);
        }
    });

    return (
        <div className="view-container" style={{ paddingTop: '1.25rem' }}>
            <div className="stats-grid" style={{ gap: '1.5rem', marginBottom: '2.5rem' }}>
                <StatCard 
                    title="ACTIVE TENANTS" 
                    value={activeTenantsCount} 
                    icon={Users}
                    colorClass="yellow"
                    bgClass="yellow"
                    subtext={`${state.apartments.filter(a => a.tenantId).length} Occupied Units`}
                />
                <StatCard 
                    title="COLLECTED RENT" 
                    value={`${totalCollectedRent.toLocaleString()} ${state.settings.currency}`}
                    icon={Wallet}
                    colorClass="blue"
                    bgClass="blue"
                    subtext={`${state.payments.filter(p => p.type === 'Rent').length} Rent Payments`}
                />
                <StatCard 
                    title="COLLECTED DEPOSITS" 
                    value={`${totalCollectedDeposits.toLocaleString()} ${state.settings.currency}`}
                    icon={Shield}
                    colorClass="green"
                    bgClass="green"
                    subtext={`${totalDepositMonths} Month${totalDepositMonths !== 1 ? 's' : ''} Covered`}
                />
                 <StatCard 
                    title="TOTAL DUE" 
                    value={`${totalDue.toLocaleString()} ${state.settings.currency}`}
                    icon={AlertCircle}
                    colorClass="pink"
                    bgClass="pink"
                    subtext={`Overdue: ${overdueCount} Tenant${overdueCount !== 1 ? 's' : ''}`}
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
                                        <img src={`https://robohash.org/${tenant ? encodeURIComponent(tenant.name) : 'User'}?set=set4`} style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#F5F7FA' }} alt="T" />
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
