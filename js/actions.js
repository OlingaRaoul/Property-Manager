// --- Global Actions (Exposed to window for inline onclick) ---

window.addApartment = (propertyId) => {
    showModal('apartment', propertyId);
};

window.editProperty = (id) => {
    showModal('edit-property', id);
};

window.editTenant = (id) => {
    showModal('edit-tenant', id);
};

window.deleteTenant = async (id) => {
    const t = state.tenants.find(tenant => tenant.id === id);
    if (!t) return;
    
    if (confirm(`⚠️ Move Out: Are you sure you want to Move Out ${t.name}? Their record will be kept, but the room will be marked VACANT.`)) {
        try {
            const index = state.tenants.findIndex(ten => ten.id === id);
            state.tenants[index].apartmentId = null; // Unassign from room
            await saveState('edit-tenant', state.tenants[index]);
            updateDashboard();
            alert('Tenant moved out successfully. Room is now vacant.');
        } catch (e) {
            console.error("Action failed.");
        }
    }
};

window.permanentlyDeleteTenant = async (id) => {
    const t = state.tenants.find(tenant => tenant.id === id);
    if (confirm(`⚠️ DELETE: Permanently remove ${t.name} and all their records?`)) {
        try {
            await fetch(`${API_URL}/tenants/${id}`, { method: 'DELETE' });
            state.tenants = state.tenants.filter(ten => ten.id !== id);
            saveState();
            updateDashboard();
        } catch (e) { console.error("Delete failed."); }
    }
};

window.deleteProperty = async (id) => {
    const p = state.properties.find(prop => prop.id === id);
    if (!p) return;
    
    if (confirm(`⚠️ Confirmation: Are you sure you want to delete ${p.name}? This will also remove any linked tenants.`)) {
        try {
            await fetch(`${API_URL}/properties/${id}`, { method: 'DELETE' });
            state.properties = state.properties.filter(prop => prop.id !== id);
            state.tenants = state.tenants.filter(t => t.propertyId !== id);
            saveState(); // Update local cache
            renderProperties();
            alert('Property deleted successfully.');
        } catch (e) {
            console.error("Delete failed.");
        }
    }
};

window.updatePayTotalGrid = (rent) => {
    const checked = document.querySelectorAll('input[name="selected-months"]:checked:not(:disabled)');
    const total = checked.length * rent;
    const display = document.getElementById('total-display');
    if (display) display.textContent = `${total.toLocaleString()} ${state.settings.currency}`;
    const valInput = document.getElementById('pay-total-val');
    if (valInput) valInput.value = total;
};

function nextMonth(monthStr) {
    if (!monthStr || !monthStr.includes('-')) return new Date().toISOString().slice(0, 7);
    let [year, month] = monthStr.split('-').map(Number);
    month++;
    if (month > 12) {
        month = 1;
        year++;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
}

window.markAsPaid = async (tenantId) => {
    const tenant = state.tenants.find(t => String(t.id) === String(tenantId));
    if (!tenant) return;
    
    // Deep audit of payments to identify already paid months
    const tenantPayments = state.payments.filter(p => String(p.tenantId) === String(tenantId));
    const monthsToDisplay = [];
    let cur = new Date().toISOString().slice(0, 7); // Start from current month
    // Go back some months to show recent history too in the selection
    let backCur = new Date();
    backCur.setMonth(backCur.getMonth() - 2);
    let startPoint = backCur.toISOString().slice(0, 7);
    
    let genMonth = startPoint;
    for (let i = 0; i < 15; i++) {
        const isPaid = tenantPayments.some(p => p.monthPaid === genMonth);
        monthsToDisplay.push({ month: genMonth, isPaid });
        genMonth = nextMonth(genMonth);
    }
    
    const modal = document.getElementById('modal-container');
    const form = document.getElementById('app-form');
    const title = document.getElementById('modal-title');
    
    modal.classList.add('active');
    modal.setAttribute('data-mode', 'receive-payment-grid');
    modal.setAttribute('data-target', tenantId);
    
    title.textContent = "💸 Select Months for Collection";
    form.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div style="background: rgba(59, 130, 246, 0.05); padding: 1rem; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.1);">
                <p style="margin:0; font-size: 0.8rem; color: var(--text-muted); text-transform:uppercase;">Tenant Portfolio</p>
                <h3 style="margin:0; font-family: 'Outfit'; color: var(--primary);">${tenant.name}</h3>
                <p style="margin:0; font-size: 0.9rem; font-weight: 600;">Monthly Rent: ${tenant.rentAmount.toLocaleString()} ${state.settings.currency}</p>
            </div>
            
            <label style="margin-bottom: -0.75rem;">Select Payment Months (Uncheck to skip)</label>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; max-height: 220px; overflow-y: auto; padding: 0.75rem; background: #f9fafb; border-radius: 12px; border:1px solid #eee;">
                ${monthsToDisplay.map(m => `
                    <div style="display:flex; align-items:center; gap:0.5rem; padding: 0.6rem; border-radius: 8px; border: 1px solid #eee; background: ${m.isPaid ? '#f1f1f1' : '#fff'}; cursor: ${m.isPaid ? 'not-allowed' : 'pointer'}; opacity: ${m.isPaid ? '0.7' : '1'};">
                        <input type="checkbox" name="selected-months" value="${m.month}" ${m.isPaid ? 'disabled checked' : ''} onchange="window.updatePayTotalGrid(${tenant.rentAmount})" style="width:16px; height:16px;">
                        <span style="font-size: 0.8rem; font-weight: 500; color: ${m.isPaid ? '#999' : '#333'}">${formatMonth(m.month)} ${m.month.slice(0,4)}</span>
                    </div>
                `).join('')}
            </div>
            
            <div>
                <label>Transaction Date Asset Recorded</label>
                <input type="text" id="pay-date-manual" class="search-box" style="width:100%" value="${new Date().toLocaleDateString()}" placeholder="MM/DD/YYYY">
            </div>

            <div style="background: #e6fffa; padding: 1rem; border-radius: 12px; border: 1px solid #38b2ac; display:flex; justify-content: space-between; align-items:center;">
                <span style="font-weight: 600; color: #234e52;">TOTAL COLLECTION</span>
                <span style="font-size: 1.25rem; font-weight: 800; color: #234e52;" id="total-display">0 ${state.settings.currency}</span>
                <input type="hidden" id="pay-total-val" value="0">
            </div>
        </div>
    `;
};

window.openGlobalPaymentModal = () => {
    const modal = document.getElementById('modal-container');
    const form = document.getElementById('app-form');
    const title = document.getElementById('modal-title');
    
    modal.classList.add('active');
    modal.setAttribute('data-mode', 'receive-payment-grid');
    modal.setAttribute('data-target', ''); // Initially empty
    
    title.textContent = "💸 Global Rent Collection";
    
    const activeTenants = state.tenants.filter(t => t.apartmentId).sort((a,b) => a.name.localeCompare(b.name));
    
    form.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div>
                <label>Identify Portfolio Member</label>
                <select id="global-pay-tenant" class="search-box" style="width:100%" onchange="window.updateGlobalPayContext(this.value)">
                    <option value="">Select Portfolio Member...</option>
                    ${activeTenants.map(t => `<option value="${t.id}">${t.name} (Rent: ${t.rentAmount})</option>`).join('')}
                </select>
            </div>
            
            <div id="global-pay-context-container" style="min-height: 250px; transition: opacity 0.3s; opacity: 0.5; pointer-events: none; border: 1px dashed var(--border-light); border-radius: 12px; display:flex; align-items:center; justify-content:center;">
                <p style="text-align:center; color: var(--text-muted); font-size: 0.9rem;">Select a tenant above to identify collection months.</p>
            </div>

            <div style="background: #e6fffa; padding: 1rem; border-radius: 12px; border: 1px solid #38b2ac; display:flex; justify-content: space-between; align-items:center;">
                <span style="font-weight: 600; color: #234e52;">TOTAL COLLECTION</span>
                <span style="font-size: 1.25rem; font-weight: 800; color: #234e52;" id="total-display">0 ${state.settings.currency}</span>
                <input type="hidden" id="pay-total-val" value="0">
            </div>
        </div>
    `;
};

window.updateGlobalPayContext = (tenantId) => {
    const container = document.getElementById('global-pay-context-container');
    const modal = document.getElementById('modal-container');
    modal.setAttribute('data-target', tenantId);
    
    if (!tenantId) {
        container.style.opacity = '0.5';
        container.style.pointerEvents = 'none';
        container.innerHTML = `<p style="text-align:center; color: var(--text-muted); font-size: 0.9rem;">Select a tenant above to identify collection months.</p>`;
        return;
    }
    
    const tenant = state.tenants.find(t => String(t.id) === String(tenantId));
    if (!tenant) return;
    
    container.style.opacity = '1';
    container.style.pointerEvents = 'all';
    container.style.display = 'block';
    container.style.border = 'none';
    
    const tenantPayments = state.payments.filter(p => String(p.tenantId) === String(tenantId));
    const monthsToDisplay = [];
    let backCur = new Date();
    backCur.setMonth(backCur.getMonth() - 2);
    let genMonth = backCur.toISOString().slice(0, 7);
    
    for (let i = 0; i < 15; i++) {
        const isPaid = tenantPayments.some(p => p.monthPaid === genMonth);
        monthsToDisplay.push({ month: genMonth, isPaid });
        genMonth = nextMonth(genMonth);
    }

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
            <label style="margin-bottom: -0.5rem;">Select Months for ${tenant.name}</label>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; max-height: 220px; overflow-y: auto; padding: 0.75rem; background: #f9fafb; border-radius: 12px; border:1px solid #eee;">
                ${monthsToDisplay.map(m => `
                    <div style="display:flex; align-items:center; gap:0.5rem; padding: 0.6rem; border-radius: 8px; border: 1px solid #eee; background: ${m.isPaid ? '#f1f1f1' : '#fff'}; cursor: ${m.isPaid ? 'not-allowed' : 'pointer'}; opacity: ${m.isPaid ? '0.7' : '1'};">
                        <input type="checkbox" name="selected-months" value="${m.month}" ${m.isPaid ? 'disabled checked' : ''} onchange="window.updatePayTotalGrid(${tenant.rentAmount})" style="width:16px; height:16px;">
                        <span style="font-size: 0.8rem; font-weight: 500; color: ${m.isPaid ? '#999' : '#333'}">${formatMonth(m.month)} ${m.month.slice(0,4)}</span>
                    </div>
                `).join('')}
            </div>
            
            <div>
                <label>Payment Execution Date</label>
                <input type="text" id="pay-date-manual" class="search-box" style="width:100%" value="${new Date().toLocaleDateString()}" placeholder="MM/DD/YYYY">
            </div>
        </div>
    `;
    window.updatePayTotalGrid(tenant.rentAmount);
};

window.deletePayment = async (id) => {
    const pay = state.payments.find(p => String(p.id) === String(id));
    if (!pay) return;
    
    if (confirm(`💸 Ledger Audit: Are you sure you want to delete this payment entry of ${pay.amount.toLocaleString()} ${state.settings.currency}?`)) {
        try {
            await fetch(`${API_URL}/payments/${id}`, { method: 'DELETE' });
            state.payments = state.payments.filter(p => String(p.id) !== String(id));
            
            const tenantObj = state.tenants.find(t => String(t.id) === String(pay.tenantId));
            if (tenantObj && tenantObj.lastPaidMonth === pay.monthPaid) {
               const remainingPays = state.payments.filter(p => String(p.tenantId) === String(pay.tenantId));
               tenantObj.lastPaidMonth = remainingPays.length > 0 ? remainingPays[0].monthPaid : '';
               await fetch(`${API_URL}/tenants/${tenantObj.id}/pay`, {
                   method: 'PATCH',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ lastPaidMonth: tenantObj.lastPaidMonth })
               });
            }
            updateDashboard();
        } catch (e) { console.error("Payment deletion failed."); }
    }
};

window.editPayment = (id) => {
    // We reuse the existing modal for editing payment
    const pay = state.payments.find(p => String(p.id) === String(id));
    if (!pay) return;
    
    const modal = document.getElementById('modal-container');
    const form = document.getElementById('app-form');
    const title = document.getElementById('modal-title');
    
    modal.classList.add('active');
    modal.setAttribute('data-mode', 'edit-payment');
    modal.setAttribute('data-target', id);
    
    title.textContent = "⚙️ Edit Transaction";
    form.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div>
                <label>Amount Paid</label>
                <input type="number" id="pay-amount" class="search-box" style="width:100%" value="${pay.amount}" required>
            </div>
            <div>
                <label>Date of Transaction</label>
                <input type="text" id="pay-date" class="search-box" style="width:100%" value="${pay.date}" placeholder="MM/DD/YYYY">
            </div>
            <div>
                <label>Month Covered (YYYY-MM)</label>
                <input type="text" id="pay-month" class="search-box" style="width:100%" value="${pay.monthPaid}" placeholder="2024-01">
            </div>
        </div>
    `;
};

window.generateReceipt = (id) => {
    const pay = state.payments.find(p => String(p.id) === String(id));
    if (!pay) return;
    
    const tenant = state.tenants.find(t => String(t.id) === String(pay.tenantId));
    const apartment = tenant ? state.apartments.find(a => String(a.id) === String(tenant.apartmentId)) : null;
    const property = apartment ? state.properties.find(p => String(p.id) === String(apartment.propertyId)) : null;
    
    const modal = document.getElementById('modal-container');
    const form = document.getElementById('app-form');
    const title = document.getElementById('modal-title');
    
    modal.classList.add('active');
    modal.setAttribute('data-mode', 'receipt');
    
    title.textContent = "🏆 Payment Receipt";
    form.innerHTML = `
        <div id="printable-area" style="background:#fff; color:#333; padding:2rem; border-radius:12px; border:1px solid #eee; font-family: 'Inter', sans-serif;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2rem; border-bottom:2px solid var(--primary); padding-bottom:1rem;">
                <div>
                    <h2 style="color:var(--primary); margin:0; font-family: 'Outfit'; font-weight:700;">${property ? property.name : 'Property Manager Admin'}</h2>
                    <p style="margin:0; font-size:0.8rem; color:#666;">${property ? property.address : 'Official Rental Receipt'}</p>
                </div>
                <div style="text-align:right;">
                    <h3 style="margin:0; color:#333; font-weight:700;">RENT RECEIPT</h3>
                    <p style="margin:0; font-size:0.8rem; color:#666;">No: #${pay.id.slice(-6)}</p>
                </div>
            </div>
            
            <div style="margin-bottom:2rem; display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
                <div>
                    <p style="margin:0; font-size:0.7rem; text-transform:uppercase; color:#888;">Received From:</p>
                    <p style="margin:0; font-size:1rem; font-weight:600;">${tenant ? tenant.name : 'Unknown'}</p>
                    <p style="margin:0; font-size:0.85rem; color:#444;">${apartment ? apartment.unitNumber : 'N/A'}</p>
                </div>
                <div style="text-align:right;">
                    <p style="margin:0; font-size:0.7rem; text-transform:uppercase; color:#888;">Payment Date:</p>
                    <p style="margin:0; font-size:1rem; font-weight:600;">${pay.date}</p>
                </div>
            </div>
            
            <table style="width:100%; border-collapse:collapse; margin-bottom:2rem;">
                <thead>
                    <tr style="background:#f9fafb; text-align:left;">
                        <th style="padding:1rem; border:1px solid #eee; font-size:0.8rem; font-weight:700; text-transform:uppercase; color:#666;">Transaction Details</th>
                        <th style="padding:1rem; border:1px solid #eee; text-align:right; font-size:0.8rem; font-weight:700; text-transform:uppercase; color:#666;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding:1rem; border:1px solid #eee;">
                            <div style="font-weight:600;">Rent Payment</div>
                            <div style="font-size:0.85rem; color:#666;">Period Covered: ${pay.monthPaid}</div>
                        </td>
                        <td style="padding:1rem; border:1px solid #eee; text-align:right; font-weight:700; font-size:1.1rem;">${pay.amount.toLocaleString()} ${state.settings.currency}</td>
                    </tr>
                </tbody>
            </table>
            
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <div>
                     <p style="font-size:0.75rem; color:#999; font-style:italic;">Note: This is a computer-generated receipt.</p>
                </div>
                <div style="text-align:right; background: #fdfdfd; padding:1rem; border-radius:10px; border:1px dashed #ddd;">
                    <p style="font-size:0.7rem; margin:0; text-transform:uppercase; color:#888;">Grand Total Received</p>
                    <h2 style="margin:0; color:var(--success); font-family: 'Outfit'; font-weight:800;">${pay.amount.toLocaleString()} ${state.settings.currency}</h2>
                </div>
            </div>
        </div>
        <div style="margin-top:2rem; display:flex; gap:1rem; justify-content:center; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="window.printReceipt()" style="gap:0.75rem;"><i data-lucide="printer"></i> Print / PDF</button>
            ${tenant && tenant.email ? `<button class="btn" onclick="window.sendRentReceiptEmail('${pay.id}')" style="gap:0.75rem; background: linear-gradient(135deg,#4F46E5,#7C3AED); color:#fff; border:none; border-radius:50px; padding:0.6rem 1.5rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="mail"></i> Email to ${tenant.email}</button>` : '<span style="font-size:0.8rem; color:var(--text-muted); align-self:center;">⚠️ No email on file – edit tenant to add one.</span>'}
            <button class="btn btn-secondary" onclick="document.getElementById('modal-container').classList.remove('active')">Dismiss</button>
        </div>
    `;
    lucide.createIcons();
};

window.printReceipt = () => {
    const printContent = document.getElementById('printable-area').innerHTML;
    const win = window.open('', '_blank', 'width=800,height=900');
    win.document.write(`
        <html>
            <head>
                <title>Property Manager Admin Receipt</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@700;800&display=swap" rel="stylesheet">
                <style>
                    :root { --primary: #2D60FF; --success: #41D433; }
                    body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; }
                </style>
            </head>
            <body>
                ${printContent}
                <script>
                    window.onload = () => { window.print(); window.close(); };
                </script>
            </body>
        </html>
    `);
    win.document.close();
};
