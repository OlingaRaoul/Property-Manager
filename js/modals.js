// --- Form & Modal Logic ---

function showModal(type, target) {
    const modal = document.getElementById('modal-container');
    const form = document.getElementById('app-form');
    const title = document.getElementById('modal-title');
    
    modal.classList.add('active');
    modal.setAttribute('data-mode', type);
    form.innerHTML = '';
    
    if (type === 'property') {
        title.textContent = t('add_property');
        form.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <label style="display:block; margin-bottom: 0.5rem; color: var(--text-muted);">Property Name</label>
                    <input type="text" id="prop-name" class="search-box" style="width:100%" placeholder="e.g. Westside Towers" required>
                </div>
                <div>
                    <label style="display:block; margin-bottom: 0.5rem; color: var(--text-muted);">Address</label>
                    <input type="text" id="prop-address" class="search-box" style="width:100%" placeholder="123 Main St">
                </div>
            </div>
        `;
    } else if (type === 'edit-property') {
        const p = state.properties.find(prop => prop.id === target);
        currentEditId = target;
        title.textContent = t('edit');
        form.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <label style="display:block; margin-bottom: 0.5rem;">Property Name</label>
                    <input type="text" id="prop-name" class="search-box" style="width:100%" value="${p.name}" required>
                </div>
                <div>
                    <label style="display:block; margin-bottom: 0.5rem;">Address</label>
                    <input type="text" id="prop-address" class="search-box" style="width:100%" value="${p.address}">
                </div>
            </div>
        `;
    } else if (type === 'apartment') {
        currentEditId = target; // Store propertyId
        title.textContent = t('add_unit');
        form.innerHTML = `
             <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <label style="display:block; margin-bottom: 0.5rem;">Unit Number / Name</label>
                    <input type="text" id="apt-number" class="search-box" style="width:100%" placeholder="e.g. 101" required>
                </div>
                <div>
                    <label style="display:block; margin-bottom: 0.5rem;">Apartment Type</label>
                    <select id="apt-type" class="search-box" style="width:100%; color: var(--text-main); background: var(--bg-sidebar);">
                        ${state.unit_types.map(ut => `<option value="${ut.name}">${t(ut.name)}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;
    } else if (type === 'edit-tenant') {
        const tenant = state.tenants.find(ten => ten.id === target);
        currentEditId = target;
        title.textContent = t('edit');
        
        const currentApt = state.apartments.find(a => a.id === tenant.apartmentId);
        const aptOptions = state.apartments
            .filter(a => a.id === tenant.apartmentId || !state.tenants.some(ten => ten.apartmentId === a.id)) // Current room OR vacant rooms
            .map(a => {
                const p = state.properties.find(prop => prop.id === a.propertyId);
                return `<option value="${a.id}" ${a.id === tenant.apartmentId ? 'selected' : ''}>${p ? p.name : ''} - ${a.unitNumber} (${t(a.type)})</option>`;
            }).join('');

        const tenantPayments = state.payments.filter(p => p.tenantId === target);
        const totalPaid = tenantPayments.reduce((sum, p) => sum + p.amount, 0);
        
        form.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div class="stat-card glass" style="padding: 1rem; border: 1px solid var(--success-glow);">
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Total Revenue from Tenant</div>
                    <div style="font-size: 1.25rem; font-weight: bold; color: var(--success);">${totalPaid.toLocaleString()} ${state.settings.currency}</div>
                </div>
                <div>
                    <label style="display:block; margin-bottom: 0.5rem;">Tenant Name</label>
                    <input type="text" id="tenant-name" class="search-box" style="width:100%" value="${tenant.name}" required>
                </div>
                <div>
                    <label style="display:block; margin-bottom: 0.5rem;">Email Address <span style="font-size:0.75rem; color:var(--text-muted);">(for digital receipts)</span></label>
                    <input type="email" id="tenant-email" class="search-box" style="width:100%" value="${tenant.email || ''}" placeholder="tenant@email.com">
                </div>
                <div>
                    <label style="display:block; margin-bottom: 0.5rem;">Assigned Unit / Room</label>
                    <select id="tenant-apt-edit" class="search-box" style="width:100%; color: var(--text-main); background: var(--bg-sidebar);">
                        <option value="">Unassigned / Move Out</option>
                        ${aptOptions}
                    </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <label style="display:block; margin-bottom: 0.5rem;">Monthly Rent</label>
                        <input type="number" id="tenant-rent" class="search-box" style="width:100%" value="${tenant.rentAmount}" required>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom: 0.5rem;">Due Date (Day)</label>
                        <input type="number" id="tenant-due-day" min="1" max="28" class="search-box" style="width:100%" value="${tenant.dueDateDay}" required>
                    </div>
                </div>
                <div>
                    <label style="margin-bottom: 0.5rem; display:block;">Payment History (Months Covered)</label>
                    <div style="display:flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${tenantPayments.length > 0 
                            ? tenantPayments.map(pay => `<span class="status-pill paid" style="font-size: 0.7rem;">${pay.monthPaid}</span>`).join('') 
                            : '<span style="color:var(--text-muted); font-size:0.8rem;">No history yet.</span>'}
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'tenant') {
        title.textContent = t('add_tenant');
        
        const vacantApts = state.apartments.filter(a => !state.tenants.some(ten => ten.apartmentId === a.id));
        const aptOptions = state.properties.map(p => {
            const apts = vacantApts.filter(a => a.propertyId === p.id);
            if (apts.length === 0) return '';
            return `<optgroup label="${p.name}">
                ${apts.map(a => `<option value="${a.id}">${a.unitNumber} (${t(a.type)})</option>`).join('')}
            </optgroup>`;
        }).join('');
            
        form.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <label style="display:block; margin-bottom: 0.5rem;">Tenant Name</label>
                    <input type="text" id="tenant-name" class="search-box" style="width:100%" required>
                </div>
                <div>
                    <label style="display:block; margin-bottom: 0.5rem;">Email Address <span style="font-size:0.75rem; color:var(--text-muted);">(for digital receipts)</span></label>
                    <input type="email" id="tenant-email" class="search-box" style="width:100%" placeholder="tenant@email.com">
                </div>
                <div>
                    <label style="display:block; margin-bottom: 0.5rem;">Select Available Unit</label>
                    <select id="tenant-apt" class="search-box" style="width:100%; color: var(--text-main); background: var(--bg-sidebar);">
                        <option value="" disabled selected>-- Select a Unit --</option>
                        ${aptOptions || '<option disabled>No available units found. Create one first!</option>'}
                    </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <label style="display:block; margin-bottom: 0.5rem;">Monthly Rent ($)</label>
                        <input type="number" id="tenant-rent" class="search-box" style="width:100%" required>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom: 0.5rem; color: var(--text-muted);">Due Date (Day)</label>
                        <input type="number" id="tenant-due-day" min="1" max="28" class="search-box" style="width:100%" placeholder="1-28" required>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'contract') {
        title.textContent = t('add_contract');
        const tenantsOptions = state.tenants.map(ten => `<option value="${ten.id}">${ten.name}</option>`).join('');
        form.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <label data-t="tenant">${t('tenant')}</label>
                    <select id="contract-tenant" class="search-box" style="width:100%">${tenantsOptions}</select>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                    <div>
                        <label data-t="start_date">${t('start_date')}</label>
                        <input type="date" id="contract-start" class="search-box" style="width:100%">
                    </div>
                    <div>
                        <label data-t="end_date">${t('end_date')}</label>
                        <input type="date" id="contract-end" class="search-box" style="width:100%">
                    </div>
                </div>
                <div>
                   <label>Terms / Notes</label>
                   <textarea id="contract-terms" class="search-box" style="width:100%; height:100px; color:white;"></textarea>
                </div>
            </div>
        `;
    }
}
