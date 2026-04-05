// --- View Rendering ---

function switchView(viewId) {
    const view = document.getElementById(`${viewId}-view`);
    if (!view) {
        console.warn(`Work in Progress: The ${viewId} view is coming soon!`);
        return;
    }
    
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    view.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-view') === viewId) {
            item.classList.add('active');
        }
    });

    const titleMap = {
        'dashboard': t('dashboard'),
        'properties': t('properties'),
        'tenants': t('tenants'),
        'payments': t('payments'),
        'settings': t('settings'),
        'utilities': 'Utilities'
    };
    document.getElementById('view-title').textContent = titleMap[viewId] || 'Property Manager Admin';
    
    // Refresh content
    if (viewId === 'dashboard') renderRecentTenants();
    if (viewId === 'properties') renderProperties();
    if (viewId === 'tenants') renderTenants();
    if (viewId === 'payments') renderPayments();
    if (viewId === 'contracts') renderContracts();
    if (viewId === 'settings') renderUnitTypesSettings();
    if (viewId === 'utilities') renderUtilities();
    
    applyTranslations();
}
