const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const { User, Property, Apartment, Tenant, Payment, UnitType, Contract, Utility, Setting } = require('./models');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'pm_super_secret_key_2026';

app.get('/', (req, res) => {
    res.json({ message: 'Property Manager Pro API is live 🚀', status: isConnected() ? 'connected' : 'mock-mode' });
});

const MOCK_DB_PATH = path.join(__dirname, 'mock_db.json');

// Memory storage for mock mode
let mockData = {
    users: [],
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
        if (!mockData.users) mockData.users = [];
        if (!mockData.unit_types) {
            mockData.unit_types = [
                { id: 't1', name: 'Studio' },
                { id: 't2', name: 'Room' },
                { id: 't3', name: '2BR' },
                { id: 't4', name: 'House' }
            ];
        }
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

// Database legacy data auto-migration helper
const migrateLegacyData = async (defaultUserId) => {
    try {
        if (isConnected()) {
            const result = await Property.updateMany({ userId: { $exists: false } }, { userId: defaultUserId });
            const settingsResult = await Setting.updateMany({ userId: { $exists: false } }, { userId: defaultUserId });
            if (result.modifiedCount > 0) {
                console.log(`[MIGRATION] Assigned ${result.modifiedCount} legacy properties in MongoDB to User: ${defaultUserId}`);
            }
        } else {
            let count = 0;
            mockData.properties = mockData.properties.map(p => {
                if (!p.userId) {
                    count++;
                    return { ...p, userId: defaultUserId };
                }
                return p;
            });
            if (count > 0) {
                saveMock();
                console.log(`[MIGRATION] Assigned ${count} legacy properties in Mock DB to User: ${defaultUserId}`);
            }
        }
    } catch (e) {
        console.error("Migration error:", e.message);
    }
};

// Authentication Middleware
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization token required.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
    }
};

app.get('/api/status', (req, res) => {
    res.json({ 
        status: isConnected() ? 'Property Manager MERN Server Online' : 'Property Manager Server (Local Mock Mode)', 
        version: '2.5.0-multitenant' 
    });
});

// ── Authentication Endpoints ──────────────────────────────────────────

app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    const lowercaseEmail = email.toLowerCase().trim();
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = `u${Date.now()}`;

        if (!isConnected()) {
            const exists = mockData.users.find(u => u.email === lowercaseEmail);
            if (exists) return res.status(400).json({ error: 'Email already registered.' });
            
            const newUser = { id, name, email: lowercaseEmail, password: hashedPassword };
            mockData.users.push(newUser);
            mockData.settings[`currency_${id}`] = 'FCFA';
            mockData.settings[`lang_${id}`] = 'en';
            mockData.settings[`notificationThresholdDays_${id}`] = 3;
            saveMock();

            // Run migration if this is the first user ever registered
            if (mockData.users.length === 1) {
                await migrateLegacyData(id);
            }

            const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
            return res.status(201).json({ status: 'success', token, user: { id, name, email: lowercaseEmail } });
        } else {
            const exists = await User.findOne({ email: lowercaseEmail });
            if (exists) return res.status(400).json({ error: 'Email already registered.' });

            const newUser = await User.create({ id, name, email: lowercaseEmail, password: hashedPassword });
            
            // Seed default settings for the user
            await Setting.insertMany([
                { key: 'currency', value: 'FCFA', userId: newUser.id },
                { key: 'lang', value: 'en', userId: newUser.id },
                { key: 'notificationThresholdDays', value: '3', userId: newUser.id }
            ]);
            
            const userCount = await User.countDocuments();
            if (userCount === 1) {
                await migrateLegacyData(newUser.id);
            }

            const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
            return res.status(201).json({ status: 'success', token, user: { id, name, email: lowercaseEmail } });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    const lowercaseEmail = email.toLowerCase().trim();
    try {
        if (!isConnected()) {
            const user = mockData.users.find(u => u.email === lowercaseEmail);
            if (!user) return res.status(400).json({ error: 'Invalid email or password.' });

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ error: 'Invalid email or password.' });

            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ status: 'success', token, user: { id: user.id, name: user.name, email: lowercaseEmail } });
        } else {
            const user = await User.findOne({ email: lowercaseEmail });
            if (!user) return res.status(400).json({ error: 'Invalid email or password.' });

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ error: 'Invalid email or password.' });

            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ status: 'success', token, user: { id: user.id, name: user.name, email: lowercaseEmail } });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Data Hydration Endpoint ───────────────────────────────────────────

app.get('/api/data', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const properties = mockData.properties.filter(p => p.userId === req.userId);
            const propIds = properties.map(p => p.id);

            const apartments = mockData.apartments.filter(a => propIds.includes(a.propertyId));
            const aptIds = apartments.map(a => a.id);

            const tenants = mockData.tenants.filter(t => aptIds.includes(t.apartmentId));
            const tenantIds = tenants.map(t => t.id);

            const payments = mockData.payments.filter(p => tenantIds.includes(p.tenantId));
            const contracts = mockData.contracts.filter(c => tenantIds.includes(c.tenantId));
            const utilities = mockData.utilities.filter(u => aptIds.includes(u.apartmentId));

            const settings = {};
            settings.currency = mockData.settings[`currency_${req.userId}`] || mockData.settings.currency || '$';
            settings.lang = mockData.settings[`lang_${req.userId}`] || mockData.settings.lang || 'en';
            settings.notificationThresholdDays = mockData.settings[`notificationThresholdDays_${req.userId}`] || mockData.settings.notificationThresholdDays || 3;

            return res.json({ 
                properties, apartments, tenants, payments, settings, 
                unit_types: mockData.unit_types, contracts, utilities 
            });
        }
        
        const properties = await Property.find({ userId: req.userId }).lean();
        const propIds = properties.map(p => p.id);
        
        const apartments = await Apartment.find({ propertyId: { $in: propIds } }).lean();
        const aptIds = apartments.map(a => a.id);
        
        const tenants = await Tenant.find({ apartmentId: { $in: aptIds } }).lean();
        const tenantIds = tenants.map(t => t.id);
        
        const [payments, settingsRows, unit_types, contracts, utilities] = await Promise.all([
            Payment.find({ tenantId: { $in: tenantIds } }).sort({ date: -1 }).lean(),
            Setting.find({ userId: req.userId }).lean(),
            UnitType.find().lean(),
            Contract.find({ tenantId: { $in: tenantIds } }).lean(),
            Utility.find({ apartmentId: { $in: aptIds } }).lean()
        ]);
        
        const settings = {};
        settingsRows.forEach(row => settings[row.key] = row.value);
        if (!settings.currency) settings.currency = '$';
        if (!settings.lang) settings.lang = 'en';
        if (!settings.notificationThresholdDays) settings.notificationThresholdDays = 3;

        res.json({ properties, apartments, tenants, payments, settings, unit_types, contracts, utilities });
    } catch (e) {
        console.error("Critical Backend Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// Generic Mock Handlers
const mockPOST = (key, body) => { mockData[key].push(body); saveMock(); };

// ── Payments Endpoints ────────────────────────────────────────────────

app.post('/api/payments', authMiddleware, async (req, res) => {
    const { tenantId } = req.body;
    try {
        if (!isConnected()) {
            const tenant = mockData.tenants.find(t => String(t.id) === String(tenantId));
            if (!tenant) return res.status(400).json({ error: 'Tenant not found.' });
            const apt = mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId));
            const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
            if (!prop) return res.status(403).json({ error: 'Tenant access denied.' });

            mockPOST('payments', req.body); 
            return res.status(201).json({ status: 'success' }); 
        }
        
        const tenant = await Tenant.findOne({ id: tenantId });
        if (!tenant) return res.status(400).json({ error: 'Tenant not found.' });
        const apt = await Apartment.findOne({ id: tenant.apartmentId });
        const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
        if (!prop) return res.status(403).json({ error: 'Tenant access denied.' });

        await Payment.create(req.body); 
        res.status(201).json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/payments/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const payment = mockData.payments.find(p => String(p.id) === String(req.params.id));
            if (!payment) return res.status(404).json({ error: 'Payment not found.' });
            const tenant = mockData.tenants.find(t => String(t.id) === String(payment.tenantId));
            const apt = tenant ? mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId)) : null;
            const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
            if (!prop) return res.status(403).json({ error: 'Access denied.' });

            mockData.payments = mockData.payments.filter(p => String(p.id) !== String(req.params.id));
            saveMock();
            return res.json({ status: 'success' });
        }
        
        const payment = await Payment.findOne({ id: req.params.id });
        if (!payment) return res.status(404).json({ error: 'Payment not found.' });
        const tenant = await Tenant.findOne({ id: payment.tenantId });
        const apt = tenant ? await Apartment.findOne({ id: tenant.apartmentId }) : null;
        const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
        if (!prop) return res.status(403).json({ error: 'Access denied.' });

        await Payment.findOneAndDelete({ id: req.params.id });
        res.json({ status: 'success' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Settings Endpoints ────────────────────────────────────────────────

app.post('/api/settings', authMiddleware, async (req, res) => {
    const { key, value } = req.body;
    try {
        if (!isConnected()) { 
            mockData.settings[`${key}_${req.userId}`] = value; 
            saveMock(); 
            return res.json({ status: 'success' }); 
        }
        await Setting.findOneAndUpdate({ key, userId: req.userId }, { value }, { upsert: true }); 
        res.json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Properties Endpoints ──────────────────────────────────────────────

app.post('/api/properties', authMiddleware, async (req, res) => {
    const propertyData = { ...req.body, userId: req.userId };
    try {
        if (!isConnected()) { 
            mockPOST('properties', propertyData); 
            return res.status(201).json({ status: 'success' }); 
        }
        await Property.create(propertyData); 
        res.status(201).json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/properties/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            mockData.properties = mockData.properties.map(p => 
                (String(p.id) === String(req.params.id) && p.userId === req.userId) ? { ...p, ...req.body } : p
            );
            saveMock(); 
            return res.json({ status: 'success' });
        }
        await Property.findOneAndUpdate({ id: req.params.id, userId: req.userId }, req.body); 
        res.json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/properties/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const exists = mockData.properties.find(p => String(p.id) === String(req.params.id) && p.userId === req.userId);
            if (!exists) return res.status(403).json({ error: 'Access denied.' });

            mockData.properties = mockData.properties.filter(p => String(p.id) !== String(req.params.id));
            mockData.apartments = mockData.apartments.filter(a => String(a.propertyId) !== String(req.params.id));
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const exists = await Property.findOne({ id: req.params.id, userId: req.userId });
        if (!exists) return res.status(403).json({ error: 'Access denied.' });

        const apartments = await Apartment.find({ propertyId: req.params.id });
        const aptIds = apartments.map(a => a.id);
        
        await Promise.all([
            Property.findOneAndDelete({ id: req.params.id }),
            Apartment.deleteMany({ propertyId: req.params.id }),
            Tenant.deleteMany({ apartmentId: { $in: aptIds } })
        ]);
        
        res.json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Apartments Endpoints ──────────────────────────────────────────────

app.post('/api/apartments', authMiddleware, async (req, res) => {
    const { propertyId } = req.body;
    try {
        if (!isConnected()) { 
            const prop = mockData.properties.find(p => String(p.id) === String(propertyId) && p.userId === req.userId);
            if (!prop) return res.status(403).json({ error: 'Property access denied.' });

            mockPOST('apartments', req.body); 
            return res.status(201).json({ ...req.body, status: 'success' }); 
        }
        
        const prop = await Property.findOne({ id: propertyId, userId: req.userId });
        if (!prop) return res.status(403).json({ error: 'Property access denied.' });

        const apt = await Apartment.create(req.body); 
        res.status(201).json(apt); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/apartments/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const apt = mockData.apartments.find(a => String(a.id) === String(req.params.id));
            if (!apt) return res.status(404).json({ error: 'Apartment not found.' });
            const prop = mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId);
            if (!prop) return res.status(403).json({ error: 'Access denied.' });

            mockData.apartments = mockData.apartments.map(a => String(a.id) === String(req.params.id) ? { ...a, ...req.body } : a);
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const apt = await Apartment.findOne({ id: req.params.id });
        if (!apt) return res.status(404).json({ error: 'Apartment not found.' });
        const prop = await Property.findOne({ id: apt.propertyId, userId: req.userId });
        if (!prop) return res.status(403).json({ error: 'Access denied.' });

        await Apartment.findOneAndUpdate({ id: req.params.id }, req.body); 
        res.json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/apartments/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const apt = mockData.apartments.find(a => String(a.id) === String(req.params.id));
            if (!apt) return res.status(404).json({ error: 'Apartment not found.' });
            const prop = mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId);
            if (!prop) return res.status(403).json({ error: 'Access denied.' });

            mockData.apartments = mockData.apartments.filter(a => String(a.id) !== String(req.params.id));
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const apt = await Apartment.findOne({ id: req.params.id });
        if (!apt) return res.status(404).json({ error: 'Apartment not found.' });
        const prop = await Property.findOne({ id: apt.propertyId, userId: req.userId });
        if (!prop) return res.status(403).json({ error: 'Access denied.' });

        await Promise.all([
            Apartment.findOneAndDelete({ id: req.params.id }),
            Tenant.deleteMany({ apartmentId: req.params.id })
        ]);
        
        res.json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Tenants Endpoints ─────────────────────────────────────────────────

app.post('/api/tenants', authMiddleware, async (req, res) => {
    const { apartmentId } = req.body;
    try {
        if (!isConnected()) { 
            const apt = mockData.apartments.find(a => String(a.id) === String(apartmentId));
            const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
            if (!prop) return res.status(403).json({ error: 'Apartment access denied.' });

            mockPOST('tenants', req.body); 
            return res.status(201).json({ status: 'success' }); 
        }
        
        const apt = await Apartment.findOne({ id: apartmentId });
        const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
        if (!prop) return res.status(403).json({ error: 'Apartment access denied.' });

        await Tenant.create(req.body); 
        res.status(201).json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tenants/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const tenant = mockData.tenants.find(t => String(t.id) === String(req.params.id));
            if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });
            const apt = mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId));
            const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
            if (!prop) return res.status(403).json({ error: 'Access denied.' });

            mockData.tenants = mockData.tenants.map(t => String(t.id) === String(req.params.id) ? { ...t, ...req.body } : t);
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const tenant = await Tenant.findOne({ id: req.params.id });
        if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });
        const apt = await Apartment.findOne({ id: tenant.apartmentId });
        const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
        if (!prop) return res.status(403).json({ error: 'Access denied.' });

        await Tenant.findOneAndUpdate({ id: req.params.id }, req.body); 
        res.json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tenants/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const tenant = mockData.tenants.find(t => String(t.id) === String(req.params.id));
            if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });
            const apt = mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId));
            const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
            if (!prop) return res.status(403).json({ error: 'Access denied.' });

            mockData.tenants = mockData.tenants.filter(t => String(t.id) !== String(req.params.id));
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const tenant = await Tenant.findOne({ id: req.params.id });
        if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });
        const apt = await Apartment.findOne({ id: tenant.apartmentId });
        const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
        if (!prop) return res.status(403).json({ error: 'Access denied.' });

        await Promise.all([
            Tenant.findOneAndDelete({ id: req.params.id }),
            Contract.deleteMany({ tenantId: req.params.id }),
            Payment.deleteMany({ tenantId: req.params.id }),
            Utility.deleteMany({ tenantId: req.params.id })
        ]);
        
        res.json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Contracts Endpoints ───────────────────────────────────────────────

app.post('/api/contracts', authMiddleware, async (req, res) => {
    const { tenantId } = req.body;
    try {
        if (!isConnected()) { 
            const tenant = mockData.tenants.find(t => String(t.id) === String(tenantId));
            if (!tenant) return res.status(400).json({ error: 'Tenant not found.' });
            const apt = mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId));
            const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
            if (!prop) return res.status(403).json({ error: 'Tenant access denied.' });

            mockPOST('contracts', req.body); 
            return res.status(201).json({ status: 'success' }); 
        }
        
        const tenant = await Tenant.findOne({ id: tenantId });
        if (!tenant) return res.status(400).json({ error: 'Tenant not found.' });
        const apt = await Apartment.findOne({ id: tenant.apartmentId });
        const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
        if (!prop) return res.status(403).json({ error: 'Tenant access denied.' });

        await Contract.create(req.body); 
        res.status(201).json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/contracts/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const contract = mockData.contracts.find(c => String(c.id) === String(req.params.id));
            if (!contract) return res.status(404).json({ error: 'Contract not found.' });
            const tenant = mockData.tenants.find(t => String(t.id) === String(contract.tenantId));
            const apt = tenant ? mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId)) : null;
            const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
            if (!prop) return res.status(403).json({ error: 'Access denied.' });

            mockData.contracts = mockData.contracts.map(c => String(c.id) === String(req.params.id) ? { ...c, ...req.body } : c);
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const contract = await Contract.findOne({ id: req.params.id });
        if (!contract) return res.status(404).json({ error: 'Contract not found.' });
        const tenant = await Tenant.findOne({ id: contract.tenantId });
        const apt = tenant ? await Apartment.findOne({ id: tenant.apartmentId }) : null;
        const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
        if (!prop) return res.status(403).json({ error: 'Access denied.' });

        await Contract.findOneAndUpdate({ id: req.params.id }, req.body); 
        res.json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/contracts/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const contract = mockData.contracts.find(c => String(c.id) === String(req.params.id));
            if (!contract) return res.status(404).json({ error: 'Contract not found.' });
            const tenant = mockData.tenants.find(t => String(t.id) === String(contract.tenantId));
            const apt = tenant ? mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId)) : null;
            const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
            if (!prop) return res.status(403).json({ error: 'Access denied.' });

            mockData.contracts = mockData.contracts.filter(c => String(c.id) !== String(req.params.id));
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const contract = await Contract.findOne({ id: req.params.id });
        if (!contract) return res.status(404).json({ error: 'Contract not found.' });
        const tenant = await Tenant.findOne({ id: contract.tenantId });
        const apt = tenant ? await Apartment.findOne({ id: tenant.apartmentId }) : null;
        const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
        if (!prop) return res.status(403).json({ error: 'Access denied.' });

        await Contract.findOneAndDelete({ id: req.params.id });
        res.json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Utilities Endpoints ───────────────────────────────────────────────

app.post('/api/utilities', authMiddleware, async (req, res) => {
    const { apartmentId } = req.body;
    try {
        if (!isConnected()) { 
            const apt = mockData.apartments.find(a => String(a.id) === String(apartmentId));
            const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
            if (!prop) return res.status(403).json({ error: 'Apartment access denied.' });

            mockPOST('utilities', req.body); 
            return res.status(201).json({ status: 'success' }); 
        }
        
        const apt = await Apartment.findOne({ id: apartmentId });
        const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
        if (!prop) return res.status(403).json({ error: 'Apartment access denied.' });

        await Utility.create(req.body); 
        res.status(201).json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/utilities/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const util = mockData.utilities.find(u => String(u.id) === String(req.params.id));
            if (!util) return res.status(404).json({ error: 'Utility not found.' });
            const apt = mockData.apartments.find(a => String(a.id) === String(util.apartmentId));
            const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
            if (!prop) return res.status(403).json({ error: 'Access denied.' });

            mockData.utilities = mockData.utilities.map(u => String(u.id) === String(req.params.id) ? { ...u, ...req.body } : u);
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const util = await Utility.findOne({ id: req.params.id });
        if (!util) return res.status(404).json({ error: 'Utility not found.' });
        const apt = await Apartment.findOne({ id: util.apartmentId });
        const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
        if (!prop) return res.status(403).json({ error: 'Access denied.' });

        await Utility.findOneAndUpdate({ id: req.params.id }, req.body); 
        res.json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/utilities/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const util = mockData.utilities.find(u => String(u.id) === String(req.params.id));
            if (!util) return res.status(404).json({ error: 'Utility not found.' });
            const apt = mockData.apartments.find(a => String(a.id) === String(util.apartmentId));
            const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
            if (!prop) return res.status(403).json({ error: 'Access denied.' });

            mockData.utilities = mockData.utilities.filter(u => String(u.id) !== String(req.params.id));
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const util = await Utility.findOne({ id: req.params.id });
        if (!util) return res.status(404).json({ error: 'Utility not found.' });
        const apt = await Apartment.findOne({ id: util.apartmentId });
        const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
        if (!prop) return res.status(403).json({ error: 'Access denied.' });

        await Utility.findOneAndDelete({ id: req.params.id });
        res.json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Unit Types (Categories) Endpoints ────────────────────────────────

app.post('/api/unit_types', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            mockPOST('unit_types', req.body);
            return res.status(201).json({ status: 'success' });
        }
        await UnitType.create(req.body);
        res.status(201).json({ status: 'success' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/unit_types/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            mockData.unit_types = mockData.unit_types.filter(ut => String(ut.id) !== String(req.params.id));
            saveMock();
            return res.json({ status: 'success' });
        }
        await UnitType.findOneAndDelete({ id: req.params.id });
        res.json({ status: 'success' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── SMTP Settings Endpoints ───────────────────────────────────────────

app.get('/api/smtp-settings', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const config = mockData.settings[`smtp_config_${req.userId}`] || { host: '', port: '587', user: '', pass: '', from: '' };
            return res.json(config);
        }
        const row = await Setting.findOne({ key: 'smtp_config', userId: req.userId });
        res.json(row ? JSON.parse(row.value) : { host: '', port: '587', user: '', pass: '', from: '' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/smtp-settings', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            mockData.settings[`smtp_config_${req.userId}`] = req.body;
            saveMock();
            return res.json({ status: 'success' });
        }
        await Setting.findOneAndUpdate(
            { key: 'smtp_config', userId: req.userId },
            { value: JSON.stringify(req.body) },
            { upsert: true, new: true }
        );
        res.json({ status: 'success' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/test-smtp', authMiddleware, async (req, res) => {
    const { host, port, user, pass } = req.body;
    if (!host || !user || !pass) {
        return res.status(400).json({ error: 'SMTP Host, User, and Password are required to test connection.' });
    }
    try {
        const transporter = nodemailer.createTransport({
            host,
            port: Number(port) || 587,
            secure: Number(port) === 465,
            auth: { user, pass }
        });
        await transporter.verify();
        res.json({ status: 'success', message: 'SMTP credentials verified successfully!' });
    } catch (e) {
        res.status(500).json({ error: `SMTP Connection test failed: ${e.message}` });
    }
});

// ── Email and simulated receipt delivery ──────────────────────────────

app.post('/api/send-receipt', authMiddleware, async (req, res) => {
    const { to, subject, body } = req.body;
    try {
        let smtpConfig = null;
        if (isConnected()) {
            const row = await Setting.findOne({ key: 'smtp_config', userId: req.userId });
            if (row) smtpConfig = JSON.parse(row.value);
        } else {
            smtpConfig = mockData.settings[`smtp_config_${req.userId}`];
        }

        if (smtpConfig && smtpConfig.host && smtpConfig.user && smtpConfig.pass) {
            const transporter = nodemailer.createTransport({
                host: smtpConfig.host,
                port: Number(smtpConfig.port) || 587,
                secure: Number(smtpConfig.port) === 465,
                auth: {
                    user: smtpConfig.user,
                    pass: smtpConfig.pass
                }
            });
            await transporter.sendMail({
                from: `"${smtpConfig.from || 'Property Manager'}" <${smtpConfig.user}>`,
                to,
                subject,
                html: body
            });
            return res.json({ status: 'success', message: `Receipt sent successfully to ${to}!` });
        } else {
            console.log(`📧 [RECEIPT SIMULATION] To: ${to} | Subject: ${subject}`);
            return res.json({ status: 'success', message: `Receipt simulated for ${to} (Configure SMTP in settings for real emails)` });
        }
    } catch (e) {
        console.error("Receipt delivery error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// Enhanced Seed endpoint - Securely isolated for local development resets
app.get('/api/seed', async (req, res) => {
    const { secret } = req.query;
    if (secret !== 'pm_dev_2026') {
        return res.status(403).json({ error: 'Forbidden. Invalid seed token secret.' });
    }

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
            // clear users
            mockData.users = [];
            saveMock();
            return res.json({ message: 'Seeded successfully (Mock Mode)', data: demo });
        }

        await Promise.all([
            User.deleteMany({}),
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 MERN Backend running on port ${PORT}`));
