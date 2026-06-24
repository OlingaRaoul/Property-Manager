import { useState, useEffect } from 'react';
import { useAppState } from '../context/StateContext';
import { Users, Building, Wallet, AlertCircle, Shield } from 'lucide-react';
import { getMonthsDifference, formatMonth } from '../utils';

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

const LineChart = ({ data, W, H, paddingLeft, paddingRight, paddingTop, paddingBottom, maxVal, cleanMax, currency }) => {
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

const BarChart = ({ data, W, H, paddingLeft, paddingRight, paddingTop, paddingBottom, maxVal, cleanMax, currency }) => {
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

const Dashboard = () => {
    const { state, loading, showTenantHistory } = useAppState();

    const todayStr = new Date().toISOString().split('T')[0];
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(sixMonthsAgoStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [printStartDate, setPrintStartDate] = useState(sixMonthsAgoStr);
    const [printEndDate, setPrintEndDate] = useState(todayStr);
    const [txPage, setTxPage] = useState(1);
    const [selectedReportPropertyId, setSelectedReportPropertyId] = useState('');

    useEffect(() => {
        if (state.properties.length > 0 && !selectedReportPropertyId) {
            setSelectedReportPropertyId(state.properties[0].id);
        }
    }, [state.properties, selectedReportPropertyId]);

    const setPreset = (presetName) => {
        const todayVal = new Date();
        const todayValStr = todayVal.toISOString().split('T')[0];
        let start = new Date();
        
        if (presetName === '30days') {
            start.setDate(todayVal.getDate() - 30);
        } else if (presetName === '6months') {
            start.setMonth(todayVal.getMonth() - 6);
        } else if (presetName === 'year') {
            start.setFullYear(todayVal.getFullYear(), 0, 1);
        } else if (presetName === 'all') {
            if (state.payments.length > 0) {
                const sorted = [...state.payments].sort((a, b) => a.date.localeCompare(b.date));
                setStartDate(sorted[0].date);
                setEndDate(todayValStr);
                return;
            }
            start.setFullYear(todayVal.getFullYear() - 1);
        }
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(todayValStr);
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

    // Helper to get all dates between two dates (inclusive)
    const getDatesInRange = (start, end) => {
        const startDateObj = new Date(start);
        const endDateObj = new Date(end);
        const dates = [];
        let curr = new Date(startDateObj);
        while (curr <= endDateObj) {
            dates.push(curr.toISOString().split('T')[0]);
            curr.setDate(curr.getDate() + 1);
        }
        return dates;
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

    // Helper to check if a rent payment was on-time based on tenant's dueDateDay
    const checkIsPaymentOnTime = (pay, tenant) => {
        const monthPaid = pay.monthPaid || (pay.date && typeof pay.date === 'string' ? pay.date.slice(0, 7) : '');
        if (!monthPaid || !monthPaid.includes('-')) return true;
        const [year, month] = monthPaid.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const actualDueDay = Math.min(tenant.dueDateDay || 1, daysInMonth);
        const dueDateStr = `${monthPaid}-${String(actualDueDay).padStart(2, '0')}`;
        return pay.date && typeof pay.date === 'string' ? pay.date <= dueDateStr : true;
    };

    // Helper to calculate days late for a rent payment
    const calculateDaysLate = (pay, tenant) => {
        const monthPaid = pay.monthPaid || (pay.date && typeof pay.date === 'string' ? pay.date.slice(0, 7) : '');
        if (!monthPaid || !monthPaid.includes('-')) return 0;
        const [year, month] = monthPaid.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const actualDueDay = Math.min(tenant.dueDateDay || 1, daysInMonth);
        const dueDateStr = `${monthPaid}-${String(actualDueDay).padStart(2, '0')}`;
        if (!pay.date || typeof pay.date !== 'string' || pay.date <= dueDateStr) return 0;
        
        const d1 = new Date(pay.date);
        const d2 = new Date(dueDateStr);
        const diffTime = d1 - d2;
        return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    };

    if (loading) return <div className="loader">Loading dashboard...</div>;

    // Filter payments inside date range
    const periodPayments = state.payments.filter(p => p.date >= startDate && p.date <= endDate);
    const periodTotal = periodPayments.reduce((s, p) => s + p.amount, 0);
    const periodRent = periodPayments.filter(p => p.type === 'Rent').reduce((s, p) => s + p.amount, 0);
    const periodDeposit = periodPayments.filter(p => p.type === 'Deposit').reduce((s, p) => s + p.amount, 0);
    const periodCount = periodPayments.length;

    // Build chart data
    const diffTime = Math.abs(new Date(endDate) - new Date(startDate));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let chartData = [];
    if (diffDays <= 31) {
        const dates = getDatesInRange(startDate, endDate);
        chartData = dates.map(dStr => {
            const dayPayments = state.payments.filter(p => p.date === dStr);
            const rent = dayPayments.filter(p => p.type === 'Rent').reduce((s, p) => s + p.amount, 0);
            const deposit = dayPayments.filter(p => p.type === 'Deposit').reduce((s, p) => s + p.amount, 0);
            
            const [y, m, d] = dStr.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const label = `${monthNames[parseInt(m) - 1]} ${d}`;
            
            return {
                label,
                rawLabel: dStr,
                rent,
                deposit,
                total: rent + deposit
            };
        });
    } else {
        const months = getMonthsInRange(startDate, endDate);
        chartData = months.map(mStr => {
            const monthPayments = state.payments.filter(p => p.date >= startDate && p.date <= endDate && p.date.startsWith(mStr));
            const rent = monthPayments.filter(p => p.type === 'Rent').reduce((s, p) => s + p.amount, 0);
            const deposit = monthPayments.filter(p => p.type === 'Deposit').reduce((s, p) => s + p.amount, 0);
            
            const [y, m] = mStr.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const label = `${monthNames[parseInt(m) - 1]} ${y}`;
            
            return {
                label,
                rawLabel: mStr,
                rent,
                deposit,
                total: rent + deposit
            };
        });
    }

    const maxVal = Math.max(...chartData.map(d => Math.max(d.total, d.rent, d.deposit)), 1000);
    const getCleanMax = (val) => {
        if (val <= 0) return 1000;
        const digits = Math.floor(Math.log10(val));
        const scale = Math.pow(10, Math.max(1, digits));
        return Math.ceil(val / scale) * scale;
    };
    const cleanMax = getCleanMax(maxVal);

    // 1. Property Performance & Yield Calculations
    const propertyPerformance = state.properties.map(prop => {
        const propApts = state.apartments.filter(a => String(a.propertyId) === String(prop.id));
        const propAptIds = propApts.map(a => String(a.id));
        const propTenants = state.tenants.filter(t => t.isAssigned !== false && propAptIds.includes(String(t.apartmentId)));
        
        const totalUnits = propApts.length;
        const occupiedUnits = propApts.filter(a => a.tenantId).length;
        const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
        
        const months = getMonthsInRange(startDate, endDate);
        let totalExpected = 0;
        months.forEach(mStr => {
            const monthlyExpected = propTenants
                .filter(t => isTenantActiveInMonth(t, mStr))
                .reduce((s, t) => s + (t.rentAmount || 0), 0);
            totalExpected += monthlyExpected;
        });
        
        const actualRent = state.payments
            .filter(p => p.type === 'Rent' && p.date >= startDate && p.date <= endDate && propTenants.some(t => String(t.id) === String(p.tenantId)))
            .reduce((s, p) => s + p.amount, 0);
            
        return {
            id: prop.id,
            name: prop.name,
            occupancyRate,
            occupiedUnits,
            totalUnits,
            expected: totalExpected,
            actual: actualRent,
            pct: totalExpected > 0 ? Math.round((actualRent / totalExpected) * 100) : 0
        };
    });

    // 2. Tenant Payment Risk & Reliability Calculations
    const activeTenantsRisk = state.tenants
        .filter(t => t.isAssigned !== false)
        .map(tenant => {
            const tenantRentPayments = state.payments.filter(p => String(p.tenantId) === String(tenant.id) && p.type === 'Rent');
            const totalPayments = tenantRentPayments.length;
            const onTimePayments = tenantRentPayments.filter(p => checkIsPaymentOnTime(p, tenant)).length;
            const onTimeRate = totalPayments > 0 ? Math.round((onTimePayments / totalPayments) * 100) : 100;
            
            const latePayments = tenantRentPayments.filter(p => !checkIsPaymentOnTime(p, tenant));
            const totalDaysLate = latePayments.reduce((sum, p) => sum + calculateDaysLate(p, tenant), 0);
            const avgDaysLate = latePayments.length > 0 ? parseFloat((totalDaysLate / latePayments.length).toFixed(1)) : 0.0;
            
            const today = new Date();
            const currentMonthStr = today.toISOString().slice(0, 7);
            const currentDay = today.getDate();
            const year = today.getFullYear();
            const month = today.getMonth() + 1;
            const daysInMonth = new Date(year, month, 0).getDate();
            const actualDueDay = Math.min(tenant.dueDateDay || 1, daysInMonth);
            
            let overdueMonths = 0;
            if (tenant.lastPaidMonth && typeof tenant.lastPaidMonth === 'string' && tenant.lastPaidMonth.includes('-')) {
                overdueMonths = getMonthsDifference(tenant.lastPaidMonth, currentMonthStr);
                if (currentDay <= actualDueDay) {
                    overdueMonths = Math.max(0, overdueMonths - 1);
                }
            } else if (currentDay > actualDueDay) {
                overdueMonths = 1;
            }
            
            const depositPaidMonths = tenant.depositMonthsPaid || 0;
            const netOverdue = Math.max(0, overdueMonths - depositPaidMonths);
            
            let riskLevel = 'Low';
            if (netOverdue >= 2) {
                riskLevel = 'High';
            } else if (netOverdue === 1 || (overdueMonths > 0 && overdueMonths <= depositPaidMonths) || (totalPayments > 0 && onTimeRate < 50)) {
                riskLevel = 'Medium';
            }
            
            const apt = state.apartments.find(a => String(a.id) === String(tenant.apartmentId));
            const prop = apt ? state.properties.find(p => String(p.id) === String(apt.propertyId)) : null;
            
            return {
                id: tenant.id,
                name: tenant.name,
                propertyName: prop ? prop.name : 'Unknown Property',
                unitNumber: apt ? apt.unitNumber : '?',
                onTimeRate,
                avgDaysLate,
                riskLevel,
                netOverdue
            };
        })
        .sort((a, b) => {
            const riskWeight = { High: 3, Medium: 2, Low: 1 };
            if (riskWeight[a.riskLevel] !== riskWeight[b.riskLevel]) {
                return riskWeight[b.riskLevel] - riskWeight[a.riskLevel];
            }
            return a.onTimeRate - b.onTimeRate;
        });

    // 3. 6-Month Cash Flow Forecasting Calculations
    const rateMonths = [];
    for (let i = -6; i <= -1; i++) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() + i);
        rateMonths.push(d.toISOString().slice(0, 7));
    }
    
    let totalExpectedRent = 0;
    let totalActualRent = 0;
    rateMonths.forEach(mStr => {
        const expected = state.tenants.reduce((sum, t) => sum + (isTenantActiveInMonth(t, mStr) ? (t.rentAmount || 0) : 0), 0);
        const actual = state.payments.filter(p => p.type === 'Rent' && (p.monthPaid || (p.date && typeof p.date === 'string' ? p.date.slice(0, 7) : '')) === mStr).reduce((sum, p) => sum + p.amount, 0);
        totalExpectedRent += expected;
        totalActualRent += actual;
    });
    const collectionRate = totalExpectedRent > 0 ? Math.max(0.5, Math.min(1.0, totalActualRent / totalExpectedRent)) : 0.95;
    
    const forecastTimeline = [];
    for (let i = -2; i <= 3; i++) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() + i);
        const mStr = d.toISOString().slice(0, 7);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
        
        let total = 0;
        const isForecast = i > 0;
        
        if (!isForecast) {
            total = state.payments
                .filter(p => p.date && typeof p.date === 'string' && p.date.startsWith(mStr))
                .reduce((sum, p) => sum + p.amount, 0);
        } else {
            const baseExpected = state.tenants
                .filter(t => isTenantActiveInMonth(t, mStr))
                .reduce((sum, t) => sum + (t.rentAmount || 0), 0);
            total = Math.round(baseExpected * collectionRate);
        }
        
        forecastTimeline.push({
            label,
            mStr,
            total,
            isForecast
        });
    }

    // Calculate metrics
    const activeTenantsCount = state.tenants.filter(t => t.isAssigned !== false).length;
    
    // Count only Rent payments
    const totalCollectedRent = state.payments
        .filter(p => p.type === 'Rent')
        .reduce((sum, p) => sum + p.amount, 0);

    // Count only Deposit payments
    const totalCollectedDeposits = state.payments
        .filter(p => p.type === 'Deposit')
        .reduce((sum, p) => sum + p.amount, 0);

    const totalDepositMonths = state.tenants.filter(t => t.isAssigned !== false).reduce((sum, t) => {
        return sum + (t.depositMonthsPaid || 0);
    }, 0);

    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
    const currentDay = today.getDate();

    let overdueCount = 0;
    let totalDue = 0;

    state.tenants.filter(t => t.isAssigned !== false).forEach(tenant => {
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

    // Group all payments by tenantId and date (similar to payment ledger history)
    const groupedPayments = state.payments.reduce((acc, p) => {
        const key = `${p.tenantId}-${p.date}`;
        if (!acc[key]) {
            acc[key] = {
                ...p,
                monthList: p.monthPaid ? [p.monthPaid] : [],
                totalAmount: p.amount,
                types: new Set([p.type])
            };
        } else {
            if (p.monthPaid && !acc[key].monthList.includes(p.monthPaid)) {
                acc[key].monthList.push(p.monthPaid);
            }
            acc[key].totalAmount += p.amount;
            acc[key].types.add(p.type);
        }
        return acc;
    }, {});

    const groupedPaymentsArray = Object.values(groupedPayments).map(p => {
        let typeLabel = 'Rent';
        if (p.types.has('Rent') && p.types.has('Deposit')) {
            typeLabel = 'Rent & Deposit';
        } else if (p.types.has('Deposit')) {
            typeLabel = 'Deposit';
        }
        return {
            ...p,
            typeLabel
        };
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Pagination for recent transactions
    const txPageSize = 5;
    const totalTxPages = Math.ceil(groupedPaymentsArray.length / txPageSize);
    const paginatedTx = groupedPaymentsArray.slice((txPage - 1) * txPageSize, txPage * txPageSize);

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
        const propTenants = state.tenants.filter(t => propAptIds.includes(String(t.apartmentId)));
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

            <div className="data-table-container animate-slide-in" style={{ marginBottom: '2.5rem' }}>
                <div className="table-header" style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ color: '#343C6A', fontWeight: '700', fontSize: '1.1rem' }}>Recent Transactions</h2>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Tenant</th>
                            <th className="hide-mobile">Unit</th>
                            <th className="hide-mobile">Type</th>
                            <th className="hide-mobile">month</th>
                            <th className="hide-mobile">date_paid</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th className="hide-mobile">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedTx.map(pay => {
                            const tenant = state.tenants.find(t => String(t.id) === String(pay.tenantId));
                            const apartment = tenant ? state.apartments.find(a => String(a.id) === String(pay.apartmentId || tenant.apartmentId)) : null;
                            const property = apartment ? state.properties.find(p => String(p.id) === String(apartment.propertyId)) : null;

                            return (
                                <tr key={pay.id}>
                                    <td style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderTop: 'none' }}>
                                        <img src={`https://robohash.org/${tenant ? encodeURIComponent(tenant.name) : 'User'}?set=set4`} style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#F5F7FA' }} alt="T" />
                                        {tenant ? (
                                            <span className="clickable-tenant" style={{ fontWeight: '500' }} onClick={() => showTenantHistory(tenant.id)}>
                                                {tenant.name}
                                            </span>
                                        ) : (
                                            <span style={{ fontWeight: '500' }}>Unknown User</span>
                                        )}
                                    </td>
                                    <td className="hide-mobile">
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: '600', color: '#343C6A' }}>{property ? property.name : 'Property'}</span>
                                            <span style={{ fontSize: '0.75rem', color: '#718EBF' }}>{apartment ? `Apt ${apartment.unitNumber}` : 'Unit'}</span>
                                        </div>
                                    </td>
                                    <td className="hide-mobile">
                                        <span style={{ 
                                            fontWeight: '700', 
                                            fontSize: '0.75rem',
                                            color: pay.typeLabel === 'Deposit' ? '#10B981' : (pay.typeLabel === 'Rent' ? '#2D60FF' : '#8B5CF6') 
                                        }}>
                                            {pay.typeLabel}
                                        </span>
                                    </td>
                                    <td className="hide-mobile">
                                        <span className="status-pill" style={{ fontSize: '0.75rem', background: '#F5F7FA', color: 'var(--secondary)', minWidth: 'auto' }}>
                                            {pay.monthList.length > 0 
                                                ? pay.monthList.map(m => formatMonth(m, state.settings.lang || 'en')).reverse().join(', ') 
                                                : '—'}
                                        </span>
                                    </td>
                                    <td className="hide-mobile" style={{ color: '#718EBF' }}>{pay.date}</td>
                                    <td style={{ fontWeight: '700', color: '#343C6A' }}>{pay.totalAmount.toLocaleString()} {state.settings.currency}</td>
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
                        {groupedPaymentsArray.length === 0 && <tr><td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No recent transactions found.</td></tr>}
                    </tbody>
                </table>

                {/* Table Pagination */}
                {totalTxPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.5rem 0', flexWrap: 'wrap', gap: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#718EBF' }}>
                            Page {txPage} of {totalTxPages} ({groupedPaymentsArray.length} records)
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                                className="btn-secondary" 
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px', cursor: txPage === 1 ? 'not-allowed' : 'pointer', opacity: txPage === 1 ? 0.5 : 1 }}
                                disabled={txPage === 1}
                                onClick={() => setTxPage(prev => Math.max(1, prev - 1))}
                            >
                                Previous
                            </button>
                            <button 
                                className="btn-secondary" 
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px', cursor: txPage === totalTxPages ? 'not-allowed' : 'pointer', opacity: txPage === totalTxPages ? 0.5 : 1 }}
                                disabled={txPage === totalTxPages}
                                onClick={() => setTxPage(prev => Math.min(totalTxPages, prev + 1))}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Financial Report Card ── */}
            <div className="stat-card animate-slide-in" style={{ padding: '1.5rem', marginBottom: '2.5rem', display: 'block', height: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h2 style={{ color: '#343C6A', fontWeight: '800', fontSize: '1.15rem', margin: 0, fontFamily: 'Outfit' }}>Financial Analytics Report</h2>
                        <p style={{ color: '#718EBF', fontSize: '0.75rem', margin: '4px 0 0', fontWeight: '500' }}>Cash flow trend and transaction analysis</p>
                    </div>
                    
                    {/* Period selectors and quick preset pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', background: '#F5F7FA', padding: '0.25rem', borderRadius: '10px', border: '1px solid #E6EFF5' }}>
                            <button onClick={() => setPreset('30days')} style={{ border: 'none', background: 'transparent', padding: '0.35rem 0.65rem', fontSize: '0.72rem', fontWeight: '700', borderRadius: '7px', cursor: 'pointer', color: '#718EBF' }}>30D</button>
                            <button onClick={() => setPreset('6months')} style={{ border: 'none', background: 'transparent', padding: '0.35rem 0.65rem', fontSize: '0.72rem', fontWeight: '700', borderRadius: '7px', cursor: 'pointer', color: '#718EBF' }}>6M</button>
                            <button onClick={() => setPreset('year')} style={{ border: 'none', background: 'transparent', padding: '0.35rem 0.65rem', fontSize: '0.72rem', fontWeight: '700', borderRadius: '7px', cursor: 'pointer', color: '#718EBF' }}>YTD</button>
                            <button onClick={() => setPreset('all')} style={{ border: 'none', background: 'transparent', padding: '0.35rem 0.65rem', fontSize: '0.72rem', fontWeight: '700', borderRadius: '7px', cursor: 'pointer', color: '#718EBF' }}>ALL</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                                style={{
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: '10px',
                                    border: '1px solid #E6EFF5',
                                    fontSize: '0.78rem',
                                    fontWeight: '700',
                                    color: '#343C6A',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    fontFamily: 'Outfit, sans-serif'
                                }}
                            />
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#718EBF' }}>to</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                style={{
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: '10px',
                                    border: '1px solid #E6EFF5',
                                    fontSize: '0.78rem',
                                    fontWeight: '700',
                                    color: '#343C6A',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    fontFamily: 'Outfit, sans-serif'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Aggregated Stats Row inside the period */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', background: '#F5F7FA', padding: '1rem', borderRadius: '15px', border: '1px solid #E6EFF5', marginBottom: '1.5rem' }}>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>Period Revenue</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#343C6A' }}>{periodTotal.toLocaleString()} {state.settings.currency}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#2D60FF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>Rent Collected</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#2D60FF' }}>{periodRent.toLocaleString()} {state.settings.currency}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>Deposits Collected</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#10B981' }}>{periodDeposit.toLocaleString()} {state.settings.currency}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#718EBF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>Transaction Count</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#343C6A' }}>{periodCount} Payments</div>
                    </div>
                </div>

                {/* Charts Layout */}
                {chartData.length === 0 ? (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#718EBF', fontSize: '0.88rem' }}>
                        No transactions recorded for the selected period ({startDate} to {endDate}). Try selecting a different range.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '1rem' }}>
                        {/* Line Chart Box */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#343C6A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Revenue Trend</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2D60FF', display: 'inline-block' }} />
                                    <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#718EBF' }}>Total Inflow</span>
                                </div>
                            </div>
                            <LineChart 
                                data={chartData} 
                                W={600} 
                                H={260} 
                                paddingLeft={60} 
                                paddingRight={20} 
                                paddingTop={30} 
                                paddingBottom={40} 
                                maxVal={maxVal} 
                                cleanMax={cleanMax} 
                                currency={state.settings.currency}
                            />
                        </div>

                        {/* Bar Chart Box */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#343C6A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Rent vs Deposit</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: '700', color: '#718EBF' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '3px', background: '#2D60FF', display: 'inline-block' }} /> Rent
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: '700', color: '#718EBF' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '3px', background: '#10B981', display: 'inline-block' }} /> Deposit
                                    </span>
                                </div>
                            </div>
                            <BarChart 
                                data={chartData} 
                                W={600} 
                                H={260} 
                                paddingLeft={60} 
                                paddingRight={20} 
                                paddingTop={30} 
                                paddingBottom={40} 
                                maxVal={maxVal} 
                                cleanMax={cleanMax} 
                                currency={state.settings.currency}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Property Performance & Tenant Risk Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
                
                {/* Property Yield & Performance */}
                <div className="stat-card animate-slide-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h2 style={{ color: '#343C6A', fontWeight: '800', fontSize: '1.1rem', margin: 0, fontFamily: 'Outfit' }}>Property Performance & Yield</h2>
                        <p style={{ color: '#718EBF', fontSize: '0.75rem', margin: '4px 0 0', fontWeight: '500' }}>Expected vs. actual collections & occupancy rates</p>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px', paddingRight: '4px' }}>
                        {propertyPerformance.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#718EBF', fontSize: '0.8rem' }}>No properties found.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {propertyPerformance.map(prop => {
                                    // Progress bar color based on collection pct
                                    let barColor = '#41D433'; // green
                                    if (prop.pct < 70) barColor = '#FF4B4A'; // red
                                    else if (prop.pct < 90) barColor = '#FEAA09'; // yellow
                                    
                                    return (
                                        <div key={prop.id} style={{ borderBottom: '1px solid #F5F7FA', paddingBottom: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <div>
                                                    <span style={{ fontWeight: '700', color: '#343C6A', fontSize: '0.85rem' }}>{prop.name}</span>
                                                    <span style={{ 
                                                        marginLeft: '8px', 
                                                        fontSize: '0.7rem', 
                                                        fontWeight: '700', 
                                                        padding: '2px 8px', 
                                                        borderRadius: '20px',
                                                        background: prop.occupancyRate >= 80 ? '#E6F4EA' : (prop.occupancyRate >= 50 ? '#FFF5D9' : '#FFE5E5'),
                                                        color: prop.occupancyRate >= 80 ? '#10B981' : (prop.occupancyRate >= 50 ? '#FFBB38' : '#FF4B4A')
                                                    }}>
                                                        {prop.occupancyRate}% Occupied ({prop.occupiedUnits}/{prop.totalUnits})
                                                    </span>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#343C6A' }}>
                                                        {prop.actual.toLocaleString()} / {prop.expected.toLocaleString()} {state.settings.currency}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Custom comparison progress bar */}
                                            <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: '#F3F4F6', overflow: 'hidden', position: 'relative' }}>
                                                <div style={{ 
                                                    width: `${Math.min(100, prop.pct)}%`, 
                                                    height: '100%', 
                                                    background: barColor, 
                                                    borderRadius: '4px',
                                                    transition: 'width 0.5s ease-out'
                                                }} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.68rem', color: '#718EBF' }}>
                                                <span>Yield Target: {prop.pct}%</span>
                                                <span>{prop.expected > 0 ? 'Monthly Collections' : 'No active expected rent'}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tenant Payment Performance & Risk Index */}
                <div className="stat-card animate-slide-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h2 style={{ color: '#343C6A', fontWeight: '800', fontSize: '1.1rem', margin: 0, fontFamily: 'Outfit' }}>Tenant Risk & Reliability Index</h2>
                        <p style={{ color: '#718EBF', fontSize: '0.75rem', margin: '4px 0 0', fontWeight: '500' }}>Active tenants ranked by risk & payment speeds</p>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px', paddingRight: '4px' }}>
                        {activeTenantsRisk.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#718EBF', fontSize: '0.8rem' }}>No active tenants.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {activeTenantsRisk.map(item => {
                                    // Risk badge colors
                                    let badgeBg = '#E6F4EA';
                                    let badgeColor = '#10B981';
                                    if (item.riskLevel === 'High') {
                                        badgeBg = '#FFE5E5';
                                        badgeColor = '#FF4B4A';
                                    } else if (item.riskLevel === 'Medium') {
                                        badgeBg = '#FFF5D9';
                                        badgeColor = '#FFBB38';
                                    }

                                    return (
                                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #F5F7FA', paddingBottom: '0.75rem' }}>
                                            <img src={`https://robohash.org/${encodeURIComponent(item.name)}?set=set4`} style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F5F7FA' }} alt="Avatar" />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span 
                                                        className="clickable-tenant" 
                                                        style={{ fontWeight: '700', color: '#343C6A', fontSize: '0.82rem', cursor: 'pointer' }}
                                                        onClick={() => showTenantHistory(item.id)}
                                                    >
                                                        {item.name}
                                                    </span>
                                                    <span style={{ 
                                                        fontSize: '0.65rem', 
                                                        fontWeight: '800', 
                                                        padding: '2px 8px', 
                                                        borderRadius: '20px',
                                                        background: badgeBg,
                                                        color: badgeColor
                                                    }}>
                                                        {item.riskLevel} Risk
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#718EBF', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>{item.propertyName} (Apt {item.unitNumber})</span>
                                                    <span>On-time: <strong style={{ color: '#343C6A' }}>{item.onTimeRate}%</strong> | Late: <strong style={{ color: '#343C6A' }}>{item.avgDaysLate}d avg</strong></span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* ── Future Cash Flow Forecasting ── */}
            <div className="stat-card animate-slide-in" style={{ padding: '1.5rem', marginBottom: '2.5rem', display: 'block', height: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h2 style={{ color: '#343C6A', fontWeight: '800', fontSize: '1.15rem', margin: 0, fontFamily: 'Outfit' }}>Future Cash Flow Forecasting</h2>
                        <p style={{ color: '#718EBF', fontSize: '0.75rem', margin: '4px 0 0', fontWeight: '500' }}>
                            6-Month trajectory: Transitioning from Actual Revenue (past 3 months) to Contract-Based Projections (next 3 months) adjusted by historical collection rate (<strong style={{ color: '#2D60FF' }}>{Math.round(collectionRate * 100)}%</strong>)
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: '700', color: '#718EBF' }}>
                            <span style={{ width: '12px', height: '3px', background: '#2D60FF', display: 'inline-block' }} /> Actual Cash Inflow
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: '700', color: '#718EBF' }}>
                            <span style={{ width: '12px', height: '3px', borderTop: '3px dashed #FFBB38', display: 'inline-block' }} /> Projected Collections
                        </span>
                    </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                    <ForecastChart 
                        data={forecastTimeline} 
                        W={600} 
                        H={240} 
                        paddingLeft={60} 
                        paddingRight={20} 
                        paddingTop={30} 
                        paddingBottom={40} 
                        currency={state.settings.currency}
                    />
                </div>
            </div>


        </div>
    );
};

export default Dashboard;
