// --- Email Receipt Engine ---

window.sendRentReceiptEmail = async (paymentId) => {
    const pay = state.payments.find(p => String(p.id) === String(paymentId));
    if (!pay) return;
    const tenant = state.tenants.find(t => String(t.id) === String(pay.tenantId));
    if (!tenant || !tenant.email) {
        return alert('⚠️ No email address on file for this tenant.\nEdit the tenant profile to add one.');
    }
    const apt = tenant.apartmentId ? state.apartments.find(a => String(a.id) === String(tenant.apartmentId)) : null;
    const prop = apt ? state.properties.find(p => String(p.id) === String(apt.propertyId)) : null;

    const body = [
        'RENT PAYMENT RECEIPT',
        '─'.repeat(40),
        `Property  : ${prop ? prop.name : 'N/A'}`,
        `Unit      : ${apt ? apt.unitNumber : 'N/A'}`,
        `Tenant    : ${tenant.name}`,
        '─'.repeat(40),
        `Period    : ${pay.monthPaid}`,
        `Date Paid : ${pay.date}`,
        `Amount    : ${pay.amount.toLocaleString()} ${state.settings.currency}`,
        '─'.repeat(40),
        `Receipt # : ${String(pay.id).slice(-8).toUpperCase()}`,
        '',
        'Thank you for your payment.',
        'This is a computer-generated receipt — no signature required.',
        '',
        '— Property Manager Admin'
    ].join('\n');

    try {
        const res = await fetch(`${API_URL}/send-receipt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: tenant.email,
                subject: `Rent Receipt – ${pay.monthPaid} | ${prop ? prop.name : 'Property Manager Admin'}`,
                body
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert(`✅ Receipt dispatched to ${tenant.email}\n\n(Check the server console — connect an SMTP service to enable live delivery.)`);
        }
    } catch (e) {
        console.error('Email dispatch failed:', e);
        alert('❌ Could not reach the mail server. Is the server running?');
    }
};

window.sendUtilityReceiptEmail = async (utilityId) => {
    const util = state.utilities.find(u => String(u.id) === String(utilityId));
    if (!util) return;
    const tenant = state.tenants.find(t => String(t.id) === String(util.tenantId));
    if (!tenant || !tenant.email) {
        return alert('⚠️ No email address on file for this tenant.\nEdit the tenant profile to add one.');
    }
    const apt = util.apartmentId ? state.apartments.find(a => String(a.id) === String(util.apartmentId)) : null;
    const prop = apt ? state.properties.find(p => String(p.id) === String(apt.propertyId)) : null;
    const icons = { Electricity: '⚡', Water: '💧', Gas: '🔥' };
    const icon = icons[util.type] || '🔧';

    const body = [
        `${icon} UTILITY BILL RECEIPT`,
        '─'.repeat(40),
        `Property  : ${prop ? prop.name : 'N/A'}`,
        `Unit      : ${apt ? apt.unitNumber : 'N/A'}`,
        `Tenant    : ${tenant.name}`,
        '─'.repeat(40),
        `Service   : ${util.type}`,
        `Month     : ${util.month}`,
        `Reading   : ${util.lastReading} → ${util.currentReading}`,
        `Bill Date : ${util.date}`,
        `Status    : ${util.status}`,
        '─'.repeat(40),
        `Amount    : ${util.amount.toLocaleString()} ${state.settings.currency}`,
        '─'.repeat(40),
        `Ref #     : ${String(util.id).slice(-8).toUpperCase()}`,
        '',
        'Please settle any outstanding balance promptly.',
        'This is a computer-generated receipt — no signature required.',
        '',
        '— Property Manager Admin'
    ].join('\n');

    try {
        const res = await fetch(`${API_URL}/send-receipt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: tenant.email,
                subject: `${util.type} Bill – ${util.month} | ${prop ? prop.name : 'Property Manager Admin'}`,
                body
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert(`✅ Utility receipt dispatched to ${tenant.email}\n\n(Check the server console — connect an SMTP service to enable live delivery.)`);
        }
    } catch (e) {
        console.error('Email dispatch failed:', e);
        alert('❌ Could not reach the mail server. Is the server running?');
    }
};
