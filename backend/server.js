const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const { Property, Apartment, Tenant, Payment, UnitType, Contract, Utility, Setting } = require('./models');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'Property Manager Pro API is live 🚀', status: isConnected() ? 'connected' : 'mock-mode' });
});

const MOCK_DB_PATH = path.join(__dirname, 'mock_db.json');

// Memory storage for mock mode
let mockData = {
    properties: [],
    apartments: [],
    tenants: [],
    payments: [],
    unit_types: [
        { id: 't1', name: 'Studio' },
        { id: 't2', name: 'Room' },
        { id: 't3', name: '2BR' },
        { id: 't4', name: 'House' }
    ],
    contracts: [],
    utilities: [],
    settings: { currency: '$', lang: 'en', notificationThresholdDays: 3 }
};

if (fs.existsSync(MOCK_DB_PATH)) {
    try {
        mockData = JSON.parse(fs.readFileSync(MOCK_DB_PATH, 'utf8'));
    } catch(e) { console.error("Malformed mock_db.json, using defaults."); }
}

const saveMock = () => fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(mockData, null, 2));

// Connect to MongoDB with a short timeout to prevent hanging the first request
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/property_manager', {
    serverSelectionTimeoutMS: 2000 // 2 seconds timeout for initial connection
}).then(() => {
    console.log('✅ Connected to MongoDB Backend Database');
}).catch(err => {
    console.error('❌ MongoDB Connection ERROR:', err.message);
    console.warn('⚠️ Falling back to Mock JSON Mode.');
});

const isConnected = () => mongoose.connection.readyState === 1;

app.get('/api/status', (req, res) => {
    res.json({ 
        status: isConnected() ? 'Property Manager MERN Server Online' : 'Property Manager Server (Local Mock Mode)', 
        version: '2.1.1-robust' 
    });
});

app.get('/api/data', async (req, res) => {
    try {
        if (!isConnected()) {
            console.log("Serving from Mock Logic (No DB connection)");
            return res.json(mockData);
        }
        
        const [properties, apartments, tenants, payments, settingsRows, unit_types, contracts, utilities] = await Promise.all([
            Property.find().lean(),
            Apartment.find().lean(),
            Tenant.find().lean(),
            Payment.find().sort({ date: -1 }).lean(),
            Setting.find().lean(),
            UnitType.find().lean(),
            Contract.find().lean(),
            Utility.find().lean()
        ]);
        
        const settings = {};
        settingsRows.forEach(row => settings[row.key] = row.value);
        res.json({ properties, apartments, tenants, payments, settings, unit_types, contracts, utilities });
    } catch (e) {
        console.error("Critical Backend Error:", e.message);
        // Failover to mock even on runtime error if possible
        res.json(mockData);
    }
});

// Generic Mock Handlers
const mockPOST = (key, body) => { mockData[key].push(body); saveMock(); };

// Payments
app.post('/api/payments', async (req, res) => {
    if (!isConnected()) { mockPOST('payments', req.body); return res.status(201).json({ status: 'success' }); }
    try { await Payment.create(req.body); res.status(201).json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Settings
app.post('/api/settings', async (req, res) => {
    if (!isConnected()) { mockData.settings[req.body.key] = req.body.value; saveMock(); return res.json({ status: 'success' }); }
    try { await Setting.findOneAndUpdate({ key: req.body.key }, { value: req.body.value }, { upsert: true }); res.json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Properties
app.post('/api/properties', async (req, res) => {
    if (!isConnected()) { mockPOST('properties', req.body); return res.status(201).json({ status: 'success' }); }
    try { await Property.create(req.body); res.status(201).json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/properties/:id', async (req, res) => {
    if (!isConnected()) {
        mockData.properties = mockData.properties.map(p => String(p.id) === String(req.params.id) ? { ...p, ...req.body } : p);
        saveMock(); return res.json({ status: 'success' });
    }
    try { await Property.findOneAndUpdate({ id: req.params.id }, req.body); res.json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/properties/:id', async (req, res) => {
    if (!isConnected()) {
        mockData.properties = mockData.properties.filter(p => String(p.id) !== String(req.params.id));
        // Also remove child apartments
        mockData.apartments = mockData.apartments.filter(a => String(a.propertyId) !== String(req.params.id));
        saveMock(); return res.json({ status: 'success' });
    }
    try { await Property.findOneAndDelete({ id: req.params.id }); res.json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Apartments / Units
app.post('/api/apartments', async (req, res) => {
    if (!isConnected()) { mockPOST('apartments', req.body); return res.status(201).json({ ...req.body, status: 'success' }); }
    try { const apt = await Apartment.create(req.body); res.status(201).json(apt); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/apartments/:id', async (req, res) => {
    if (!isConnected()) {
        mockData.apartments = mockData.apartments.map(a => String(a.id) === String(req.params.id) ? { ...a, ...req.body } : a);
        saveMock(); return res.json({ status: 'success' });
    }
    try { await Apartment.findOneAndUpdate({ id: req.params.id }, req.body); res.json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/apartments/:id', async (req, res) => {
    if (!isConnected()) {
        mockData.apartments = mockData.apartments.filter(a => String(a.id) !== String(req.params.id));
        saveMock(); return res.json({ status: 'success' });
    }
    try { await Apartment.findOneAndDelete({ id: req.params.id }); res.json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Tenants
app.post('/api/tenants', async (req, res) => {
    if (!isConnected()) { mockPOST('tenants', req.body); return res.status(201).json({ status: 'success' }); }
    try { await Tenant.create(req.body); res.status(201).json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tenants/:id', async (req, res) => {
    if (!isConnected()) {
        mockData.tenants = mockData.tenants.map(t => String(t.id) === String(req.params.id) ? { ...t, ...req.body } : t);
        saveMock(); return res.json({ status: 'success' });
    }
    try { await Tenant.findOneAndUpdate({ id: req.params.id }, req.body); res.json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tenants/:id', async (req, res) => {
    if (!isConnected()) {
        mockData.tenants = mockData.tenants.filter(t => String(t.id) !== String(req.params.id));
        saveMock(); return res.json({ status: 'success' });
    }
    try { await Tenant.findOneAndDelete({ id: req.params.id }); res.json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Contracts
app.post('/api/contracts', async (req, res) => {
    if (!isConnected()) { mockPOST('contracts', req.body); return res.status(201).json({ status: 'success' }); }
    try { await Contract.create(req.body); res.status(201).json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/contracts/:id', async (req, res) => {
    if (!isConnected()) {
        mockData.contracts = mockData.contracts.map(c => String(c.id) === String(req.params.id) ? { ...c, ...req.body } : c);
        saveMock(); return res.json({ status: 'success' });
    }
    try { await Contract.findOneAndUpdate({ id: req.params.id }, req.body); res.json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/contracts/:id', async (req, res) => {
    if (!isConnected()) {
        mockData.contracts = mockData.contracts.filter(c => String(c.id) !== String(req.params.id));
        saveMock(); return res.json({ status: 'success' });
    }
    try { await Contract.findOneAndDelete({ id: req.params.id }); res.json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Utilities
app.post('/api/utilities', async (req, res) => {
    if (!isConnected()) { mockPOST('utilities', req.body); return res.status(201).json({ status: 'success' }); }
    try { await Utility.create(req.body); res.status(201).json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/utilities/:id', async (req, res) => {
    if (!isConnected()) {
        mockData.utilities = mockData.utilities.map(u => String(u.id) === String(req.params.id) ? { ...u, ...req.body } : u);
        saveMock(); return res.json({ status: 'success' });
    }
    try { await Utility.findOneAndUpdate({ id: req.params.id }, req.body); res.json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/utilities/:id', async (req, res) => {
    if (!isConnected()) {
        mockData.utilities = mockData.utilities.filter(u => String(u.id) !== String(req.params.id));
        saveMock(); return res.json({ status: 'success' });
    }
    try { await Utility.findOneAndDelete({ id: req.params.id }); res.json({ status: 'success' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Enhanced Seed endpoint - Visit this in your browser to reset/populate data
app.get('/api/seed', async (req, res) => {
    const demo = {
        properties: [
            { id: 'p1', name: 'Westside Towers', address: '123 Main St, Nairobi' },
            { id: 'p2', name: 'Azure Heights', address: '45 Skyway, Kigali' },
            { id: 'p3', name: 'Riverside Villas', address: '78 River Rd, Mombasa' }
        ],
        apartments: [
            { id: 'a1', propertyId: 'p1', unitNumber: 'Apt 304', type: 'Studio' },
            { id: 'a2', propertyId: 'p1', unitNumber: 'Apt 102', type: 'Room' },
            { id: 'a3', propertyId: 'p2', unitNumber: 'Unit 12', type: 'Shop' },
            { id: 'a4', propertyId: 'p2', unitNumber: 'Unit 15', type: 'Office' },
            { id: 'a5', propertyId: 'p3', unitNumber: 'Villa 1', type: 'House' }
        ],
        tenants: [
            { id: 't1', name: 'Sarah Chen', email: 'sarah@example.com', phone: '+254 700 111222', apartmentId: 'a1', rentAmount: 2500, balance: 0 },
            { id: 't2', name: 'John Kamau', email: 'john@example.com', phone: '+254 722 333444', apartmentId: 'a2', rentAmount: 1800, balance: 0 },
            { id: 't3', name: 'Fatima Ahmed', email: 'fatima@example.com', phone: '+250 788 555666', apartmentId: 'a3', rentAmount: 9500, balance: 0 },
            { id: 't4', name: 'Robert Smith', email: 'robert@example.com', phone: '+254 755 999888', apartmentId: 'a5', rentAmount: 12000, balance: 0 }
        ],
        contracts: [
            { id: 'c1', tenantId: 't1', rentAmount: 2500, depositAmount: 2500, startDate: '2025-01-01', endDate: '2026-01-01', agreedPaymentDay: 5, status: 'Active' },
            { id: 'c2', tenantId: 't2', rentAmount: 1800, depositAmount: 1800, startDate: '2025-02-15', endDate: '2026-02-15', agreedPaymentDay: 1, status: 'Active' },
            { id: 'c3', tenantId: 't3', rentAmount: 9500, depositAmount: 9500, startDate: '2025-03-01', endDate: '2026-03-01', agreedPaymentDay: 30, status: 'Active' }
        ],
        payments: [
            { id: 'pay1', tenantId: 't1', apartmentId: 'a1', amount: 2500, monthPaid: '2026-03', date: '2026-03-05', type: 'Rent' },
            { id: 'pay2', tenantId: 't1', apartmentId: 'a1', amount: 2500, monthPaid: '2026-04', date: '2026-04-02', type: 'Rent' },
        ],
        utilities: [
            { id: 'u1', apartmentId: 'a1', tenantId: 't1', type: 'Electricity', month: '2026-03', date: '2026-03-31', lastReading: 1200, currentReading: 1350, unitsConsumed: 150, ratePerUnit: 12, amount: 1800, status: 'Paid' },
            { id: 'u2', apartmentId: 'a1', tenantId: 't1', type: 'Water', month: '2026-03', date: '2026-03-31', lastReading: 450, currentReading: 465, unitsConsumed: 15, ratePerUnit: 45, amount: 675, status: 'Unpaid' }
        ],
        settings: [
            { key: 'currency', value: 'KES' },
            { key: 'lang', value: 'en' },
            { key: 'notificationThresholdDays', value: '5' }
        ]
    };

    try {
        if (!isConnected()) {
            mockData = { ...mockData, ...demo };
            saveMock();
            return res.json({ message: 'Seeded successfully (Mock Mode)', data: demo });
        }

        // Complete database reset
        await Promise.all([
            Property.deleteMany({}),
            Apartment.deleteMany({}),
            Tenant.deleteMany({}),
            Contract.deleteMany({}),
            Payment.deleteMany({}),
            Utility.deleteMany({}),
            Setting.deleteMany({})
        ]);

        await Promise.all([
            Property.insertMany(demo.properties),
            Apartment.insertMany(demo.apartments),
            Tenant.insertMany(demo.tenants),
            Contract.insertMany(demo.contracts),
            Payment.insertMany(demo.payments),
            Utility.insertMany(demo.utilities),
            Setting.insertMany(demo.settings)
        ]);

        res.json({ status: 'success', message: 'MERN Cloud Database seeded successfully!', data: demo });
    } catch (e) { 
        console.error('Seed Error:', e);
        res.status(500).json({ error: e.message }); 
    }
});

// SMTP Settings and Send Receipt
app.post('/api/send-receipt', async (req, res) => {
    const { to, subject, body } = req.body;
    console.log(`📧 [RECEIPT] To: ${to} | Subject: ${subject}`);
    res.json({ status: 'success', message: `Receipt simulated for ${to}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 MERN Backend running on port ${PORT}`));
