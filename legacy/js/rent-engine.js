// --- Rent Calculation Engine ---

function calculateRentStatus(tenant) {
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
    const currentDay = today.getDate();
    
    // Check if paid this month
    if (tenant.lastPaidMonth === currentMonthStr) {
        return { status: t('paid'), class: 'paid', message: t('paid') };
    }
    
    // Check if due or overdue
    if (currentDay > tenant.dueDateDay) {
        return { status: t('overdue'), class: 'overdue', message: t('overdue') };
    }
    
    // If within threshold before due date
    if (tenant.dueDateDay - currentDay <= state.settings.notificationThresholdDays) {
        return { status: t('due_soon'), class: 'due', message: `${t('due_date')} ${tenant.dueDateDay}` };
    }
    
    return { status: t('upcoming'), class: '', message: `${t('due_date')} ${tenant.dueDateDay}` };
}
