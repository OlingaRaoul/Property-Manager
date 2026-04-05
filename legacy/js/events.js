// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
    // Load data from DB or Cache
    await loadState();

    // Nav Click Handlers
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            if (view) switchView(view);
        });
    });

    // Modal Close
    const closeModal = () => document.getElementById('modal-container').classList.remove('active');
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);

    // Add Buttons
    const addPropBtn = document.getElementById('add-property-btn');
    const addTenantBtn = document.getElementById('add-tenant-btn');

    if (addPropBtn) {
        addPropBtn.addEventListener('click', () => {
            console.log("Opening Add Property modal...");
            showModal('property');
        });
    }

    if (addTenantBtn) {
        addTenantBtn.addEventListener('click', () => {
            console.log("Opening Add Tenant modal...");
            showModal('tenant');
        });
    }

    const addContractBtn = document.getElementById('add-contract-btn');
    if (addContractBtn) {
        addContractBtn.addEventListener('click', () => {
            showModal('contract');
        });
    }

    // Form Save
    document.getElementById('save-btn').addEventListener('click', async () => {
        const container = document.getElementById('modal-container');
        const mode = container.getAttribute('data-mode');

        if (mode === 'property') {
            const name = document.getElementById('prop-name').value;
            const address = document.getElementById('prop-address').value;
            if (name) {
                const newProp = { id: Date.now().toString(), name, address };
                state.properties.push(newProp);
                await saveState('property', newProp);
                container.classList.remove('active');
                switchView('properties'); 
            }
        } else if (mode === 'apartment') {
            const unitNumber = document.getElementById('apt-number').value;
            const type = document.getElementById('apt-type').value;
            if (unitNumber && currentEditId) {
                const newApt = { id: Date.now().toString(), propertyId: currentEditId, unitNumber, type };
                state.apartments.push(newApt);
                await saveState('apartment', newApt);
                container.classList.remove('active');
                renderProperties();
            }
        } else if (mode === 'edit-property') {
            const name = document.getElementById('prop-name').value;
            const address = document.getElementById('prop-address').value;
            if (name && currentEditId) {
                if (confirm(`Save changes for ${name}?`)) {
                    const index = state.properties.findIndex(p => p.id === currentEditId);
                    if (index !== -1) {
                        state.properties[index] = { ...state.properties[index], name, address };
                        await saveState('edit-property', state.properties[index]);
                        container.classList.remove('active');
                        renderProperties();
                    }
                }
            }
        } else if (mode === 'tenant') {
            const name = document.getElementById('tenant-name').value.trim();
            const email = document.getElementById('tenant-email').value.trim();
            const apartmentId = document.getElementById('tenant-apt').value;
            const rentVar = document.getElementById('tenant-rent').value;
            const dueVar = document.getElementById('tenant-due-day').value;
            
            if (!name) return alert("Please enter the tenant's name.");
            if (!apartmentId || apartmentId.includes('No available units')) return alert("Please create and select a Unit first.");
            if (!rentVar) return alert("Please enter the monthly rent amount.");
            if (!dueVar) return alert("Please specify the rent due day (1-28).");

            const rentAmount = parseInt(rentVar);
            const dueDateDay = parseInt(dueVar);
            
            const newTenant = {
                id: Date.now().toString(),
                name,
                email,
                apartmentId: String(apartmentId),
                rentAmount,
                dueDateDay,
                lastPaidMonth: ''
            };
            state.tenants.push(newTenant);
            await saveState('tenant', newTenant);
            container.classList.remove('active');
            switchView('tenants');
        } else if (mode === 'edit-tenant') {
            const name = document.getElementById('tenant-name').value.trim();
            const email = document.getElementById('tenant-email').value.trim();
            const apartmentId = document.getElementById('tenant-apt-edit').value || null;
            const rentVar = document.getElementById('tenant-rent').value;
            const dueVar = document.getElementById('tenant-due-day').value;
            
            if (name && rentVar && dueVar && currentEditId) {
                if (confirm(`Save updated details for ${name}${apartmentId ? '' : ' and UNASSIGN room'}?`)) {
                    const index = state.tenants.findIndex(t => t.id === currentEditId);
                    if (index !== -1) {
                        state.tenants[index] = { 
                            ...state.tenants[index], 
                            name,
                            email,
                            apartmentId: apartmentId ? String(apartmentId) : null, 
                            rentAmount: parseInt(rentVar), 
                            dueDateDay: parseInt(dueVar) 
                        };
                        await saveState('edit-tenant', state.tenants[index]);
                        container.classList.remove('active');
                        updateDashboard();
                    }
                }
            }
        } else if (mode === 'edit-payment') {
            const amount = parseInt(document.getElementById('pay-amount').value);
            const date = document.getElementById('pay-date').value;
            const monthPaid = document.getElementById('pay-month').value;
            const payId = container.getAttribute('data-target');
            
            if (amount && payId) {
                const index = state.payments.findIndex(p => String(p.id) === String(payId));
                if (index !== -1) {
                    state.payments[index] = { ...state.payments[index], amount, date, monthPaid };
                    await fetch(`${API_URL}/payments/${payId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount, date, monthPaid })
                    });
                     // Check if it's the latest payment and update tenant if needed
                    const tenantObj = state.tenants.find(t => String(t.id) === String(state.payments[index].tenantId));
                    if (tenantObj) {
                         // Find latest based on state (simplified: newest in state.payments)
                         const remainingPays = state.payments.filter(p => String(p.tenantId) === String(tenantObj.id));
                         tenantObj.lastPaidMonth = remainingPays.length > 0 ? remainingPays[0].monthPaid : '';
                         await fetch(`${API_URL}/tenants/${tenantObj.id}/pay`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ lastPaidMonth: tenantObj.lastPaidMonth })
                         });
                    }
                    container.classList.remove('active');
                    updateDashboard();
                }
            }
        } else if (mode === 'receive-payment-grid') {
            const tenantId = container.getAttribute('data-target');
            const tenant = state.tenants.find(t => String(t.id) === String(tenantId));
            if (!tenant) return;
            
            const checkedMonths = Array.from(document.querySelectorAll('input[name="selected-months"]:checked:not(:disabled)'))
                .map(cb => cb.value);
            
            if (checkedMonths.length === 0) return alert("Please select at least one month to collect rent.");
            
            const payDate = document.getElementById('pay-date-manual').value;
            const rent = tenant.rentAmount;
            
            // Sort selected months chronologically to set correct lastPaidMonth
            checkedMonths.sort((a,b) => a.localeCompare(b));
            
            for (const monthCovered of checkedMonths) {
                const newPayment = {
                    id: `${Date.now()}-${monthCovered}`,
                    tenantId: tenantId,
                    amount: rent,
                    date: payDate,
                    monthPaid: monthCovered
                };
                
                state.payments.unshift(newPayment);
                await fetch(`${API_URL}/payments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newPayment)
                });
                
                // Update cached tenant state (optional but good for reactivity)
                tenant.lastPaidMonth = checkedMonths[checkedMonths.length - 1];
            }
            
            // Update final tenant status in DB
            await fetch(`${API_URL}/tenants/${tenantId}/pay`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lastPaidMonth: tenant.lastPaidMonth })
            });

            container.classList.remove('active');
            updateDashboard();
            alert(`✅ Recorded payments for ${checkedMonths.length} months for ${tenant.name}.`);
            if (tenantId && startDate) {
                const newContract = { id: Date.now().toString(), tenantId, startDate, endDate, terms, status: 'Active' };
                state.contracts.push(newContract);
                await saveState('contract', newContract);
                container.classList.remove('active');
                renderContracts();
            }
        } else if (mode === 'add-utility') {
            const tenantId = document.getElementById('util-tenant').value;
            const type = document.getElementById('util-type').value;
            const month = document.getElementById('util-month').value;
            const lastReading = parseFloat(document.getElementById('util-last').value) || 0;
            const currentReading = parseFloat(document.getElementById('util-current').value) || 0;
            const amount = parseFloat(document.getElementById('util-amount').value) || 0;
            const date = document.getElementById('util-date').value;
            
            if (!tenantId) return alert("Please select a tenant.");
            if (!amount) return alert("Please enter the utility amount.");

            const tenant = state.tenants.find(t => String(t.id) === String(tenantId));
            if (tenant) {
                const newUtil = {
                    id: Date.now().toString(),
                    apartmentId: tenant.apartmentId,
                    tenantId: tenantId,
                    type,
                    lastReading,
                    currentReading,
                    amount,
                    date,
                    status: 'Unpaid',
                    month
                };

                state.utilities.unshift(newUtil);
                await fetch(`${API_URL}/utilities`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newUtil)
                });

                container.classList.remove('active');
                renderUtilities();
                alert(`✅ Utility reading for ${tenant.name} recorded successfully.`);
            }
        }
    });

    // Settings Save
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            const currency = document.getElementById('setting-currency').value;
            const lang = document.getElementById('setting-lang').value;
            state.settings.currency = currency;
            state.settings.lang = lang;
            
            try {
                await fetch(`${API_URL}/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'currency', value: currency })
                });
                await fetch(`${API_URL}/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'lang', value: lang })
                });

                const successMsg = document.getElementById('settings-success');
                successMsg.style.display = 'block';
                setTimeout(() => successMsg.style.display = 'none', 3000);
                updateDashboard();
                applyTranslations();
            } catch (e) {
                alert("Failed to save settings.");
            }
        });
    }

    // Load SMTP settings into the form
    async function loadSmtpSettings() {
        try {
            const res = await fetch(`${API_URL}/smtp-settings`);
            const smtp = await res.json();
            if (document.getElementById('smtp-host')) {
                document.getElementById('smtp-host').value = smtp.host || '';
                document.getElementById('smtp-port').value = smtp.port || '587';
                document.getElementById('smtp-user').value = smtp.user || '';
                document.getElementById('smtp-from').value = smtp.from || '';
                // Don't pre-fill password for security — show placeholder if set
                document.getElementById('smtp-pass').placeholder = smtp.pass ? '••••••• (saved)' : '••••••••••••';
            }
        } catch(e) { /* settings view may not be mounted yet */ }
    }
    loadSmtpSettings();

    // Save SMTP Settings
    const saveSmtpBtn = document.getElementById('save-smtp-btn');
    if (saveSmtpBtn) {
        saveSmtpBtn.addEventListener('click', async () => {
            const statusEl = document.getElementById('smtp-status');
            const payload = {
                host: document.getElementById('smtp-host').value.trim(),
                port: document.getElementById('smtp-port').value.trim(),
                user: document.getElementById('smtp-user').value.trim(),
                pass: document.getElementById('smtp-pass').value.trim(),
                from: document.getElementById('smtp-from').value.trim()
            };
            if (!payload.host || !payload.user) {
                statusEl.style.display = 'block';
                statusEl.style.color = 'var(--error)';
                statusEl.textContent = '⚠️ Host and Login Email are required.';
                return;
            }
            // Don't overwrite saved password if field is empty
            if (!payload.pass) delete payload.pass;
            try {
                await fetch(`${API_URL}/smtp-settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                statusEl.style.display = 'block';
                statusEl.style.color = 'var(--success)';
                statusEl.textContent = '✅ SMTP settings saved successfully!';
                if (payload.pass) document.getElementById('smtp-pass').placeholder = '••••••• (saved)';
                document.getElementById('smtp-pass').value = '';
                setTimeout(() => statusEl.style.display = 'none', 4000);
            } catch(e) {
                statusEl.style.display = 'block';
                statusEl.style.color = 'var(--error)';
                statusEl.textContent = '❌ Failed to save SMTP settings.';
            }
        });
    }

    // Test SMTP connection by sending a test email to the configured address
    const testSmtpBtn = document.getElementById('test-smtp-btn');
    if (testSmtpBtn) {
        testSmtpBtn.addEventListener('click', async () => {
            const statusEl = document.getElementById('smtp-status');
            const user = document.getElementById('smtp-user').value.trim();
            if (!user) {
                statusEl.style.display = 'block';
                statusEl.style.color = 'var(--error)';
                statusEl.textContent = '⚠️ Save SMTP settings first, then test.';
                return;
            }
            statusEl.style.display = 'block';
            statusEl.style.color = 'var(--text-muted)';
            statusEl.textContent = '📤 Sending test email…';
            try {
                const res = await fetch(`${API_URL}/send-receipt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: user,
                        subject: '✅ Property Manager Admin SMTP Test — Connection Successful',
                        body: 'This is a test email from Property Manager Admin.\n\nYour SMTP configuration is working correctly.\n\n— Property Manager Admin'
                    })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    statusEl.style.color = 'var(--success)';
                    statusEl.textContent = `✅ Test email sent to ${user}! Check your inbox.`;
                } else {
                    statusEl.style.color = 'var(--error)';
                    statusEl.textContent = `❌ Error: ${data.message}`;
                }
            } catch(e) {
                statusEl.style.color = 'var(--error)';
                statusEl.textContent = '❌ Could not reach server.';
            }
        });
    }

    // Global Search Filter
    const searchBox = document.getElementById('global-search');
    if (searchBox) {
        searchBox.oninput = (e) => {
            const val = e.target.value;
            // Filter whatever list is currently active
            renderRecentTenants(val);
            renderTenants(val);
            renderProperties(val);
        };
    }

    // Initial Render
    if (state.properties.length === 0 && state.tenants.length === 0) {
        // Offer to seed data or show empty state
        console.log("Empty state. Use window.seedDemoData() to populate.");
    }
    
    switchView('dashboard');
    updateDashboard();
});

function renderUnitTypesSettings() {
    const container = document.getElementById('unit-types-manager');
    if (!container) return;
    
    container.innerHTML = `
        <h3 style="margin-bottom: 1.5rem;" data-t="unit_types_title">${t('unit_types_title')}</h3>
        <div style="display:flex; gap:0.5rem; margin-bottom:1.5rem;">
            <input type="text" id="new-unit-type-name" class="search-box" style="flex:1; color: white;" placeholder="${t('cat_placeholder')}">
            <button class="btn btn-primary" onclick="window.addUnitType()" style="white-space:nowrap;">
                <i data-lucide="plus"></i> ${t('add_type')}
            </button>
        </div>
        <div id="unit-types-list" style="display:grid; gap:0.5rem;">
            ${state.unit_types.map(ut => `
                <div class="glass" style="padding:0.75rem; border-radius:12px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                       <i data-lucide="tag" style="width:14px; color:var(--primary);"></i>
                       <span style="font-weight:600; color: white;">${ut.name}</span>
                       <span style="font-size:0.75rem; color:var(--text-muted);">(${t(ut.name)})</span>
                    </div>
                    <button class="btn-icon" onclick="window.deleteUnitType('${ut.id}')" style="color:var(--error);">
                        <i data-lucide="trash-2" style="width:14px;"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
    lucide.createIcons();
}

window.addUnitType = async function() {
    const name = document.getElementById('new-unit-type-name').value.trim();
    if (!name) return;
    
    const id = Date.now().toString();
    const newType = { id, name };
    
    try {
        await fetch(`${API_URL}/unit-types`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newType)
        });
        state.unit_types.push(newType);
        renderUnitTypesSettings();
    } catch (e) {
        alert("Failed to add category.");
    }
}

window.deleteUnitType = async function(id) {
    if (!confirm("Delete this category? units using this type will remain but the category will be removed from future selection.")) return;
    
    try {
        await fetch(`${API_URL}/unit-types/${id}`, {
            method: 'DELETE'
        });
        state.unit_types = state.unit_types.filter(ut => ut.id !== id);
        renderUnitTypesSettings();
    } catch (e) {
        alert("Failed to delete category.");
    }
}

// Contracts Logic
function renderContracts() {
    const list = document.getElementById('contracts-list');
    if (!list) return;
    list.innerHTML = '';
    
    state.contracts.forEach(c => {
        const tenant = state.tenants.find(t => t.id === c.tenantId);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${tenant ? tenant.name : 'Unknown'}</td>
            <td>${c.startDate}</td>
            <td>${c.endDate || 'Rolling'}</td>
            <td><span class="status-pill ${c.status === 'Active' ? 'paid' : 'overdue'}">${t(c.status.toLowerCase())}</span></td>
            <td>
                <button class="btn-icon" onclick="window.deleteContract('${c.id}')"><i data-lucide="trash-2"></i></button>
            </td>
        `;
        list.appendChild(row);
    });
    lucide.createIcons();
}

window.deleteContract = async (id) => {
    if (confirm("Permanently delete this contract record?")) {
        try {
            await fetch(`${API_URL}/contracts/${id}`, { method: 'DELETE' });
            state.contracts = state.contracts.filter(c => c.id !== id);
            renderContracts();
        } catch (e) { console.error("Delete failed."); }
    }
};

// Helper renders for subviews
function renderProperties(filter = '') {
    const list = document.getElementById('property-list');
    if (!list) return;
    list.innerHTML = '';
    
    const filteredProps = state.properties.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    
    filteredProps.forEach(p => {
        const propertyApts = state.apartments.filter(a => String(a.propertyId) === String(p.id));
        const card = document.createElement('div');
        card.className = 'stat-card animate-slide-in';
        card.style.height = 'auto';
        card.style.cursor = 'default';
        
        let unitListHTML = propertyApts.map(a => {
            const t_obj = state.tenants.find(tenant => tenant.apartmentId === a.id);
            return `
           <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.75rem 0; border-top: 1px solid var(--border-light);">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                   <i data-lucide="${a.type === 'Studio' ? 'home' : 'door-closed'}" style="width:14px; color:var(--text-muted);"></i>
                   <span style="font-size:0.875rem; font-weight:600;">${a.unitNumber}</span>
                   <span style="font-size:0.8rem; color:var(--text-muted);">(${t(a.type)})</span>
                   ${t_obj ? `<span style="font-size:0.875rem; color:var(--text-main); margin-left:8px;"> • ${t_obj.name}</span>` : `<span style="font-size:0.8rem; color:var(--success); margin-left:8px;"> • ${t('vacant')}</span>`}
                </div>
                ${t_obj ? `<span class="status-pill ${calculateRentStatus(t_obj).class}" style="font-size:0.7rem; padding: 0.15rem 0.5rem;">${calculateRentStatus(t_obj).status}</span>` : ''}
            </div>
            `;
        }).join('') || `<div style="color:var(--text-muted); font-size:0.8rem; margin-top:1rem;">No apartments found.</div>`;

        card.innerHTML = `
            <div class="stat-header">
                <div>
                  <div class="stat-label">${t('property_label')}</div>
                  <div class="stat-value" style="font-size: 1.25rem;">${p.name}</div>
                </div>
                <div style="display:flex; gap:0.5rem;">
                   <button class="btn-icon" onclick="editProperty('${p.id}')" title="${t('edit')}"><i data-lucide="edit-3" style="width:16px;"></i></button>
                   <button class="btn-icon" onclick="deleteProperty('${p.id}')" title="${t('delete')}" style="color:var(--error);"><i data-lucide="trash-2" style="width:16px;"></i></button>
                </div>
            </div>
            <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1rem;">
                <i data-lucide="map-pin" style="width:12px; vertical-align:middle;"></i> ${p.address}
            </div>
            
            <button class="btn btn-primary" onclick="addApartment('${p.id}')" style="width:100%; margin-bottom: 1.5rem; justify-content:center; gap:0.5rem;">
                <i data-lucide="plus-circle" style="width:16px;"></i> ${t('add_unit')}
            </button>

            <div class="unit-list">
                <h4 style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem;">${t('inventory')} (${propertyApts.length})</h4>
                ${unitListHTML}
            </div>
        `;
        list.appendChild(card);
    });
    lucide.createIcons();
}

function renderTenants(filter = '') {
    const list = document.getElementById('tenants-registry-list');
    if (!list) return;
    list.innerHTML = '';
    
    const filteredTenants = state.tenants.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()));
    
    filteredTenants.forEach(tenantObj => {
        const apartment = state.apartments.find(a => String(a.id) === String(tenantObj.apartmentId));
        const property = apartment ? state.properties.find(p => String(p.id) === String(apartment.propertyId)) : null;
        const card = document.createElement('div');
        card.className = 'stat-card animate-slide-in';
        const rentStatus = calculateRentStatus(tenantObj);

        card.innerHTML = `
             <div class="stat-header">
                <div style="display:flex; align-items:center; gap: 0.5rem;">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${tenantObj.name}" class="avatar">
                    <span class="stat-label">${tenantObj.name}</span>
                </div>
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    <span class="status-pill ${rentStatus.class}" style="font-size:0.7rem;">${rentStatus.status}</span>
                    <button class="btn-icon" onclick="editTenant('${tenantObj.id}')" title="Transfer / Edit"><i data-lucide="edit" style="width:14px;"></i></button>
                    <button class="btn-icon" onclick="deleteTenant('${tenantObj.id}')" title="Check Out (Unassign Room)" style="color:var(--warning);"><i data-lucide="door-open" style="width:14px;"></i></button>
                    <button class="btn-icon" onclick="permanentlyDeleteTenant('${tenantObj.id}')" title="Permanently Delete Record" style="color:var(--error);"><i data-lucide="trash-2" style="width:14px;"></i></button>
                </div>
            </div>
            <div class="stat-value" style="font-size: 1.125rem;">${tenantObj.rentAmount.toLocaleString()} ${state.settings.currency} / mo</div>
            <div style="font-size: 0.875rem; color: var(--text-muted); mb-1">${property ? property.name : t('unassigned')} - ${apartment ? apartment.unitNumber : t('no_room')}</div>
            
            <div style="margin-top: 1rem; padding: 0.75rem 0; border-top: 1px solid var(--border-light); border-bottom: 1px solid var(--border-light);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.75rem;">
                    <span style="color: var(--text-muted);">${t('currently_due')}:</span>
                    <span style="font-weight: bold; color: ${rentStatus.status === t('paid') ? 'var(--success)' : 'var(--error)'};">
                        ${rentStatus.status === t('paid') ? '0' : tenantObj.rentAmount.toLocaleString()} ${state.settings.currency}
                    </span>
                </div>
                <div style="font-size: 1rem; color: var(--text-muted); margin-bottom: 0.25rem;">${t('recent_history')}:</div>
                <div style="display: flex; gap: 0.25rem;">
                    ${state.payments
                        .filter(p => String(p.tenantId) === String(tenantObj.id))
                        .sort((a, b) => a.monthPaid.localeCompare(b.monthPaid))
                        .slice(-3)
                        .map(p => `
                        <span class="status-pill paid" style="font-size: 0.6rem; padding: 1px 4px; border-radius: 4px;">${formatMonth(p.monthPaid)}</span>
                    `).join('') || `<span style="font-size: 0.6rem; color: var(--text-muted);">${t('no_room')}</span>`}
                </div>
            </div>

            <div style="margin-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 0.7rem; color: var(--text-muted);">${t('total_revenue')}:</div>
                <div style="font-size: 0.85rem; font-weight: bold; color: var(--success);">${state.payments.filter(p => p.tenantId === tenantObj.id).reduce((sum, p) => sum + p.amount, 0).toLocaleString()} ${state.settings.currency}</div>
            </div>
        `;
        list.appendChild(card);
    });
    lucide.createIcons();
}

function renderPayments(filter = '') {
    const container = document.getElementById('payments-panels-container');
    if (!container) return;
    container.innerHTML = '';
    
    // Ledger Header & Entry Point
    const header = document.createElement('div');
    header.className = "animate-fade-in";
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; padding: 0.5rem 0.75rem; background: #FFFFFF; border-radius: 24px; border: 1px solid var(--border-light); box-shadow: var(--card-shadow);";
    header.innerHTML = `
        <div style="display:flex; align-items:center; gap: 1rem;">
            <div style="width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #4F46E5, #3B82F6); display: flex; align-items: center; justify-content: center; color: #FFFFFF; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                <i data-lucide="receipt" style="width: 24px;"></i>
            </div>
            <div>
                <h2 style="color: var(--text-main); font-weight: 800; font-family: 'Outfit'; margin: 0; letter-spacing: -0.02em;">Payments Ledger</h2>
                <p style="color: var(--text-muted); font-size: 0.8rem; margin: 0; font-weight: 500;">Track and verify rent collections across your entire portfolio.</p>
            </div>
        </div>
        <button class="btn-primary" onclick="window.openGlobalPaymentModal()" id="btn-gl-pay" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.75rem 1.75rem; border-radius: 50px; background: linear-gradient(to right, #4F46E5, #3B82F6); border: none; font-weight: 700; font-family: 'Outfit'; font-size: 0.95rem; letter-spacing: 0.01em; box-shadow: 0 10px 20px -5px rgba(59, 130, 246, 0.4); transition: all 0.3s ease; cursor: pointer;">
            <i data-lucide="plus-circle" style="width: 20px;"></i>
            <span>Register Payment</span>
        </button>
    `;
    
    // Modern button hover effect injection
    const btn = header.querySelector('#btn-gl-pay');
    btn.onmouseover = () => { btn.style.transform = 'translateY(-2px) scale(1.02)'; btn.style.boxShadow = '0 12px 24px -5px rgba(59, 130, 246, 0.5)'; };
    btn.onmouseout = () => { btn.style.transform = 'none'; btn.style.boxShadow = '0 10px 20px -5px rgba(59, 130, 246, 0.4)'; };
    
    container.appendChild(header);
    
    const filteredPayments = state.payments.filter(pay => {
        const tenant = state.tenants.find(t => String(t.id) === String(pay.tenantId));
        return tenant && tenant.name.toLowerCase().includes(filter.toLowerCase());
    });

    if (state.payments.length === 0) {
        container.insertAdjacentHTML('beforeend', `<div class="stat-card" style="text-align:center; padding: 4rem 2rem; color: var(--text-muted);">
            <i data-lucide="inbox" style="width: 48px; height: 48px; opacity: 0.2; margin-bottom: 1rem;"></i>
            <p>No payment history recorded for this portfolio yet.</p>
        </div>`);
        lucide.createIcons();
        return;
    }

    // Panels for each property
    state.properties.forEach(prop => {
        const propPayments = filteredPayments.filter(pay => {
            const tenant = state.tenants.find(t => String(t.id) === String(pay.tenantId));
            const apartment = tenant ? state.apartments.find(a => String(a.id) === String(tenant.apartmentId)) : null;
            return apartment && String(apartment.propertyId) === String(prop.id);
        });

        if (propPayments.length > 0) {
            const total = propPayments.reduce((sum, p) => sum + p.amount, 0);
            const panel = document.createElement('div');
            panel.className = 'animate-slide-in';
            panel.style.cssText = "background: #FFFFFF; border: 1px solid var(--border-light); border-radius: 20px; overflow: hidden; margin-bottom: 1rem; box-shadow: var(--card-shadow);";
            
            panel.innerHTML = `
                <div class="panel-trigger" onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron-icon').classList.toggle('rotate')" style="padding: 1.25rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); display: flex; align-items: center; justify-content: center; color: var(--primary);">
                            <i data-lucide="building-2" style="width: 22px;"></i>
                        </div>
                        <div>
                            <div style="font-weight: bold; font-size: 1.05rem; color: var(--text-main);">${prop.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);"><i data-lucide="map-pin" style="width:10px; margin-right:4px;"></i>${prop.address}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 2rem;">
                         <div style="text-align: right;">
                            <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">${t('total_revenue')}</div>
                            <div style="font-weight: bold; color: var(--success); font-size: 1.1rem;">${total.toLocaleString()} ${state.settings.currency}</div>
                        </div>
                        <i data-lucide="chevron-down" class="chevron-icon" style="width: 20px; color: var(--secondary); transition: transform 0.3s ease;"></i>
                    </div>
                </div>
                <div class="panel-body hidden" style="padding: 0 1.25rem 1.25rem 1.25rem; border-top: 1px solid var(--border-light);">
                    <table class="data-table" style="width: 100%; border-collapse: separate; border-spacing: 0;">
                        <thead>
                            <tr>
                                <th style="border-bottom: 1px solid var(--border-light); padding: 1rem 0;">Tenant</th>
                                <th style="border-bottom: 1px solid var(--border-light);">Month Covered</th>
                                <th style="border-bottom: 1px solid var(--border-light);">Payment Date</th>
                                <th style="border-bottom: 1px solid var(--border-light);">Amount</th>
                                <th style="border-bottom: 1px solid var(--border-light); text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
                                const grouped = propPayments.reduce((acc, p) => {
                                    const key = `${p.tenantId}-${p.date}`;
                                    if (!acc[key]) {
                                        acc[key] = { ...p, monthList: [p.monthPaid], totalAmount: p.amount };
                                    } else {
                                        acc[key].monthList.push(p.monthPaid);
                                        acc[key].totalAmount += p.amount;
                                    }
                                    return acc;
                                }, {});
                                
                                return Object.values(grouped).sort((a,b) => b.date.localeCompare(a.date)).map(p => {
                                    const tenant = state.tenants.find(t => String(t.id) === String(p.tenantId));
                                    const monthDisplay = p.monthList.map(m => formatMonth(m)).reverse().join(', ');
                                    return `
                                        <tr class="payment-row">
                                            <td style="font-weight: 600; color:var(--text-main);">${tenant ? tenant.name : 'Unknown User'}</td>
                                            <td><span class="status-pill" style="font-size: 0.75rem; background: #F5F7FA; color:var(--secondary);">${monthDisplay}</span></td>
                                            <td style="font-size: 0.85rem; color: var(--text-muted);">${p.date}</td>
                                            <td style="font-weight: bold; color: var(--success);">${p.totalAmount.toLocaleString()} ${state.settings.currency}</td>
                                            <td style="text-align:right;">
                                                <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                                                    <button class="btn-icon" onclick="window.generateReceipt('${p.id}')" title="Receipt (Latest Month)" style="color:var(--primary);"><i data-lucide="printer" style="width:14px;"></i></button>
                                                    <button class="btn-icon" onclick="window.editPayment('${p.id}')" title="Edit Entry"><i data-lucide="edit-3" style="width:14px;"></i></button>
                                                    <button class="btn-icon" onclick="window.deletePayment('${p.id}')" title="Delete Entry" style="color:var(--error);"><i data-lucide="trash-2" style="width:14px;"></i></button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('');
                            })()}
                        </tbody>
                    </table>
                </div>
            `;
            container.appendChild(panel);
        }
    });

    // Unassigned Payments
    const unassigned = filteredPayments.filter(pay => {
        const tenant = state.tenants.find(t => String(t.id) === String(pay.tenantId));
        const apartment = tenant ? state.apartments.find(a => String(a.id) === String(tenant.apartmentId)) : null;
        return !apartment || !apartment.propertyId;
    });

    if (unassigned.length > 0) {
        const total = unassigned.reduce((sum, p) => sum + p.amount, 0);
        const panel = document.createElement('div');
        panel.className = 'animate-slide-in';
        panel.style.cssText = "background: #FFFFFF; border: 1px dashed var(--border-light); border-radius: 20px; overflow: hidden; margin-top: 2rem; box-shadow: var(--card-shadow);";
        
        panel.innerHTML = `
            <div class="panel-trigger" onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron-icon').classList.toggle('rotate')" style="padding: 1.25rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <i data-lucide="help-circle" style="width: 18px; color: var(--secondary);"></i>
                    <span style="font-weight: bold; color: var(--secondary);">${t('unassigned')}</span>
                </div>
                 <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="font-weight: bold; color: var(--text-main); font-size: 1rem;">${total.toLocaleString()} ${state.settings.currency}</div>
                    <i data-lucide="chevron-down" class="chevron-icon" style="width: 18px; color: var(--secondary); transition: transform 0.3s ease;"></i>
                 </div>
            </div>
            <div class="panel-body hidden" style="padding: 1.25rem; border-top: 1px solid var(--border-light);">
                <table class="data-table" style="width:100%;">
                    <thead>
                        <tr>
                            <th style="border-bottom:1px solid var(--border-light); padding:1rem 0;">Tenant</th>
                            <th style="border-bottom:1px solid var(--border-light);">Month Covered</th>
                            <th style="border-bottom:1px solid var(--border-light);">Payment Date</th>
                            <th style="border-bottom:1px solid var(--border-light);">Amount</th>
                            <th style="border-bottom:1px solid var(--border-light); text-align:right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(() => {
                            const grouped = unassigned.reduce((acc, p) => {
                                const key = `${p.tenantId}-${p.date}`;
                                if (!acc[key]) {
                                    acc[key] = { ...p, monthList: [p.monthPaid], totalAmount: p.amount };
                                } else {
                                    acc[key].monthList.push(p.monthPaid);
                                    acc[key].totalAmount += p.amount;
                                }
                                return acc;
                            }, {});
                            
                            return Object.values(grouped).sort((a,b) => b.date.localeCompare(a.date)).map(p => {
                                const tenant = state.tenants.find(t => String(t.id) === String(p.tenantId));
                                const monthDisplay = p.monthList.map(m => formatMonth(m)).reverse().join(', ');
                                return `
                                    <tr class="payment-row">
                                        <td style="font-weight:600; color:var(--text-main);">${tenant ? tenant.name : 'Unknown User'}</td>
                                        <td><span class="status-pill" style="font-size: 0.75rem; background: #F5F7FA; color:var(--secondary);">${monthDisplay}</span></td>
                                        <td style="font-size: 0.85rem; color: var(--text-muted);">${p.date}</td>
                                        <td style="color:var(--success); font-weight:bold;">${p.totalAmount.toLocaleString()} ${state.settings.currency}</td>
                                        <td style="text-align:right;">
                                             <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                                                <button class="btn-icon" onclick="window.generateReceipt('${p.id}')" title="Receipt" style="color:var(--primary);"><i data-lucide="printer" style="width:14px;"></i></button>
                                                <button class="btn-icon" onclick="window.editPayment('${p.id}')" title="Edit"><i data-lucide="edit-3" style="width:14px;"></i></button>
                                                <button class="btn-icon" onclick="window.deletePayment('${p.id}')" title="Delete" style="color:var(--error);"><i data-lucide="trash-2" style="width:14px;"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('');
                        })()}
                    </tbody>
                </table>
            </div>
        `;
        container.appendChild(panel);
    }
    
    lucide.createIcons();
}

/**
 * --- Utilities Management ---
 */

function renderUtilities() {
    const container = document.getElementById('utilities-panels-container');
    if (!container) return;
    container.innerHTML = '';

    if (state.utilities.length === 0) {
        container.innerHTML = `<div class="stat-card" style="text-align:center; padding: 4rem 2rem; color: var(--text-muted);">
            <i data-lucide="zap-off" style="width: 48px; height: 48px; opacity: 0.2; margin-bottom: 1rem;"></i>
            <p>No utility service readings recorded yet.</p>
        </div>`;
        lucide.createIcons();
        return;
    }

    // Group utilities by Property
    state.properties.forEach(prop => {
        const propUtils = state.utilities.filter(u => {
            const apartment = state.apartments.find(a => String(a.id) === String(u.apartmentId));
            return apartment && String(apartment.propertyId) === String(prop.id);
        });

        if (propUtils.length > 0) {
            const panel = document.createElement('div');
            panel.className = 'stat-card animate-slide-in';
            panel.style.padding = '0';
            panel.style.overflow = 'hidden';
            
            panel.innerHTML = `
                <div style="padding: 1.25rem; background: #F9FAFB; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <i data-lucide="building-2" style="color:var(--primary); width:20px;"></i>
                        <span style="font-weight: 800; font-family: 'Outfit'; color: var(--text-main); font-size:1rem;">${prop.name}</span>
                    </div>
                    <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">SERVICE CONSUMPTION AUDIT</span>
                </div>
                <div style="padding: 1.25rem;">
                    <table class="data-table" style="width:100%;">
                        <thead>
                            <tr style="text-align:left; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">
                                <th style="padding-bottom: 1rem;">Tenant / Unit</th>
                                <th>Type</th>
                                <th>Interval Reading</th>
                                <th>Billing</th>
                                <th>Status</th>
                                <th style="text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${propUtils.map(u => {
                                const tenant = state.tenants.find(t => String(t.id) === String(u.tenantId));
                                const apt = state.apartments.find(a => String(a.id) === String(u.apartmentId));
                                const typeIcon = u.type === 'Electricity' ? 'zap' : u.type === 'Water' ? 'droplet' : 'flame';
                                const statusClass = u.status === 'Paid' ? 'paid' : 'overdue';
                                
                                return `
                                    <tr style="border-top: 1px solid #f1f1f1;">
                                        <td style="padding: 1rem 0;">
                                            <div style="font-weight: 700; color:var(--text-main); font-size:0.9rem;">${tenant ? tenant.name : 'N/A'}</div>
                                            <div style="font-size:0.7rem; color:var(--text-muted);">${apt ? apt.unitNumber : 'N/A'}</div>
                                        </td>
                                        <td>
                                            <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; font-weight:600;">
                                                <i data-lucide="${typeIcon}" style="width:14px; color:var(--secondary);"></i>
                                                ${u.type}
                                            </div>
                                        </td>
                                        <td>
                                            <div style="font-size:0.85rem;">${u.lastReading} → ${u.currentReading}</div>
                                            <div style="font-size:0.7rem; color:var(--text-muted); font-weight:500;">Month: ${formatMonth(u.month)}</div>
                                        </td>
                                        <td>
                                            <div style="font-weight: 800; color:var(--text-main);">${u.amount.toLocaleString()} ${state.settings.currency}</div>
                                            <div style="font-size:0.7rem; color:var(--text-muted);">${u.date}</div>
                                        </td>
                                        <td><span class="status-pill ${statusClass}" style="font-size:0.65rem;">${u.status}</span></td>
                                        <td style="text-align:right;">
                                            <div style="display:flex; gap:0.4rem; justify-content:flex-end;">
                                                ${u.status === 'Unpaid' ? `<button class="btn-icon" onclick="window.payUtility('${u.id}')" title="Mark as Paid" style="color:var(--success);"><i data-lucide="check-circle" style="width:16px;"></i></button>` : ''}
                                                <button class="btn-icon" onclick="window.sendUtilityReceiptEmail('${u.id}')" title="Email Receipt" style="color:#7C3AED;"><i data-lucide="mail" style="width:16px;"></i></button>
                                                <button class="btn-icon" onclick="window.deleteUtility('${u.id}')" title="Remove Entry" style="color:var(--error);"><i data-lucide="trash-2" style="width:16px;"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            container.appendChild(panel);
        }
    });

    lucide.createIcons();
}

window.openUtilityModal = () => {
    const modal = document.getElementById('modal-container');
    const form = document.getElementById('app-form');
    const title = document.getElementById('modal-title');
    
    modal.classList.add('active');
    modal.setAttribute('data-mode', 'add-utility');
    
    title.textContent = "🔌 New Service Consumption Entry";
    
    const tenantsWithRooms = state.tenants.filter(t => t.apartmentId);
    
    form.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div>
                <label>Target Portfolio Member</label>
                <select id="util-tenant" class="search-box" style="width:100%" required>
                    ${tenantsWithRooms.map(t => `<option value="${t.id}">${t.name} (Unit: ${state.apartments.find(a => a.id === t.apartmentId).unitNumber})</option>`).join('')}
                </select>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                <div>
                    <label>Utility Category</label>
                    <select id="util-type" class="search-box" style="width:100%">
                        <option>Electricity</option>
                        <option>Water</option>
                        <option>Gas</option>
                        <option>Waste Management</option>
                    </select>
                </div>
                <div>
                   <label>Billing Month</label>
                   <input type="text" id="util-month" class="search-box" value="${new Date().toISOString().slice(0, 7)}" placeholder="YYYY-MM">
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                <div>
                    <label>Previous Reading</label>
                    <input type="number" id="util-last" class="search-box" placeholder="0.00" value="0">
                </div>
                <div>
                    <label>Current Reading</label>
                    <input type="number" id="util-current" class="search-box" placeholder="0.00" value="0">
                </div>
            </div>

            <div>
                <label>Amount (Total Bill)</label>
                <input type="number" id="util-amount" class="search-box" style="width:100%" placeholder="0.00" required>
            </div>

            <div>
                <label>Reading / Billing Date</label>
                <input type="text" id="util-date" class="search-box" style="width:100%" value="${new Date().toLocaleDateString()}">
            </div>
        </div>
    `;
};

window.payUtility = async (id) => {
    try {
        await fetch(`${API_URL}/utilities/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Paid' })
        });
        const util = state.utilities.find(u => String(u.id) === String(id));
        if (util) util.status = 'Paid';
        renderUtilities();
    } catch (e) {
        console.error("Utility payment failed");
    }
};

window.deleteUtility = async (id) => {
    if (!confirm("Are you sure you want to remove this utility entry?")) return;
    try {
        await fetch(`${API_URL}/utilities/${id}`, { method: 'DELETE' });
        state.utilities = state.utilities.filter(u => String(u.id) !== String(id));
        renderUtilities();
    } catch (e) {
        console.error("Utility deletion failed");
    }
};
