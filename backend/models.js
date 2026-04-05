const mongoose = require('mongoose');

// Property Schema
const PropertySchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    address: { type: String }
});

// Apartment Schema
const ApartmentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    propertyId: { type: String, ref: 'Property' },
    unitNumber: { type: String, required: true },
    type: { type: String }
});

// Tenant Schema
const TenantSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    apartmentId: { type: String, ref: 'Apartment' },
    rentAmount: { type: Number, default: 0 },
    dueDateDay: { type: Number, default: 1 },
    lastPaidMonth: { type: String, default: "" }
});

// Payment Schema
const PaymentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    tenantId: { type: String, ref: 'Tenant' },
    amount: { type: Number, default: 0 },
    date: { type: String },
    monthPaid: { type: String }
});

// UnitType Schema
const UnitTypeSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true }
});

// Contract Schema
const ContractSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    tenantId: { type: String, ref: 'Tenant' },
    startDate: { type: String },
    endDate: { type: String },
    terms: { type: String },
    status: { type: String }
});

// Utility Schema
const UtilitySchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    apartmentId: { type: String, ref: 'Apartment' },
    tenantId: { type: String, ref: 'Tenant' },
    type: { type: String, required: true },
    lastReading: { type: Number, default: 0 },
    currentReading: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    date: { type: String },
    status: { type: String, default: 'Unpaid' },
    month: { type: String }
});

// Setting Schema
const SettingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: String }
});

module.exports = {
    Property: mongoose.model('Property', PropertySchema),
    Apartment: mongoose.model('Apartment', ApartmentSchema),
    Tenant: mongoose.model('Tenant', TenantSchema),
    Payment: mongoose.model('Payment', PaymentSchema),
    UnitType: mongoose.model('UnitType', UnitTypeSchema),
    Contract: mongoose.model('Contract', ContractSchema),
    Utility: mongoose.model('Utility', UtilitySchema),
    Setting: mongoose.model('Setting', SettingSchema)
};
