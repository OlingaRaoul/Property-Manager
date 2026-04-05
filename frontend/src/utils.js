export const translations = {
    en: {
        dashboard: "Dashboard",
        properties: "Properties",
        tenants: "Tenants",
        payments: "Payments",
        settings: "Settings",
        active_tenants: "Active Tenants",
        collected_rent: "Collected Rent",
        rent_due: "Total Due",
        recent_activity: "Recent Activity",
        tenant: "Tenant",
        unit: "Unit",
        due_date: "Due Date",
        amount: "Amount",
        status: "Status",
        actions: "Actions",
        paid: "Paid",
        overdue: "Overdue",
        due_soon: "Due Soon",
        upcoming: "Upcoming",
        move_out: "Move Out",
        edit: "Edit",
        add_property: "Add Property",
        add_tenant: "Add Tenant",
        save: "Save",
        cancel: "Cancel",
        lang_sel: "Application Language",
        currency_sel: "Currency Symbol",
        total_revenue: "Lifetime Revenue",
        currently_due: "Currently Due",
        recent_history: "Recent History",
        property_label: "Property",
        add_unit: "Add Unit",
        vacant: "Vacant",
        inventory: "Apartment Inventory",
        unassigned: "Unassigned",
        no_room: "No Room Assigned",
        Room: "Room",
        Studio: "Studio",
        unit_types_title: "Managed Unit Categories",
        add_type: "Add Category",
        type_name: "Category Name",
        cat_placeholder: "e.g. Warehouse",
        contracts: "Contracts",
        add_contract: "New Contract",
        start_date: "Start Date",
        end_date: "End Date",
        active: "Active",
        expired: "Expired",
        leasing: "Lease Management",
        edit_contract: "Edit Contract",
        day: "Day",
        jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", may: "May", jun: "Jun",
        jul: "Jul", aug: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dec: "Dec"
    },
    fr: {
        dashboard: "Tableau de bord",
        properties: "Propriétés",
        tenants: "Locataires",
        payments: "Paiements",
        settings: "Paramètres",
        active_tenants: "Locataires Actifs",
        collected_rent: "Loyer Collecté",
        rent_due: "Loyer Dû",
        recent_activity: "Activité Récente",
        tenant: "Locataire",
        unit: "Unité",
        due_date: "Date d'échéance",
        amount: "Montant",
        status: "Statut",
        actions: "Actions",
        paid: "Payé",
        overdue: "En retard",
        due_soon: "Bientôt dû",
        upcoming: "À venir",
        move_out: "Déménager",
        edit: "Modifier",
        add_property: "Ajouter la propriété",
        add_tenant: "Ajouter un locataire",
        save: "Enregistrer",
        cancel: "Annuler",
        lang_sel: "Langue de l'application",
        currency_sel: "Symbole Monétaire",
        total_revenue: "Revenu Total",
        currently_due: "Actuellement Dû",
        recent_history: "Historique Récent",
        property_label: "Propriété",
        add_unit: "Ajouter l'unité",
        vacant: "Vacant",
        inventory: "Inventaire des Appartements",
        unassigned: "Non assigné",
        no_room: "Sans pièce",
        Room: "Chambre",
        Studio: "Studio",
        unit_types_title: "Catégories d'unités gérées",
        add_type: "Ajouter une catégorie",
        type_name: "Nom de la catégorie",
        cat_placeholder: "ex: Entrepôt",
        contracts: "Contrats",
        add_contract: "Nouveau Contrat",
        start_date: "Date de début",
        end_date: "Date de fin",
        active: "Actif",
        expired: "Expiré",
        leasing: "Gestion des Baux",
        edit_contract: "Modifier le Contrat",
        day: "Jour",
        jan: "Janv", feb: "Févr", mar: "Mars", apr: "Avril", may: "Mai", jun: "Juin",
        jul: "Juil", aug: "Août", sep: "Sept", oct: "Oct", nov: "Nov", dec: "Déc"
    }
};

export function t(key, lang = 'en') {
    return translations[lang][key] || key;
}

export function formatMonth(monthStr, lang = 'en') {
    if (!monthStr || !monthStr.includes('-')) return monthStr;
    const [year, month] = monthStr.split('-');
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthKey = months[parseInt(month) - 1];
    return t(monthKey, lang);
}

export function calculateRentStatus(tenant, settings) {
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
    const currentDay = today.getDate();
    const lang = settings.lang || 'en';
    
    // Check if paid this month
    if (tenant.lastPaidMonth === currentMonthStr) {
        return { status: t('paid', lang), class: 'paid', message: t('paid', lang) };
    }
    
    // Check if due or overdue
    if (currentDay > tenant.dueDateDay) {
        return { status: t('overdue', lang), class: 'overdue', message: t('overdue', lang) };
    }
    
    // If within threshold before due date
    if (tenant.dueDateDay - currentDay <= (settings.notificationThresholdDays || 3)) {
        return { status: t('due_soon', lang), class: 'due', message: `${t('due_date', lang)} ${tenant.dueDateDay}` };
    }
    
    return { status: t('upcoming', lang), class: '', message: `${t('due_date', lang)} ${tenant.dueDateDay}` };
}
