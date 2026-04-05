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
    console.warn('⚠️ MongoDB Connection Failed. Backend will use Mock JSON Mode.');
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

// Utility Seed endpoint
app.post('/api/seed', async (req, res) => {
    const demo = {
        properties: [
            { id: 'p1', name: 'Westside Towers', address: '123 Main St' },
            { id: 'p2', name: 'Azure Heights', address: '45 Skyway' }
        ],
        apartments: [
            { id: 'a1', propertyId: 'p1', unitNumber: 'Apt 304', type: 'Studio' },
            { id: 'a2', propertyId: 'p1', unitNumber: 'Apt 102', type: 'Room' }
        ],
        tenants: [
            { id: 't1', name: 'Sarah Chen', apartmentId: 'a1', rentAmount: 2850, dueDateDay: 1, lastPaidMonth: '2026-04' }
        ]
    };
    if (!isConnected()) {
        mockData = { ...mockData, ...demo };
        saveMock();
        return res.json({ message: 'Seeded successfully (Mock Mode)' });
    }
    try {
        await Property.deleteMany({});
        await Apartment.deleteMany({});
        await Tenant.deleteMany({});
        await Property.insertMany(demo.properties);
        await Apartment.insertMany(demo.apartments);
        await Tenant.insertMany(demo.tenants);
        res.json({ message: 'Seeded successfully (Mongo Mode)' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// SMTP Settings and Send Receipt
app.post('/api/send-receipt', async (req, res) => {
    const { to, subject, body } = req.body;
    console.log(`📧 [RECEIPT] To: ${to} | Subject: ${subject}`);
    res.json({ status: 'success', message: `Receipt simulated for ${to}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 MERN Backend running on port ${PORT}`));
