// --- Content Rendering ---

function renderRecentTenants(filter = '') {
    const listElement = document.getElementById('recent-tenants-list');
    listElement.innerHTML = '';
    
    const filteredTenants = state.tenants.filter(t => 
        t.name.toLowerCase().includes(filter.toLowerCase())
    ).slice(0, 10);
    
    if (filteredTenants.length === 0) {
        listElement.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No tenants found. Add your first tenant to get started!</td></tr>';
        return;
    }

    filteredTenants.forEach(tenant => {
        const apartment = state.apartments.find(a => String(a.id) === String(tenant.apartmentId));
        const property = apartment ? state.properties.find(p => String(p.id) === String(apartment.propertyId)) : null;
        const rentStatus = calculateRentStatus(tenant);
        const lastPayment = state.payments.find(p => 
            String(p.tenantId) === String(tenant.id) && p.monthPaid === tenant.lastPaidMonth
        );
        const datePaid = lastPayment ? lastPayment.date : 'N/A';
        
        // Group all months settled on the same transaction date
        const monthCovered = lastPayment ? state.payments
            .filter(p => String(p.tenantId) === String(tenant.id) && p.date === lastPayment.date)
            .map(p => formatMonth(p.monthPaid))
            .reverse()
            .join(', ') : 'N/A';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${tenant.name}" alt="Avatar" style="width: 30px; height: 30px; border-radius: 50%;">
                    <span style="font-weight: 500; font-size: 0.9rem;">${tenant.name}</span>
                </div>
            </td>
            <td style="line-height: 1.2;">
                <div style="font-weight: 500; color:var(--text-main); font-size:0.9rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${property ? property.name : 'Unknown'}">${property ? property.name : 'Unknown'}</div>
                <div style="font-size: 0.75rem; color: var(--secondary);">${apartment ? apartment.unitNumber : 'N/A'}</div>
            </td>
            <td><div style="font-weight: 600; color:var(--text-main); font-size:0.9rem;">${monthCovered}</div></td>
            <td><div style="font-size: 0.85rem; color: var(--text-muted);">${datePaid}</div></td>
            <td style="font-weight: 600;">${tenant.rentAmount.toLocaleString()} ${state.settings.currency}</td>
            <td><span class="status-pill ${rentStatus.class}">${rentStatus.status}</span></td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                   <button class="btn-icon" onclick="window.markAsPaid('${tenant.id}')" title="Mark as Paid">
                       <i data-lucide="check-circle" style="color:var(--success); width: 14px;"></i>
                   </button>
                   <button class="btn-icon" onclick="window.generateReceipt('${lastPayment ? lastPayment.id : ''}')" title="Receipt" ${!lastPayment ? 'disabled style="opacity:0.3"' : ''}>
                       <i data-lucide="printer" style="color:var(--primary); width: 14px;"></i>
                   </button>
                </div>
            </td>
        `;
        listElement.appendChild(row);
    });
    
    lucide.createIcons();
}

function updateDashboard() {
    const activeTenantsCount = state.tenants.length;
    const totalCollected = state.tenants.reduce((sum, t) => {
        const status = calculateRentStatus(t);
        return status.status === 'Paid' ? sum + t.rentAmount : sum;
    }, 0);
    const totalDue = state.tenants.reduce((sum, t) => {
        const status = calculateRentStatus(t);
        return (status.status === 'Overdue' || status.status === 'Due Soon') ? sum + t.rentAmount : sum;
    }, 0);

    document.getElementById('stat-active-tenants').textContent = activeTenantsCount;
    document.getElementById('stat-collected-rent').textContent = `${totalCollected.toLocaleString()} ${state.settings.currency}`;
    document.getElementById('stat-rent-due').textContent = `${totalDue.toLocaleString()} ${state.settings.currency}`;
    
    // Refresh all visible lists
    renderRecentTenants();
    renderProperties();
    renderTenants();

    // Check for alarms
    checkRentAlarms();
}

function checkRentAlarms() {
    const overdueTenants = state.tenants.filter(t => calculateRentStatus(t).status === 'Overdue');
    const dot = document.querySelector('.notification-dot');
    
    if (overdueTenants.length > 0) {
        dot.classList.remove('hidden');
        // Browser notification if permitted
        if (Notification.permission === "granted") {
            new Notification("Property Manager Admin Rent Alert", {
                body: `${overdueTenants.length} tenants have overdue rent!`,
                icon: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aura'
            });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    } else {
        dot.classList.add('hidden');
    }
}

// Seeding demo data
window.seedDemoData = async () => {
    console.log("Seeding demo data to database...");
    try {
        const response = await fetch(`${API_URL}/seed`, { method: 'POST' });
        const result = await response.json();
        console.log(result.message);
        await loadState(); // Reload the UI
        alert('Real Database seeded successfully!');
    } catch (e) {
        console.error("Seeding failed. Is the server running?");
        alert("Failed to seed database. Using local cache fallback.");
    }
};
