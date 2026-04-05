/**
 * Aura Property Manager | Core Logic
 */
console.log("Aura core logic initialized.");

// Initial State and Storage Key
const STORAGE_KEY = 'aura_property_manager_data';
const initialState = {
    properties: [],
    apartments: [],
    tenants: [],
    payments: [],
    unit_types: [],
    contracts: [],
    utilities: [],
    settings: {
        currency: '$',
        lang: 'en',
        notificationThresholdDays: 3
    }
};

const translations = {
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

function t(key) {
    const lang = state.settings.lang || 'en';
    return translations[lang][key] || key;
}

function formatMonth(monthStr) {
    if (!monthStr || !monthStr.includes('-')) return monthStr;
    const [year, month] = monthStr.split('-');
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthKey = months[parseInt(month) - 1];
    return t(monthKey);
}

function applyTranslations() {
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        el.textContent = t(key);
    });
}

let currentEditId = null; // Tracks current entity being edited
let state = initialState;

const API_URL = 'http://localhost:3000/api';

async function loadState() {
    try {
        const response = await fetch(`${API_URL}/data`);
        if (response.ok) {
            const data = await response.json();
            state.properties = data.properties || [];
            state.apartments = data.apartments || [];
            state.tenants = data.tenants || [];
            state.payments = data.payments || [];
            state.unit_types = data.unit_types || [];
            state.contracts = data.contracts || [];
            state.utilities = data.utilities || [];
            if (data.settings) {
                state.settings = { ...state.settings, ...data.settings };
            }
            updateDashboard();
        }
    } catch (e) {
        console.warn("DB Server not found. Falling back to local cache.");
        const data = localStorage.getItem(STORAGE_KEY);
        state = data ? JSON.parse(data) : initialState;
        // Ensure arrays exist even in fallback
        state.properties = state.properties || [];
        state.apartments = state.apartments || [];
        state.tenants = state.tenants || [];
        updateDashboard();
    }
}

async function saveState(type, data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); // Always cache locally
    try {
        if (type === 'property') {
            await fetch(`${API_URL}/properties`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else if (type === 'edit-property') {
            await fetch(`${API_URL}/properties/${data.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else if (type === 'tenant') {
            await fetch(`${API_URL}/tenants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else if (type === 'apartment') {
            await fetch(`${API_URL}/apartments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else if (type === 'contract') {
            await fetch(`${API_URL}/contracts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else if (type === 'edit-contract') {
            await fetch(`${API_URL}/contracts/${data.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else if (type === 'edit-tenant') {
            await fetch(`${API_URL}/tenants/${data.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
    } catch (e) {
        console.error("DB Save failed:", e);
    }
    await loadState(); // Force-sync to ensure all views have the latest DB state
}
