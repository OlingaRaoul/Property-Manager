import { useState, useEffect } from 'react';
import { useAppState } from '../context/StateContext';
import { useNavigate } from 'react-router-dom';
import { Users, Building, Wallet, AlertCircle, Shield, FileText, ClipboardList, PlusCircle, DollarSign, CheckCircle2, X, Printer } from 'lucide-react';
import { getMonthsDifference, formatMonth } from '../utils';

const StatCard = ({ title, value, icon: Icon, colorClass, bgClass, subtext }) => {
    if (!Icon) return null;
    return (
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
};

const LineChart = ({ data, W, H, paddingLeft, paddingRight, paddingTop, paddingBottom, cleanMax, currency }) => {
    const chartWidth = W - paddingLeft - paddingRight;
    const chartHeight = H - paddingTop - paddingBottom;
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const points = data.map((d, i) => {
        const x = data.length > 1
            ? paddingLeft + (i / (data.length - 1)) * chartWidth
            : paddingLeft + chartWidth / 2;
        const y = H - paddingBottom - (d.total / (cleanMax || 1)) * chartHeight;
        return { x, y, ...d };
    });

    let pathD = '';
    let areaD = '';
    if (points.length > 0) {
        pathD = `M ${points[0].x} ${points[0].y}`;
        points.forEach((p, i) => {
            if (i > 0) pathD += ` L ${p.x} ${p.y}`;
        });
        areaD = `${pathD} L ${points[points.length - 1].x} ${H - paddingBottom} L ${points[0].x} ${H - paddingBottom} Z`;
    }

    const yGridValues = [0, cleanMax * 0.25, cleanMax * 0.5, cleanMax * 0.75, cleanMax];

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ overflow: 'visible' }}>
                <defs>
                    <linearGradient id="lineAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2D60FF" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#2D60FF" stopOpacity="0.0" />
                    </linearGradient>
                </defs>

                {yGridValues.map((val, idx) => {
                    const y = H - paddingBottom - (val / (cleanMax || 1)) * chartHeight;
                    return (
                        <g key={idx}>
                            <line x1={paddingLeft} y1={y} x2={W - paddingRight} y2={y} stroke="#F3F4F6" strokeWidth="1" strokeDasharray="4 4" />
                            <text x={paddingLeft - 10} y={y + 4} fill="#718EBF" fontSize="10px" fontWeight="600" textAnchor="end" fontFamily="Outfit">{val.toLocaleString()}</text>
                        </g>
                    );
                })}

                {points.map((p, idx) => {
                    const shouldShowLabel = points.length <= 12 || idx % Math.ceil(points.length / 12) === 0;
                    return shouldShowLabel && (
                        <text key={idx} x={p.x} y={H - paddingBottom + 18} fill="#718EBF" fontSize="9px" fontWeight="600" textAnchor="middle" fontFamily="Outfit">{p.label}</text>
                    );
                })}

                {areaD && <path d={areaD} fill="url(#lineAreaGradient)" />}
                {pathD && <path d={pathD} fill="none" stroke="#2D60FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

                {points.map((p, idx) => (
                    <g key={idx}>
                        <rect
                            x={p.x - 15}
                            y={paddingTop}
                            width="30"
                            height={chartHeight + 10}
                            fill="transparent"
                            cursor="pointer"
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        />
                        {hoveredIndex === idx && (
                            <>
                                <line x1={p.x} y1={paddingTop} x2={p.x} y2={H - paddingBottom} stroke="#2D60FF" strokeWidth="1.5" strokeDasharray="2 2" />
                                <circle cx={p.x} cy={p.y} r="6" fill="#2D60FF" stroke="#FFFFFF" strokeWidth="2" />
                                <circle cx={p.x} cy={p.y} r="10" fill="#2D60FF" fillOpacity="0.15" />
                            </>
                        )}
                        <circle cx={p.x} cy={p.y} r="3.5" fill="#FFFFFF" stroke="#2D60FF" strokeWidth="2.5" />
                    </g>
                ))}
            </svg>

            {hoveredIndex !== null && points[hoveredIndex] && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: `${Math.min(W - 160, Math.max(paddingLeft + 10, points[hoveredIndex].x - 75))}px`,
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid #E6EFF5',
                    borderRadius: '12px',
                    padding: '0.6rem 0.8rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    zIndex: 10,
                    width: '150px',
                    pointerEvents: 'none',
                    fontFamily: 'Outfit, sans-serif'
                }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#343C6A', marginBottom: '4px' }}>{points[hoveredIndex].label}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#718EBF' }}>
                        <span>Rent:</span>
                        <span style={{ fontWeight: '700', color: '#2D60FF' }}>{points[hoveredIndex].rent.toLocaleString()} {currency}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#718EBF' }}>
                        <span>Deposit:</span>
                        <span style={{ fontWeight: '700', color: '#10B981' }}>{points[hoveredIndex].deposit.toLocaleString()} {currency}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#343C6A', borderTop: '1px solid #F3F4F6', paddingTop: '4px', marginTop: '4px', fontWeight: '800' }}>
                        <span>Total:</span>
                        <span>{points[hoveredIndex].total.toLocaleString()} {currency}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const BarChart = ({ data, W, H, paddingLeft, paddingRight, paddingTop, paddingBottom, cleanMax, currency }) => {
    const chartWidth = W - paddingLeft - paddingRight;
    const chartHeight = H - paddingTop - paddingBottom;
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const yGridValues = [0, cleanMax * 0.25, cleanMax * 0.5, cleanMax * 0.75, cleanMax];
    const groupWidth = chartWidth / data.length;
    const barWidth = Math.max(3, Math.min(18, groupWidth * 0.25));
    const gap = Math.max(1, barWidth * 0.25);

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ overflow: 'visible' }}>
                {yGridValues.map((val, idx) => {
                    const y = H - paddingBottom - (val / (cleanMax || 1)) * chartHeight;
                    return (
                        <g key={idx}>
                            <line x1={paddingLeft} y1={y} x2={W - paddingRight} y2={y} stroke="#F3F4F6" strokeWidth="1" strokeDasharray="4 4" />
                            <text x={paddingLeft - 10} y={y + 4} fill="#718EBF" fontSize="10px" fontWeight="600" textAnchor="end" fontFamily="Outfit">{val.toLocaleString()}</text>
                        </g>
                    );
                })}

                {data.map((d, idx) => {
                    const cx = paddingLeft + (idx + 0.5) * groupWidth;
                    const shouldShowLabel = data.length <= 12 || idx % Math.ceil(data.length / 12) === 0;
                    return shouldShowLabel && (
                        <text key={idx} x={cx} y={H - paddingBottom + 18} fill="#718EBF" fontSize="9px" fontWeight="600" textAnchor="middle" fontFamily="Outfit">{d.label}</text>
                    );
                })}

                {data.map((d, idx) => {
                    const cx = paddingLeft + (idx + 0.5) * groupWidth;
                    const rentH = (d.rent / (cleanMax || 1)) * chartHeight;
                    const rentX = cx - barWidth - gap;
                    const rentY = H - paddingBottom - rentH;

                    const depH = (d.deposit / (cleanMax || 1)) * chartHeight;
                    const depX = cx + gap;
                    const depY = H - paddingBottom - depH;

                    return (
                        <g key={idx}>
                            {rentH > 0 && <rect x={rentX} y={rentY} width={barWidth} height={rentH} fill="#2D60FF" rx="3" ry="3" />}
                            {depH > 0 && <rect x={depX} y={depY} width={barWidth} height={depH} fill="#10B981" rx="3" ry="3" />}
                            <rect
                                x={cx - groupWidth / 2}
                                y={paddingTop}
                                width={groupWidth}
                                height={chartHeight + 10}
                                fill="transparent"
                                cursor="pointer"
                                onMouseEnter={() => setHoveredIndex(idx)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            />
                            {hoveredIndex === idx && (
                                <rect
                                    x={cx - groupWidth / 2 + 2}
                                    y={paddingTop - 5}
                                    width={groupWidth - 4}
                                    height={chartHeight + 15}
                                    fill="#2D60FF"
                                    fillOpacity="0.03"
                                    stroke="#2D60FF"
                                    strokeOpacity="0.1"
                                    strokeWidth="1"
                                    strokeDasharray="2 2"
                                    rx="4"
                                />
                            )}
                        </g>
                    );
                })}
            </svg>

            {hoveredIndex !== null && data[hoveredIndex] && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: `${Math.min(W - 160, Math.max(paddingLeft + 10, paddingLeft + (hoveredIndex + 0.5) * groupWidth - 75))}px`,
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid #E6EFF5',
                    borderRadius: '12px',
                    padding: '0.6rem 0.8rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    zIndex: 10,
                    width: '150px',
                    pointerEvents: 'none',
                    fontFamily: 'Outfit, sans-serif'
                }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#343C6A', marginBottom: '4px' }}>{data[hoveredIndex].label}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#718EBF' }}>
                        <span>Rent:</span>
                        <span style={{ fontWeight: '700', color: '#2D60FF' }}>{data[hoveredIndex].rent.toLocaleString()} {currency}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#718EBF' }}>
                        <span>Deposit:</span>
                        <span style={{ fontWeight: '700', color: '#10B981' }}>{data[hoveredIndex].deposit.toLocaleString()} {currency}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#343C6A', borderTop: '1px solid #F3F4F6', paddingTop: '4px', marginTop: '4px', fontWeight: '800' }}>
                        <span>Total:</span>
                        <span>{data[hoveredIndex].total.toLocaleString()} {currency}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const ForecastChart = ({ data, W, H, paddingLeft, paddingRight, paddingTop, paddingBottom, currency }) => {
    const chartWidth = W - paddingLeft - paddingRight;
    const chartHeight = H - paddingTop - paddingBottom;
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const maxVal = Math.max(...data.map(d => d.total), 1000);
    const getCleanMax = (val) => {
        if (val <= 0) return 1000;
        const digits = Math.floor(Math.log10(val));
        const scale = Math.pow(10, Math.max(1, digits));
        return Math.ceil(val / scale) * scale;
    };
    const cleanMax = getCleanMax(maxVal);

    const points = data.map((d, i) => {
        const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
        const y = H - paddingBottom - (d.total / (cleanMax || 1)) * chartHeight;
        return { x, y, ...d };
    });

    let actualPathD = '';
    const actualPoints = points.filter(p => !p.isForecast);
    if (actualPoints.length > 0) {
        actualPathD = `M ${actualPoints[0].x} ${actualPoints[0].y}`;
        actualPoints.forEach((p, i) => {
            if (i > 0) actualPathD += ` L ${p.x} ${p.y}`;
        });
    }

    let forecastPathD = '';
    const lastActual = points[2];
    const forecastPoints = points.slice(2);
    if (forecastPoints.length > 0) {
        forecastPathD = `M ${lastActual.x} ${lastActual.y}`;
        forecastPoints.forEach((p) => {
            forecastPathD += ` L ${p.x} ${p.y}`;
        });
    }

    const yGridValues = [0, cleanMax * 0.25, cleanMax * 0.5, cleanMax * 0.75, cleanMax];

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ overflow: 'visible' }}>
                <defs>
                    <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2D60FF" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#2D60FF" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFBB38" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#FFBB38" stopOpacity="0.0" />
                    </linearGradient>
                </defs>

                {yGridValues.map((val, idx) => {
                    const y = H - paddingBottom - (val / (cleanMax || 1)) * chartHeight;
                    return (
                        <g key={idx}>
                            <line x1={paddingLeft} y1={y} x2={W - paddingRight} y2={y} stroke="#F3F4F6" strokeWidth="1" strokeDasharray="4 4" />
                            <text x={paddingLeft - 10} y={y + 4} fill="#718EBF" fontSize="10px" fontWeight="600" textAnchor="end" fontFamily="Outfit">{val.toLocaleString()}</text>
                        </g>
                    );
                })}

                {points.map((p, idx) => (
                    <text key={idx} x={p.x} y={H - paddingBottom + 18} fill="#718EBF" fontSize="9px" fontWeight="600" textAnchor="middle" fontFamily="Outfit">{p.label}</text>
                ))}

                {actualPathD && (
                    <path 
                        d={`${actualPathD} L ${points[2].x} ${H - paddingBottom} L ${points[0].x} ${H - paddingBottom} Z`} 
                        fill="url(#actualGradient)" 
                    />
                )}
                {forecastPathD && (
                    <path 
                        d={`${forecastPathD} L ${points[5].x} ${H - paddingBottom} L ${points[2].x} ${H - paddingBottom} Z`} 
                        fill="url(#forecastGradient)" 
                    />
                )}

                {actualPathD && <path d={actualPathD} fill="none" stroke="#2D60FF" strokeWidth="3" strokeLinecap="round" />}
                {forecastPathD && <path d={forecastPathD} fill="none" stroke="#FFBB38" strokeWidth="3" strokeDasharray="6 4" strokeLinecap="round" />}

                {points.map((p, idx) => (
                    <g key={idx}>
                        <rect
                            x={p.x - 20}
                            y={paddingTop}
                            width="40"
                            height={chartHeight + 10}
                            fill="transparent"
                            cursor="pointer"
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        />
                        {hoveredIndex === idx && (
                            <>
                                <line x1={p.x} y1={paddingTop} x2={p.x} y2={H - paddingBottom} stroke={p.isForecast ? '#FFBB38' : '#2D60FF'} strokeWidth="1.5" strokeDasharray="2 2" />
                                <circle cx={p.x} cy={p.y} r="6" fill={p.isForecast ? '#FFBB38' : '#2D60FF'} stroke="#FFFFFF" strokeWidth="2" />
                                <circle cx={p.x} cy={p.y} r="10" fill={p.isForecast ? '#FFBB38' : '#2D60FF'} fillOpacity="0.15" />
                            </>
                        )}
                        <circle cx={p.x} cy={p.y} r="3.5" fill="#FFFFFF" stroke={p.isForecast ? '#FFBB38' : '#2D60FF'} strokeWidth="2.5" />
                    </g>
                ))}
            </svg>

            {hoveredIndex !== null && points[hoveredIndex] && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: `${Math.min(W - 160, Math.max(paddingLeft + 10, points[hoveredIndex].x - 75))}px`,
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid #E6EFF5',
                    borderRadius: '12px',
                    padding: '0.6rem 0.8rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    zIndex: 10,
                    width: '160px',
                    pointerEvents: 'none',
                    fontFamily: 'Outfit, sans-serif'
                }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#343C6A', marginBottom: '4px' }}>
                        {points[hoveredIndex].label}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#718EBF' }}>
                        <span>Type:</span>
                        <span style={{ fontWeight: '700', color: points[hoveredIndex].isForecast ? '#FFBB38' : '#2D60FF' }}>
                            {points[hoveredIndex].isForecast ? 'Projected' : 'Actual'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#343C6A', borderTop: '1px solid #F3F4F6', paddingTop: '4px', marginTop: '4px', fontWeight: '800' }}>
                        <span>Inflow:</span>
                        <span>{points[hoveredIndex].total.toLocaleString()} {currency}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const getNextMonth = (monthStr) => {
    if (!monthStr || !monthStr.includes('-')) {
        const today = new Date();
        return today.toISOString().slice(0, 7);
    }
    const [y, m] = monthStr.split('-').map(Number);
    let nextY = y;
    let nextM = m + 1;
    if (nextM > 12) {
        nextM = 1;
        nextY += 1;
    }
    return `${nextY}-${String(nextM).padStart(2, '0')}`;
};

const getDueDateForMonth = (dueDateDay, monthStr) => {
    if (!monthStr || !monthStr.includes('-')) return '';
    const [y, m] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const cappedDay = Math.min(dueDateDay || 1, daysInMonth);
    return `${monthStr}-${String(cappedDay).padStart(2, '0')}`;
};

const Dashboard = () => {
    const { state, loading } = useAppState();
    const navigate = useNavigate();

    const todayStr = new Date().toISOString().split('T')[0];
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const todayMonthStr = new Date().toISOString().slice(0, 7); // e.g. "2026-06"
    const [selectedCollectionMonth, setSelectedCollectionMonth] = useState(todayMonthStr);

    const [printStartDate, setPrintStartDate] = useState(sixMonthsAgoStr);
    const [printEndDate, setPrintEndDate] = useState(todayStr);
    const [selectedReportPropertyId, setSelectedReportPropertyId] = useState('');
    const [showUnpaidModal, setShowUnpaidModal] = useState(false);

    // Generate collection months list (last 12 months)
    const collectionMonthsList = [];
    const todayValForMonths = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(todayValForMonths.getFullYear(), todayValForMonths.getMonth() - i, 1);
        const val = d.toISOString().slice(0, 7); // YYYY-MM
        const label = d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
        collectionMonthsList.push({ val, label });
    }

    const [selYear, selMonth] = selectedCollectionMonth.split('-');
    const tempDate = new Date(parseInt(selYear), parseInt(selMonth) - 1, 1);
    const monthLabelShort = tempDate.toLocaleDateString('default', { month: 'long' });
    const selY = selYear;

    useEffect(() => {
        if (state.properties.length > 0 && !selectedReportPropertyId) {
            setSelectedReportPropertyId(state.properties[0].id);
        }
    }, [state.properties, selectedReportPropertyId]);

    const printTenantStatement = (tenantObj) => {
        const lang = state.settings.lang || 'en';
        const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
        const apartment = state.apartments.find(a => String(a.id) === String(tenantObj.apartmentId));
        const property  = apartment ? state.properties.find(p => String(p.id) === String(apartment.propertyId)) : null;
        
        const propName = property ? property.name : (lang === 'fr' ? 'Non assigné' : 'Unassigned');
        const unitNumber = apartment ? apartment.unitNumber : (lang === 'fr' ? 'Aucune' : 'None');
        const currency = state.settings.currency || '$';
        const signature = state.settings.signature;

        // 1. Date of Last Payment
        const tenantPayments = state.payments.filter(p => String(p.tenantId) === String(tenantObj.id));
        const sortedPayments = [...tenantPayments].sort((a, b) => b.date.localeCompare(a.date));
        const lastPaymentDate = sortedPayments.length > 0 ? sortedPayments[0].date : (lang === 'fr' ? 'Aucun paiement' : 'No payments');

        // 2. Agreed contract/due date
        const tenantContract = state.contracts ? state.contracts.find(c => String(c.tenantId) === String(tenantObj.id) && c.active !== false) : null;
        
        // Unpaid months calculation
        const startMonth = tenantObj.lastPaidMonth 
            ? getNextMonth(tenantObj.lastPaidMonth) 
            : (tenantContract ? tenantContract.startDate.slice(0, 7) : currentMonthStr);
        
        const unpaidMonthsList = [];
        let tempMonth = startMonth;
        while (tempMonth <= currentMonthStr) {
            unpaidMonthsList.push(tempMonth);
            tempMonth = getNextMonth(tempMonth);
        }

        const overdueMonths = unpaidMonthsList.length;

        // 3. Deposit logic
        const depositMonthsPaid = tenantObj.depositMonthsPaid || 0;
        const depositMonthsRequired = tenantObj.depositMonths || 0;
        const rentAmount = tenantObj.rentAmount || 0;
        const depositHeldAmount = depositMonthsPaid * rentAmount;

        const depositUsed = 0;
        const netOverdueMonths = overdueMonths;
        const rentOutstandingAmount = overdueMonths * rentAmount;
        const depositMonthsLeft = depositMonthsPaid;
        const isUsingDeposit = false;

        // Generate rows for the periods
        const breakdownRows = unpaidMonthsList.map((m, idx) => {
            const dueDate = getDueDateForMonth(tenantObj.dueDateDay, m);
            // Check if this month is covered by deposit
            const isCovered = idx < depositUsed;
            const amountText = isCovered 
                ? (lang === 'fr' ? 'Couvert par dépôt' : 'Covered by Deposit') 
                : `${rentAmount.toLocaleString()} ${currency}`;
            const amountStyle = isCovered ? 'color: #166534; font-style: italic; font-weight: 500;' : 'color: #ef4444; font-weight: 700;';

            return `
                <tr>
                    <td>${formatMonth(m, lang)}</td>
                    <td>${dueDate || '—'}</td>
                    <td style="${amountStyle}">${amountText}</td>
                </tr>
            `;
        }).join('');

        const statementDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Statement - ${tenantObj.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #1a1a2e; background: white; }
    .page { padding: 0.8cm; max-width: 14cm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start;
              border-bottom: 2px solid #2D60FF; padding-bottom: 10px; margin-bottom: 12px; }
    .title { font-size: 20px; font-weight: 900; color: #2D60FF; letter-spacing: -0.5px; }
    .subtitle { font-size: 10px; color: #718EBF; margin-top: 2px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.5px; }
    .receipt-no-label { font-size: 10px; color: #718EBF; font-weight: 600; text-align: right; }
    .receipt-no { font-size: 13px; font-weight: 800; text-align: right; }
    .date { font-size: 9px; color: #718EBF; text-align: right; margin-top: 2px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    .info-box { background: #F5F7FA; border-radius: 10px; padding: 8px 12px; }
    .info-label { font-size: 8px; color: #718EBF; font-weight: 700; text-transform: uppercase;
                  letter-spacing: 0.5px; margin-bottom: 3px; }
    .info-name { font-size: 13px; font-weight: 800; }
    .info-sub { font-size: 10px; color: #718EBF; margin-top: 2px; }
    .info-unit { font-size: 11px; font-weight: 700; color: #2D60FF; margin-top: 2px; }
    
    .summary-card { background: #FFFBEB; border: 1px solid #FEF3C7; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; }
    .summary-title { font-size: 10px; color: #B45309; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
    .summary-grid { display: flex; justify-content: space-between; }
    .summary-val { font-size: 15px; font-weight: 800; color: #78350F; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
    thead tr { background: #2D60FF; color: white; }
    th { padding: 6px 8px; text-align: left; font-weight: 700; }
    th:last-child { text-align: right; }
    td { padding: 8px; border-bottom: 1px solid #E6EFF5; }
    td:last-child { text-align: right; }
    
    .deposit-section { margin-top: 10px; margin-bottom: 10px; background: #F5F7FA; border-radius: 12px; padding: 10px 12px; border: 1px solid #E6EFF5; }
    .deposit-title { font-size: 10px; color: #718EBF; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; text-align: left; }
    .deposit-grid { display: flex; justify-content: space-between; gap: 15px; text-align: left; }
    .deposit-val { font-size: 11px; font-weight: 800; color: #343C6A; display: block; margin-top: 1px; }

    .footer { border-top: 1px dashed #E6EFF5; padding-top: 8px;
              display: flex; justify-content: space-between; align-items: center; }
    .footer-note { font-size: 10px; color: #B1B1B1; }
    .footer-status { font-size: 10px; color: #EF4444; font-weight: 700; text-transform: uppercase; }
    @media print { @page { margin: 0.6cm; size: A5 portrait; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="title">STATEMENT OF ARREARS</div>
        <div class="subtitle">Outstanding Rent & Coverage</div>
      </div>
      <div>
        <div class="receipt-no-label">Statement Date</div>
        <div class="receipt-no" style="font-size: 11px;">${statementDate}</div>
      </div>
    </div>

    <div class="grid2">
      <div class="info-box">
        <div class="info-label">Tenant Details</div>
        <div class="info-name">${tenantObj.name}</div>
        ${tenantObj.phone ? `<div class="info-sub">&#128222; ${tenantObj.phone}</div>` : ''}
        ${tenantObj.email ? `<div class="info-sub">&#9993; ${tenantObj.email}</div>` : ''}
      </div>
      <div class="info-box">
        <div class="info-label">Property / Unit</div>
        <div class="info-name">${propName}</div>
        <div class="info-unit">Unit: ${unitNumber}</div>
      </div>
    </div>

    <div class="summary-card">
      <div class="summary-title">Arrears Overview</div>
      <div class="summary-grid">
        <div>
          <span style="font-size: 8px; color: #B45309; text-transform: uppercase; display: block; font-weight: 600;">Months Overdue</span>
          <span class="summary-val">${overdueMonths} Month${overdueMonths !== 1 ? 's' : ''}</span>
        </div>
        <div>
          <span style="font-size: 8px; color: #B45309; text-transform: uppercase; display: block; font-weight: 600;">Last Payment Date</span>
          <span class="summary-val" style="color: #343C6A; font-size: 13px;">${lastPaymentDate}</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 8px; color: #B45309; text-transform: uppercase; display: block; font-weight: 600;">Rent Outstanding</span>
          <span class="summary-val" style="color: #EF4444;">${rentOutstandingAmount.toLocaleString()} ${currency}</span>
        </div>
      </div>
    </div>

    <div style="font-size: 10px; color: #718EBF; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; text-align: left;">Breakdown of Due Periods</div>
    <table>
      <thead>
        <tr>
          <th>Due Period</th>
          <th>Due Date</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${breakdownRows}
      </tbody>
    </table>


    <div class="signatures-row" style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 25px; margin-bottom: 15px;">
      ${signature ? `
        <div class="signature-container" style="text-align: left;">
          <img src="${signature}" style="max-height: 40px; max-width: 150px; display: block; margin-bottom: 2px;" alt="Owner Signature" />
          <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px solid #E6EFF5; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Property Owner Signature</div>
        </div>
      ` : `
        <div class="signature-container" style="text-align: left; padding-top: 25px;">
          <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px dashed #B1B1B1; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Property Owner Signature</div>
        </div>
      `}
      <div class="signature-container" style="text-align: right; padding-top: 25px;">
        <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px dashed #B1B1B1; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Tenant Signature</div>
      </div>
    </div>

    <div class="footer" style="margin-top: 15px;">
      <div class="footer-note">Generated automatically by Property Manager Suite</div>
      <div class="footer-status" style="color: ${rentOutstandingAmount > 0 ? '#EF4444' : '#10B981'};">
        ${rentOutstandingAmount > 0 ? '⚠️ PAYMENT REQUIRED' : '✓ COVERED BY DEPOSIT'}
      </div>
    </div>
  </div>
  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }</script>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=600,height=800');
        if (win) { win.document.write(html); win.document.close(); }
    };

    const printAllArrears = () => {
        if (unpaidTenantsList.length === 0) {
            alert("No active tenants have unpaid monthly invoices.");
            return;
        }

        const currency = state.settings.currency || '$';
        const signature = state.settings.signature;
        const lang = state.settings.lang || 'en';

        let totalOutstanding = 0;
        let totalTenantsCount = unpaidTenantsList.length;

        const tableRowsHtml = unpaidTenantsList.map(item => {
            const overdueMonths = item.unpaidMonths.length;
            const depositMonthsPaid = item.tenant.depositMonthsPaid || 0;
            const depositUsed = 0;
            const netOverdueMonths = overdueMonths;
            const rentOutstandingAmount = overdueMonths * (item.tenant.rentAmount || 0);

            totalOutstanding += rentOutstandingAmount;

            // Formatted unpaid months string
            const unpaidMonthsFormatted = item.unpaidMonths.map((m, idx) => {
                const isCovered = false;
                const monthName = formatMonth(m, lang);
                return isCovered 
                    ? `<span style="background: #F0FDF4; color: #166534; border: 1px solid #DCFCE7; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; margin-right: 4px; display: inline-block;">${monthName} (Deposit)</span>`
                    : `<span style="background: #FEF2F2; color: #991B1B; border: 1px solid #FEE2E2; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; margin-right: 4px; display: inline-block;">${monthName}</span>`;
            }).join(' ');

            return `
                <tr>
                    <td style="font-weight: bold;">${item.tenant.name}</td>
                    <td>${item.propertyName} - ${item.roomNumber}</td>
                    <td>${item.lastPaymentDate}</td>
                    <td>${unpaidMonthsFormatted}</td>
                    <td style="text-align: right; font-weight: bold; color: ${rentOutstandingAmount > 0 ? '#ef4444' : '#166534'};">
                        ${rentOutstandingAmount.toLocaleString()} ${currency}
                    </td>
                </tr>
            `;
        }).join('');

        const statementDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Arrears Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #1a1a2e; background: white; line-height: 1.4; }
    .page { padding: 1cm; max-width: 21cm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start;
              border-bottom: 3px solid #2D60FF; padding-bottom: 12px; margin-bottom: 18px; }
    .title { font-size: 22px; font-weight: 900; color: #2D60FF; letter-spacing: -0.5px; }
    .subtitle { font-size: 10px; color: #718EBF; margin-top: 2px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.5px; }
    .report-date { font-size: 10px; color: #718EBF; font-weight: 600; text-align: right; }
    .date-val { font-size: 12px; font-weight: 800; color: #343C6A; }
    
    .summary-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .summary-card { background: #FFFBEB; border: 1px solid #FEF3C7; border-radius: 10px; padding: 10px 14px; }
    .summary-title { font-size: 9px; color: #B45309; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
    .summary-val { font-size: 16px; font-weight: 800; color: #78350F; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11px; }
    thead tr { background: #2D60FF; color: white; }
    th { padding: 8px 10px; text-align: left; font-weight: 700; font-size: 9px; text-transform: uppercase; }
    th:last-child { text-align: right; }
    td { padding: 10px 8px; border-bottom: 1px solid #E6EFF5; }
    td:last-child { text-align: right; }
    
    .signatures-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; margin-bottom: 15px; }
    .signature-container { width: 180px; }
    
    .footer { border-top: 1px dashed #E6EFF5; padding-top: 8px; font-size: 9px; color: #B1B1B1; text-align: center; }
    @media print { @page { margin: 0.8cm; size: A4 portrait; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="title">OUTSTANDING RENT & COVERAGE REPORT</div>
        <div class="subtitle">Arrears & Deposit Summary</div>
      </div>
      <div class="report-date">
        <div>Report Date</div>
        <div class="date-val">${statementDate}</div>
      </div>
    </div>

    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-title">Total Active Arrears Accounts</div>
        <div class="summary-val">${totalTenantsCount} Tenant${totalTenantsCount !== 1 ? 's' : ''}</div>
      </div>
      <div class="summary-card" style="background: #FEE2E2; border-color: #FEE2E2;">
        <div class="summary-title" style="color: #991B1B;">Total Cash Rent Outstanding</div>
        <div class="summary-val" style="color: #991B1B;">${totalOutstanding.toLocaleString()} ${currency}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Tenant Name</th>
          <th>Property & Unit</th>
          <th>Last Payment</th>
          <th>Unpaid Periods & Coverage</th>
          <th style="text-align: right;">Amount Due</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    <div class="signatures-row">
      ${signature ? `
        <div class="signature-container" style="text-align: left;">
          <img src="${signature}" style="max-height: 40px; max-width: 150px; display: block; margin-bottom: 2px;" alt="Owner Signature" />
          <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px solid #E6EFF5; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Property Owner Signature</div>
        </div>
      ` : `
        <div class="signature-container" style="text-align: left; padding-top: 25px;">
          <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px dashed #B1B1B1; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Property Owner Signature</div>
        </div>
      `}
      <div class="signature-container" style="text-align: right; padding-top: 25px;">
        <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px dashed #B1B1B1; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Verifier Signature</div>
      </div>
    </div>

    <div class="footer">
      Generated automatically by Property Manager Suite
    </div>
  </div>
  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }</script>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=800,height=1000');
        if (win) { win.document.write(html); win.document.close(); }
        else { alert('Please allow pop-ups for this site to print statements.'); }
    };

    // Helper to get all months between two dates (inclusive)
    const getMonthsInRange = (start, end) => {
        const startYear = parseInt(start.split('-')[0]);
        const startMonth = parseInt(start.split('-')[1]);
        const endYear = parseInt(end.split('-')[0]);
        const endMonth = parseInt(end.split('-')[1]);
        
        const months = [];
        let currYear = startYear;
        let currMonth = startMonth;
        
        while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
            months.push(`${currYear}-${String(currMonth).padStart(2, '0')}`);
            currMonth++;
            if (currMonth > 12) {
                currMonth = 1;
                currYear++;
            }
        }
        return months;
    };



    // Helper to determine if tenant was active in a given month (YYYY-MM)
    const isTenantActiveInMonth = (tenant, mStr) => {
        if (tenant.isAssigned === false) return false;
        
        const tenantContracts = state.contracts.filter(c => String(c.tenantId) === String(tenant.id));
        if (tenantContracts.length > 0) {
            return tenantContracts.some(c => {
                const start = c.startDate && typeof c.startDate === 'string' ? c.startDate.slice(0, 7) : '';
                const end = c.endDate && typeof c.endDate === 'string' ? c.endDate.slice(0, 7) : '';
                if (!start) return false;
                if (end) {
                    return mStr >= start && mStr <= end;
                }
                return mStr >= start;
            });
        }
        
        const tenantPayments = state.payments.filter(p => String(p.tenantId) === String(tenant.id));
        if (tenantPayments.length > 0) {
            const sortedPayments = [...tenantPayments].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            const firstValidPayment = sortedPayments.find(p => p.date && typeof p.date === 'string' && p.date.includes('-'));
            const startMonth = firstValidPayment ? firstValidPayment.date.slice(0, 7) : mStr;
            const currentMonth = new Date().toISOString().slice(0, 7);
            return mStr >= startMonth && mStr <= currentMonth;
        }
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        return mStr === currentMonth;
    };



    if (loading) return <div className="loader">Loading dashboard...</div>;

    // Filter tenants to ONLY those belonging to the current user's apartments
    const userApartmentIds = new Set(state.apartments.map(a => String(a.id)));
    const userTenants = state.tenants.filter(t => t.apartmentId && userApartmentIds.has(String(t.apartmentId)));

    // Innago collection calculations
    const activeTenantsInMonth = userTenants.filter(t => t.isAssigned !== false && isTenantActiveInMonth(t, selectedCollectionMonth));
    const expectedRentInMonth = activeTenantsInMonth.reduce((s, t) => s + (t.rentAmount || 0), 0);
    const collectedRentInMonth = state.payments
        .filter(p => p.type === 'Rent' && (p.monthPaid === selectedCollectionMonth || (p.monthList && p.monthList.includes(selectedCollectionMonth))))
        .reduce((s, p) => s + p.amount, 0);
    const outstandingRent = Math.max(0, expectedRentInMonth - collectedRentInMonth);
    const collectedPct = expectedRentInMonth > 0 ? Math.min(100, Math.max(0, Math.round((collectedRentInMonth / expectedRentInMonth) * 100))) : 100;
    const unpaidPct = 100 - collectedPct;
    
    const processingRentInMonth = state.payments
        .filter(p => p.type === 'Rent' && p.status === 'Pending' && (p.monthPaid === selectedCollectionMonth || (p.monthList && p.monthList.includes(selectedCollectionMonth))))
        .reduce((s, p) => s + p.amount, 0);

    // Units with invoices paid vs due
    let invoicesPaidCount = 0;
    let invoicesDueCount = 0;
    const paidTenants = [];
    const dueTenants = [];
    
    activeTenantsInMonth.forEach(t => {
        const hasPaid = state.payments.some(p => 
            String(p.tenantId) === String(t.id) && 
            p.type === 'Rent' && 
            (p.monthPaid === selectedCollectionMonth || (p.monthList && p.monthList.includes(selectedCollectionMonth)))
        );
        if (hasPaid) {
            invoicesPaidCount++;
            paidTenants.push(t);
        } else {
            invoicesDueCount++;
            dueTenants.push(t);
        }
    });

    // Past outstanding
    const getPastOutstanding = () => {
        let sum = 0;
        const pastMonths = getMonthsInRange("2024-01", selectedCollectionMonth);
        const pastMonthsOnly = pastMonths.filter(m => m !== selectedCollectionMonth);
        
        pastMonthsOnly.forEach(mStr => {
            const expected = userTenants
                .filter(t => t.isAssigned !== false && isTenantActiveInMonth(t, mStr))
                .reduce((s, t) => s + (t.rentAmount || 0), 0);
            const collected = state.payments
                .filter(p => p.type === 'Rent' && (p.monthPaid === mStr || (p.monthList && p.monthList.includes(mStr))))
                .reduce((s, p) => s + p.amount, 0);
            sum += Math.max(0, expected - collected);
        });
        return sum;
    };
    const pastOutstanding = getPastOutstanding();

    // Occupancy statistics
    const totalUnitsCount = state.apartments.length;
    const occupiedUnitsCount = state.apartments.filter(a => 
        userTenants.some(t => String(t.apartmentId) === String(a.id) && t.isAssigned !== false)
    ).length;
    const vacantUnitsCount = totalUnitsCount - occupiedUnitsCount;
    const occupancyPct = totalUnitsCount > 0 ? Math.round((occupiedUnitsCount / totalUnitsCount) * 100) : 0;

    // Calculate metrics for top stats bar
    const activeTenantsCount = userTenants.filter(t => t.isAssigned !== false).length;
    
    const totalCollectedRent = state.payments
        .filter(p => p.type === 'Rent')
        .reduce((sum, p) => sum + p.amount, 0);

    const totalCollectedDeposits = state.payments
        .filter(p => p.type === 'Deposit')
        .reduce((sum, p) => sum + p.amount, 0);

    const totalDepositMonths = userTenants.filter(t => t.isAssigned !== false).reduce((sum, t) => {
        return sum + (t.depositMonthsPaid || 0);
    }, 0);

    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
    const currentDay = today.getDate();

    let overdueCount = 0;
    let totalDue = 0;

    userTenants.filter(t => t.isAssigned !== false).forEach(tenant => {
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

        if (overdueMonths > 0) {
            overdueCount++;
            totalDue += overdueMonths * (tenant.rentAmount || 0);
        }
    });

    // Helper to calculate the list of unpaid months for a given tenant
    const getUnpaidMonthsList = (tenant) => {
        let startDateStr = '';
        const tenantContracts = state.contracts.filter(c => String(c.tenantId) === String(tenant.id));
        if (tenantContracts.length > 0) {
            const sortedContracts = [...tenantContracts].sort((a, b) => a.startDate.localeCompare(b.startDate));
            startDateStr = sortedContracts[0].startDate.slice(0, 7);
        } else {
            const tenantPayments = state.payments.filter(p => String(p.tenantId) === String(tenant.id));
            if (tenantPayments.length > 0) {
                const sortedPayments = [...tenantPayments].sort((a, b) => a.date.localeCompare(b.date));
                startDateStr = sortedPayments[0].date.slice(0, 7);
            } else {
                startDateStr = `${today.getFullYear()}-01`;
            }
        }

        if (startDateStr > currentMonthStr) {
            return [];
        }

        const allMonths = getMonthsInRange(startDateStr, currentMonthStr);
        
        const paidMonths = state.payments
            .filter(p => String(p.tenantId) === String(tenant.id) && p.type === 'Rent')
            .reduce((acc, p) => {
                if (p.monthPaid) acc.add(p.monthPaid);
                if (p.monthList) p.monthList.forEach(m => acc.add(m));
                return acc;
            }, new Set());

        return allMonths.filter(m => !paidMonths.has(m));
    };

    const unpaidTenantsList = userTenants
        .filter(t => t.isAssigned !== false)
        .map(t => {
            const unpaidMonths = getUnpaidMonthsList(t);
            const apartment = state.apartments.find(a => String(a.id) === String(t.apartmentId));
            const property = apartment ? state.properties.find(p => String(p.id) === String(apartment.propertyId)) : null;
            
            const tenantPayments = state.payments.filter(p => String(p.tenantId) === String(t.id));
            const sortedPayments = [...tenantPayments].sort((a, b) => b.date.localeCompare(a.date));
            const lastPaymentDate = sortedPayments.length > 0 ? sortedPayments[0].date : '—';

            return {
                tenant: t,
                propertyName: property ? property.name : '—',
                roomNumber: apartment ? apartment.unitNumber : '—',
                lastPaymentDate,
                unpaidMonths
            };
        })
        .filter(item => item.unpaidMonths.length > 0);





    const handlePrintPDF = () => {
        const signature = state.settings.signature || '';
        const propId = selectedReportPropertyId || (state.properties[0]?.id);
        if (!propId) {
            alert("No properties available to report.");
            return;
        }

        const property = state.properties.find(p => String(p.id) === String(propId));
        const propApts = state.apartments.filter(a => String(a.propertyId) === String(propId));
        const propAptIds = propApts.map(a => String(a.id));
        const propTenants = userTenants.filter(t => propAptIds.includes(String(t.apartmentId)));
        const propTenantIds = propTenants.map(t => String(t.id));
        
        const reportPayments = state.payments.filter(p => 
            p.date && typeof p.date === 'string' &&
            p.date >= printStartDate && p.date <= printEndDate && 
            propTenantIds.includes(String(p.tenantId))
        ).sort((a, b) => b.date.localeCompare(a.date));

        const rentTotal = reportPayments.filter(p => p.type === 'Rent').reduce((sum, p) => sum + p.amount, 0);
        const depositTotal = reportPayments.filter(p => p.type === 'Deposit').reduce((sum, p) => sum + p.amount, 0);
        const grandTotal = rentTotal + depositTotal;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Popup blocker prevented opening the print report window. Please allow popups for this site.");
            return;
        }

        const formattedStart = printStartDate.split('-').reverse().join('/');
        const formattedEnd = printEndDate.split('-').reverse().join('/');

        let htmlContent = `
            <html>
            <head>
                <title>Financial Report - ${property ? property.name : 'Property'}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
                    @page {
                        size: A4;
                        margin: 10mm 15mm 10mm 15mm;
                    }
                    body {
                        font-family: 'Outfit', sans-serif;
                        color: #343C6A;
                        padding: 0;
                        margin: 0;
                        background: #fff;
                        font-size: 11px;
                        line-height: 1.35;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1.5px solid #E6EFF5;
                        padding-bottom: 8px;
                        margin-bottom: 12px;
                    }
                    .title h1 {
                        font-size: 16px;
                        font-weight: 800;
                        margin: 0;
                        color: #2D60FF;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .title p {
                        font-size: 11px;
                        color: #718EBF;
                        margin: 3px 0 0;
                        font-weight: 600;
                    }
                    .meta {
                        text-align: right;
                        font-size: 10px;
                        color: #718EBF;
                        font-weight: 600;
                    }
                    .meta strong {
                        color: #343C6A;
                    }
                    .summary-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 12px;
                        margin-bottom: 15px;
                    }
                    .summary-card {
                        background: #F5F7FA;
                        border: 1px solid #E6EFF5;
                        border-radius: 8px;
                        padding: 8px 12px;
                    }
                    .summary-card.accent {
                        background: rgba(45, 96, 255, 0.05);
                        border-color: rgba(45, 96, 255, 0.15);
                    }
                    .summary-card span {
                        font-size: 8px;
                        color: #718EBF;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        display: block;
                        margin-bottom: 3px;
                    }
                    .summary-card h3 {
                        font-size: 13px;
                        font-weight: 800;
                        margin: 0;
                        color: #343C6A;
                    }
                    .summary-card.accent h3 {
                        color: #2D60FF;
                    }
                    .table-title {
                        font-size: 11px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 8px;
                        color: #343C6A;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 15px;
                    }
                    th {
                        background: #F5F7FA;
                        color: #718EBF;
                        font-size: 9px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        text-align: left;
                        padding: 6px 8px;
                        border-bottom: 1px solid #E6EFF5;
                    }
                    td {
                        padding: 6px 8px;
                        font-size: 10px;
                        border-bottom: 1px solid #E6EFF5;
                        color: #343C6A;
                        font-weight: 500;
                    }
                    tr:last-child td {
                        border-bottom: none;
                    }
                    .pill {
                        display: inline-block;
                        padding: 2px 6px;
                        border-radius: 12px;
                        font-size: 9px;
                        font-weight: 700;
                    }
                    .pill.rent {
                        background: #E7EDFF;
                        color: #2D60FF;
                    }
                    .pill.deposit {
                        background: #E6F4EA;
                        color: #10B981;
                    }
                    .amount {
                        font-weight: 700;
                        text-align: right;
                    }
                    .right-align {
                        text-align: right;
                    }
                    .footer {
                        font-size: 9px;
                        color: #718EBF;
                        text-align: center;
                        margin-top: 20px;
                        border-top: 1px solid #E6EFF5;
                        padding-top: 10px;
                        font-weight: 600;
                    }
                    @media print {
                        body {
                            padding: 0;
                            margin: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">
                        <h1>Financial Report</h1>
                        <p>${property ? property.name : 'All Properties'}</p>
                    </div>
                    <div class="meta">
                        Period: <strong>${formattedStart}</strong> to <strong>${formattedEnd}</strong><br>
                        Generated: <strong>${new Date().toLocaleDateString()}</strong>
                    </div>
                </div>

                <div class="summary-grid">
                    <div class="summary-card">
                        <span>Rent Collected</span>
                        <h3>${rentTotal.toLocaleString()} ${state.settings.currency}</h3>
                    </div>
                    <div class="summary-card">
                        <span>Deposits Collected</span>
                        <h3>${depositTotal.toLocaleString()} ${state.settings.currency}</h3>
                    </div>
                    <div class="summary-card accent">
                        <span>Total Collected</span>
                        <h3>${grandTotal.toLocaleString()} ${state.settings.currency}</h3>
                    </div>
                </div>

                <div class="table-title">Transaction Ledger</div>
                <table>
                    <thead>
                        <tr>
                            <th>Tenant</th>
                            <th>Unit</th>
                            <th>Type</th>
                            <th>Months Covered</th>
                            <th>Date Paid</th>
                            <th class="right-align">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportPayments.map(p => {
                            const t = propTenants.find(ten => String(ten.id) === String(p.tenantId));
                            const a = propApts.find(apt => String(apt.id) === String(p.apartmentId || t?.apartmentId));
                            return `
                                <tr>
                                    <td>${t ? t.name : 'Unknown Tenant'}</td>
                                    <td>${a ? `Apt ${a.unitNumber}` : '—'}</td>
                                    <td>
                                        <span class="pill ${p.type === 'Deposit' ? 'deposit' : 'rent'}">
                                            ${p.type}
                                        </span>
                                    </td>
                                    <td>${p.monthPaid ? formatMonth(p.monthPaid, state.settings.lang || 'en') : '—'}</td>
                                    <td>${p.date}</td>
                                    <td class="amount">${p.amount.toLocaleString()} ${state.settings.currency}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${reportPayments.length === 0 ? `
                            <tr>
                                <td colspan="6" style="text-align: center; color: #718EBF; padding: 15px;">
                                    No payments recorded during the selected period.
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>

                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; margin-bottom: 15px; border-top: 1px dashed #E6EFF5; padding-top: 12px;">
                    ${signature ? `
                        <div class="signature-container" style="text-align: left;">
                            <img src="${signature}" style="max-height: 40px; max-width: 150px; display: block; margin-bottom: 2px;" alt="Landlord Signature" />
                            <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px solid #E6EFF5; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Landlord Signature</div>
                        </div>
                    ` : `
                        <div class="signature-container" style="text-align: left; padding-top: 20px;">
                            <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px dashed #B1B1B1; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Landlord Signature</div>
                        </div>
                    `}
                </div>

                <div class="footer">
                    Property Management Ledger System — Confidential PDF Report
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <div className="view-container" style={{ paddingTop: '0.25rem', paddingBottom: '4rem' }}>
            {/* Top Row: Stats Cards + Print Financial Report PDF Controls */}
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2.5rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
                {/* Stats Cards Grid */}
                <div className="stats-grid" style={{ flex: '1 1 65%', marginBottom: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <StatCard 
                        title="ACTIVE TENANTS" 
                        value={activeTenantsCount} 
                        icon={Users}
                        colorClass="yellow"
                        bgClass="yellow"
                        subtext={`${state.apartments.filter(a => userTenants.some(t => String(t.apartmentId) === String(a.id) && t.isAssigned !== false)).length} Occupied Units`}
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

                {/* Print Report Card */}
                <div className="stat-card animate-slide-in" style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.25rem', height: 'auto', margin: 0 }}>
                    <h3 style={{ fontSize: '0.78rem', fontWeight: '800', color: '#343C6A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.65rem 0' }}>Print Financial Report PDF</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#718EBF' }}>Property:</span>
                            <select 
                                value={selectedReportPropertyId} 
                                onChange={e => setSelectedReportPropertyId(e.target.value)} 
                                style={{
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: '8px',
                                    border: '1px solid #E6EFF5',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    color: '#343C6A',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    fontFamily: 'Outfit, sans-serif',
                                    background: '#fff',
                                    width: '180px'
                                }}
                            >
                                {state.properties.map(prop => (
                                    <option key={prop.id} value={prop.id}>{prop.name}</option>
                                ))}
                                {state.properties.length === 0 && <option value="">No Properties Available</option>}
                            </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#718EBF' }}>From:</span>
                            <input 
                                type="date"
                                value={printStartDate}
                                onChange={e => setPrintStartDate(e.target.value)}
                                style={{
                                    padding: '0.3rem 0.5rem',
                                    borderRadius: '8px',
                                    border: '1px solid #E6EFF5',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    color: '#343C6A',
                                    outline: 'none',
                                    fontFamily: 'Outfit, sans-serif',
                                    background: '#fff',
                                    cursor: 'pointer',
                                    width: '180px'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#718EBF' }}>To:</span>
                            <input 
                                type="date"
                                value={printEndDate}
                                onChange={e => setPrintEndDate(e.target.value)}
                                style={{
                                    padding: '0.3rem 0.5rem',
                                    borderRadius: '8px',
                                    border: '1px solid #E6EFF5',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    color: '#343C6A',
                                    outline: 'none',
                                    fontFamily: 'Outfit, sans-serif',
                                    background: '#fff',
                                    cursor: 'pointer',
                                    width: '180px'
                                }}
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handlePrintPDF}
                        className="btn-primary"
                        style={{ 
                            padding: '0.45rem 1rem', 
                            fontSize: '0.72rem', 
                            borderRadius: '8px', 
                            fontWeight: '700', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            border: 'none',
                            background: '#2D60FF',
                            color: '#fff',
                            boxShadow: '0 4px 10px rgba(45, 96, 255, 0.2)',
                            marginTop: '0.65rem',
                            width: '100%'
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        Print PDF Report
                    </button>
                </div>
            </div>



            {/* ── Innago Inspired Dashboard Layout ── */}
            <div style={{ display: 'flex', flexDirection: 'row', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1.5rem', alignItems: 'flex-start' }}>
                
                {/* LEFT COLUMN: Collection Card + Unsigned Documents & Applications Row */}
                <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Collection Card */}
                    <div className="stat-card animate-slide-in" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', height: 'auto', margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #E6EFF5', paddingBottom: '1rem' }}>
                            <div>
                                <h2 style={{ color: '#343C6A', fontWeight: '800', fontSize: '1.2rem', margin: 0, fontFamily: 'Outfit' }}>
                                    Collection - {monthLabelShort}
                                </h2>
                                <p style={{ color: '#718EBF', fontSize: '0.72rem', margin: '4px 0 0', fontWeight: '500' }}>Monthly Rent collection summary and statuses</p>
                            </div>
                            
                            {/* Show By Dropdown */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#718EBF' }}>Show By:</span>
                                <select 
                                    value={selectedCollectionMonth} 
                                    onChange={e => setSelectedCollectionMonth(e.target.value)}
                                    style={{
                                        padding: '0.4rem 0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid #E6EFF5',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        color: '#343C6A',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        fontFamily: 'Outfit, sans-serif',
                                        background: '#fff'
                                    }}
                                >
                                    {collectionMonthsList.map(m => (
                                        <option key={m.val} value={m.val}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Top half: Collected vs Outstanding */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem 0', gap: '1rem', flexWrap: 'wrap' }}>
                            {/* Outstanding info */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: '1 1 200px', minWidth: '180px' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#718EBF', fontWeight: '600' }}>Outstanding</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#FF4B4A', margin: '4px 0' }}>
                                        {outstandingRent.toLocaleString()} {state.settings.currency}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#FF4B4A', lineHeight: 1 }}>{unpaidPct}%</div>
                                    <div style={{ fontSize: '0.6rem', color: '#FF4B4A', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>UNPAID</div>
                                </div>
                            </div>
                            
                            {/* Donut chart */}
                            <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                                <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="130" height="130" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                                        <circle cx="60" cy="60" r="45" fill="none" stroke="#FFE5E5" strokeWidth="9" />
                                        <circle cx="60" cy="60" r="45" fill="none" stroke="#10B981" strokeWidth="9"
                                            strokeDasharray={2 * Math.PI * 45}
                                            strokeDashoffset={(2 * Math.PI * 45) * (1 - collectedPct / 100)}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div style={{ position: 'absolute', textAlign: 'center', fontFamily: 'Outfit, sans-serif' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#343C6A', lineHeight: 1.2 }}>{monthLabelShort}</div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#718EBF', marginTop: '4px' }}>{selY}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Collected info */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: '1 1 200px', minWidth: '180px', justifyContent: 'flex-end' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#10B981', lineHeight: 1 }}>{collectedPct}%</div>
                                    <div style={{ fontSize: '0.6rem', color: '#10B981', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>COLLECTED</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#718EBF', fontWeight: '600' }}>Collected</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#10B981', margin: '4px 0' }}>
                                        {collectedRentInMonth.toLocaleString()} {state.settings.currency}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Paid vs Due row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem', borderTop: '1px solid #E6EFF5', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                            {/* Due units list */}
                            <div style={{ borderRight: '1px solid #E6EFF5', paddingRight: '1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Units with Invoices Due</div>
                                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#343C6A' }}>
                                    {invoicesDueCount} / {totalUnitsCount}
                                </div>
                                {/* Property avatars representing due units */}
                                <div style={{ display: 'flex', gap: '8px', margin: '10px 0', flexWrap: 'wrap' }}>
                                    {dueTenants.slice(0, 4).map((t, idx) => (
                                        <div key={t.id || idx} title={t.name} style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#FFE5E5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FFCDCD' }}>
                                            <Building size={14} style={{ color: '#FF4B4A' }} />
                                        </div>
                                    ))}
                                    {invoicesDueCount === 0 && (
                                        <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: '700', padding: '6px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <CheckCircle2 size={12} /> All invoices paid!
                                        </div>
                                    )}
                                </div>
                                <span style={{ fontSize: '0.72rem', color: '#2D60FF', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }} onClick={() => setShowUnpaidModal(true)}>
                                    View All
                                </span>
                            </div>

                            {/* Paid units list */}
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Units with Invoices Paid</div>
                                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#343C6A' }}>
                                    {invoicesPaidCount} / {totalUnitsCount}
                                </div>
                                {/* Property avatars representing paid units */}
                                <div style={{ display: 'flex', gap: '8px', margin: '10px 0', flexWrap: 'wrap' }}>
                                    {paidTenants.slice(0, 4).map((t, idx) => (
                                        <div key={t.id || idx} title={t.name} style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#E6F4EA', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #B7E4C7' }}>
                                            <Building size={14} style={{ color: '#10B981' }} />
                                        </div>
                                    ))}
                                    {invoicesPaidCount === 0 && (
                                        <div style={{ fontSize: '0.72rem', color: '#718EBF', fontWeight: '600', padding: '6px 0' }}>No paid invoices this month.</div>
                                    )}
                                </div>
                                <span style={{ fontSize: '0.72rem', color: '#2D60FF', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }} onClick={() => navigate('/payments')}>
                                    View All
                                </span>
                            </div>
                        </div>

                        {/* Bottom stats row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E6EFF5', paddingTop: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <span style={{ fontSize: '0.72rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Processing: </span>
                                <strong style={{ color: '#343C6A', fontSize: '0.88rem' }}>{processingRentInMonth.toLocaleString()} {state.settings.currency}</strong>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.72rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Expected: </span>
                                <strong style={{ color: '#343C6A', fontSize: '0.88rem' }}>{expectedRentInMonth.toLocaleString()} {state.settings.currency}</strong>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.72rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Past Outstanding: </span>
                                <strong style={{ color: '#FFBB38', fontSize: '0.88rem' }}>{pastOutstanding.toLocaleString()} {state.settings.currency}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Inner two column row: Unsigned Documents & Applications */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        
                        {/* Unsigned Documents Card */}
                        <div className="stat-card animate-slide-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '220px', margin: 0 }}>
                            <h3 style={{ color: '#343C6A', fontWeight: '800', fontSize: '0.95rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F5F7FA', paddingBottom: '0.75rem', fontFamily: 'Outfit' }}>
                                <FileText size={16} style={{ color: '#718EBF' }} /> UNSIGNED DOCUMENTS
                            </h3>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#718EBF', padding: '1rem' }}>
                                <ClipboardList size={38} style={{ strokeWidth: 1.5, color: '#B1B1B1', marginBottom: '8px' }} />
                                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#718EBF' }}>No Records Found</span>
                            </div>
                        </div>

                        {/* Applications Processing Card */}
                        <div className="stat-card animate-slide-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '220px', margin: 0 }}>
                            <h3 style={{ color: '#343C6A', fontWeight: '800', fontSize: '0.95rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F5F7FA', paddingBottom: '0.75rem', fontFamily: 'Outfit' }}>
                                <Users size={16} style={{ color: '#718EBF' }} /> APPLICATIONS PROCESSING
                            </h3>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#718EBF', padding: '1rem' }}>
                                <Users size={38} style={{ strokeWidth: 1.5, color: '#B1B1B1', marginBottom: '8px' }} />
                                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#718EBF' }}>No Records Found</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Actions Row + Occupancy Stats + Open Maintenance Requests */}
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                        <button 
                            onClick={() => navigate('/payments')} 
                            style={{
                                flex: 1,
                                padding: '0.7rem 0.5rem',
                                background: '#2D60FF',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '700',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                boxShadow: '0 4px 10px rgba(45, 96, 255, 0.15)'
                            }}
                        >
                            <DollarSign size={14} /> Record Payment
                        </button>
                        <button 
                            onClick={() => navigate('/tenants')} 
                            style={{
                                flex: 1,
                                padding: '0.7rem 0.5rem',
                                background: '#10B981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '700',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.15)'
                            }}
                        >
                            <PlusCircle size={14} /> Add Tenant
                        </button>
                    </div>

                    {/* Occupancy Statistics Card */}
                    <div className="stat-card animate-slide-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', margin: 0 }}>
                        <h3 style={{ color: '#343C6A', fontWeight: '800', fontSize: '0.95rem', margin: '0 0 1.25rem 0', borderBottom: '1px solid #F5F7FA', paddingBottom: '0.75rem', fontFamily: 'Outfit' }}>OCCUPANCY STATISTICS</h3>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                            {/* Values */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#FF4B4A', display: 'block', lineHeight: 1 }}>{vacantUnitsCount}</span>
                                    <span style={{ fontSize: '0.7rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vacant Units</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#10B981', display: 'block', lineHeight: 1 }}>{occupiedUnitsCount}</span>
                                    <span style={{ fontSize: '0.7rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Occupied Units</span>
                                </div>
                            </div>

                            {/* Donut graphic */}
                            <div style={{ position: 'relative', width: '90px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="90" height="90" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                                    <circle cx="50" cy="50" r="38" fill="none" stroke="#FFE5E5" strokeWidth="8" />
                                    <circle cx="50" cy="50" r="38" fill="none" stroke="#10B981" strokeWidth="8"
                                        strokeDasharray={2 * Math.PI * 38}
                                        strokeDashoffset={(2 * Math.PI * 38) * (1 - occupancyPct / 100)}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div style={{ position: 'absolute', textAlign: 'center', fontFamily: 'Outfit, sans-serif' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#343C6A', lineHeight: 1 }}>{totalUnitsCount}</div>
                                    <div style={{ fontSize: '0.55rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', marginTop: '2px' }}>Total</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Open Maintenance Requests Card */}
                    <div className="stat-card animate-slide-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', margin: 0 }}>
                        <h3 style={{ color: '#343C6A', fontWeight: '800', fontSize: '0.95rem', margin: '0 0 1.25rem 0', borderBottom: '1px solid #F5F7FA', paddingBottom: '0.75rem', fontFamily: 'Outfit' }}>OPEN MAINTENANCE REQUESTS</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <div style={{ background: '#E6F7F8', border: '1px solid #B3EBF2', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                                <span style={{ fontSize: '1.35rem', fontWeight: '900', color: '#00ACC1', display: 'block', lineHeight: 1 }}>1</span>
                                <span style={{ fontSize: '0.65rem', color: '#00838F', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.2px' }}>New Request</span>
                            </div>
                            <div style={{ background: '#FFE5E5', border: '1px solid #FFCDCD', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                                <span style={{ fontSize: '1.35rem', fontWeight: '900', color: '#FF4B4A', display: 'block', lineHeight: 1 }}>1</span>
                                <span style={{ fontSize: '0.65rem', color: '#B71C1C', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.2px' }}>Urgent</span>
                            </div>
                        </div>

                        {/* Request categories vertical bars */}
                        <div>
                            <span style={{ fontSize: '0.7rem', color: '#718EBF', fontWeight: '700', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>By Category</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: '700', color: '#343C6A', marginBottom: '2px' }}>
                                        <span>Plumbing</span>
                                        <span>1</span>
                                    </div>
                                    <div style={{ height: '6px', background: '#F5F7FA', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: '50%', height: '100%', background: '#FFBB38', borderRadius: '3px' }} />
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: '700', color: '#343C6A', marginBottom: '2px' }}>
                                        <span>Appliances</span>
                                        <span>1</span>
                                    </div>
                                    <div style={{ height: '6px', background: '#F5F7FA', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: '50%', height: '100%', background: '#FFBB38', borderRadius: '3px' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#718EBF', fontWeight: '600' }}>
                                    <span>Other Categories</span>
                                    <span>0</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Unpaid Invoices Modal */}
            {showUnpaidModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(5px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem',
                }}>
                    <div style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        width: '90%',
                        maxWidth: '850px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
                        overflow: 'hidden'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.25rem 1.5rem',
                            borderBottom: '1px solid #E6EFF5',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#343C6A', fontSize: '1.1rem', fontWeight: '800', fontFamily: 'Outfit' }}>
                                    Outstanding Invoices & Unpaid Coverage
                                </h3>
                                <p style={{ margin: '4px 0 0 0', color: '#718EBF', fontSize: '0.75rem', fontWeight: '500' }}>
                                    List of active tenants with outstanding monthly rent balances
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {unpaidTenantsList.length > 0 && (
                                    <button
                                        onClick={printAllArrears}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            background: '#2D60FF',
                                            color: '#FFFFFF',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '0.45rem 0.9rem',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#1A4BDB'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#2D60FF'}
                                    >
                                        <Printer size={14} /> Print List
                                    </button>
                                )}
                                <button 
                                    onClick={() => setShowUnpaidModal(false)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#718EBF',
                                        padding: '4px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div style={{
                            padding: '1.5rem',
                            overflowY: 'auto',
                            flex: 1
                        }}>
                            {unpaidTenantsList.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '3rem 1.5rem',
                                    color: '#10B981',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <CheckCircle2 size={48} />
                                    <span style={{ fontWeight: '800', fontSize: '1rem', color: '#343C6A' }}>All Clear!</span>
                                    <span style={{ fontSize: '0.85rem', color: '#718EBF' }}>No active tenants have unpaid monthly invoices.</span>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: '10px 12px', background: '#F5F7FA', color: '#718EBF', fontSize: '0.75rem', fontWeight: '700', borderBottom: '2px solid #E6EFF5' }}>Tenant Name</th>
                                                <th style={{ textAlign: 'left', padding: '10px 12px', background: '#F5F7FA', color: '#718EBF', fontSize: '0.75rem', fontWeight: '700', borderBottom: '2px solid #E6EFF5' }}>Property</th>
                                                <th style={{ textAlign: 'left', padding: '10px 12px', background: '#F5F7FA', color: '#718EBF', fontSize: '0.75rem', fontWeight: '700', borderBottom: '2px solid #E6EFF5' }}>Room Number</th>
                                                <th style={{ textAlign: 'left', padding: '10px 12px', background: '#F5F7FA', color: '#718EBF', fontSize: '0.75rem', fontWeight: '700', borderBottom: '2px solid #E6EFF5' }}>Last Payment Date</th>
                                                <th style={{ textAlign: 'left', padding: '10px 12px', background: '#F5F7FA', color: '#718EBF', fontSize: '0.75rem', fontWeight: '700', borderBottom: '2px solid #E6EFF5' }}>Months Unpaid</th>
                                                <th style={{ textAlign: 'center', padding: '10px 12px', background: '#F5F7FA', color: '#718EBF', fontSize: '0.75rem', fontWeight: '700', borderBottom: '2px solid #E6EFF5' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {unpaidTenantsList.map((item, idx) => (
                                                <tr key={item.tenant.id || idx} style={{ borderBottom: '1px solid #E6EFF5' }}>
                                                    <td style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '700', color: '#343C6A' }}>{item.tenant.name}</td>
                                                    <td style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '500', color: '#718EBF' }}>{item.propertyName}</td>
                                                    <td style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '500', color: '#718EBF' }}>{item.roomNumber}</td>
                                                    <td style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '600', color: '#343C6A' }}>{item.lastPaymentDate}</td>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                            {item.unpaidMonths.map(m => (
                                                                <span key={m} style={{
                                                                    background: '#FFE5E5',
                                                                    color: '#FF4B4A',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: '800',
                                                                    display: 'inline-block'
                                                                }}>
                                                                    {`${formatMonth(m, state.settings.lang || 'en')} ${m.split('-')[0]}`}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        <button
                                                            onClick={() => printTenantStatement(item.tenant)}
                                                            title="Print Statement of Arrears"
                                                            style={{
                                                                background: '#E7EDFF',
                                                                border: 'none',
                                                                borderRadius: '8px',
                                                                padding: '6px 10px',
                                                                color: '#2D60FF',
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'background 0.2s',
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = '#D2E0FF'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = '#E7EDFF'}
                                                        >
                                                            <Printer size={15} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '1rem 1.5rem',
                            borderTop: '1px solid #E6EFF5',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            background: '#F5F7FA'
                        }}>
                            <button 
                                onClick={() => setShowUnpaidModal(false)}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: '8px',
                                    border: '1px solid #E6EFF5',
                                    background: '#FFFFFF',
                                    color: '#718EBF',
                                    fontWeight: '700',
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
