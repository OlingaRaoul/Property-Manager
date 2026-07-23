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
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

dotenv.config();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const { User, Property, Apartment, Tenant, Payment, UnitType, Contract, Utility, Setting } = require('./models');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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
    settings: { currency: 'CFA', lang: 'en', notificationThresholdDays: 3 }
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

const migrateTenantsTokens = async () => {
    try {
        if (isConnected()) {
            const tenants = await Tenant.find({ paymentToken: { $exists: false } });
            if (tenants.length > 0) {
                console.log(`[MIGRATION] Generating payment tokens for ${tenants.length} tenants...`);
                for (const t of tenants) {
                    t.paymentToken = crypto.randomUUID();
                    await t.save();
                }
                console.log('✅ Tenant payment token migration complete');
            }
        } else {
            let updated = false;
            mockData.tenants = mockData.tenants.map(t => {
                if (!t.paymentToken) {
                    updated = true;
                    return { ...t, paymentToken: crypto.randomUUID() };
                }
                return t;
            });
            if (updated) {
                saveMock();
                console.log('✅ Mock Tenant payment token migration complete');
            }
        }
    } catch (e) {
        console.error("Tenant payment token migration error:", e.message);
    }
};

const migrateSplitPayments = async () => {
    try {
        if (isConnected()) {
            const payments = await Payment.find({ 
                type: 'Rent', 
                status: 'Approved', 
                monthList: { $exists: true } 
            });
            for (const p of payments) {
                if (p.monthList && p.monthList.length > 1) {
                    const months = [...p.monthList];
                    console.log(`[MIGRATION] Splitting payment ${p.id} for months: ${months.join(', ')}...`);
                    const splitAmount = p.amount / months.length;
                    
                    // Update original
                    p.amount = splitAmount;
                    p.monthPaid = months[0];
                    p.monthList = [months[0]];
                    await p.save();

                    // Create others
                    for (let i = 1; i < months.length; i++) {
                        const month = months[i];
                        await Payment.create({
                            id: `pay_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
                            tenantId: p.tenantId,
                            apartmentId: p.apartmentId,
                            amount: splitAmount,
                            date: p.date,
                            monthPaid: month,
                            monthList: [month],
                            type: 'Rent',
                            note: p.note,
                            status: 'Approved',
                            proofFile: p.proofFile,
                            proofFileType: p.proofFileType
                        });
                    }
                }
            }
            console.log('✅ Split payment migration complete');
        } else {
            let updated = false;
            const newPayments = [];
            mockData.payments = mockData.payments.map(p => {
                if (p.type === 'Rent' && p.status === 'Approved' && p.monthList && p.monthList.length > 1) {
                    updated = true;
                    const months = [...p.monthList];
                    console.log(`[MIGRATION] Splitting mock payment ${p.id} for months: ${months.join(', ')}...`);
                    const splitAmount = p.amount / months.length;
                    
                    for (let i = 1; i < months.length; i++) {
                        const month = months[i];
                        newPayments.push({
                            id: `pay_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
                            tenantId: p.tenantId,
                            apartmentId: p.apartmentId,
                            amount: splitAmount,
                            date: p.date,
                            monthPaid: month,
                            monthList: [month],
                            type: 'Rent',
                            note: p.note,
                            status: 'Approved',
                            proofFile: p.proofFile,
                            proofFileType: p.proofFileType
                        });
                    }

                    return {
                        ...p,
                        amount: splitAmount,
                        monthPaid: months[0],
                        monthList: [months[0]]
                    };
                }
                return p;
            });
            if (updated) {
                mockData.payments = [...mockData.payments, ...newPayments];
                saveMock();
                console.log('✅ Mock split payment migration complete');
            }
        }
    } catch (e) {
        console.error("Split payment migration error:", e.message);
    }
};

// Connect to MongoDB with a short timeout to prevent hanging the first request
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/property_manager', {
    serverSelectionTimeoutMS: 2000 // 2 seconds timeout for initial connection
}).then(() => {
    console.log('✅ Connected to MongoDB Backend Database');
    (async () => {
        await migrateTenantsTokens();
        await migrateSplitPayments();
    })();
}).catch(err => {
    console.error('❌ MongoDB Connection ERROR:', err.message);
    console.warn('⚠️ Falling back to Mock JSON Mode.');
    (async () => {
        await migrateTenantsTokens();
        await migrateSplitPayments();
    })();
});

const isConnected = () => mongoose.connection.readyState === 1;

// Database legacy data auto-migration helper
const migrateLegacyData = async (defaultUserId) => {
    try {
        if (isConnected()) {
            const legacyQuery = { $or: [ { userId: { $exists: false } }, { userId: null }, { userId: "" } ] };
            const result = await Property.updateMany(legacyQuery, { userId: defaultUserId });
            const settingsResult = await Setting.updateMany(legacyQuery, { userId: defaultUserId });
            
            // Re-assign or repair tenant ownership based on their properties
            const allTenants = await Tenant.find().lean();
            let tenantMigratedCount = 0;
            for (const tenant of allTenants) {
                let targetUserId = tenant.userId;
                let needsUpdate = false;

                if (tenant.apartmentId) {
                    const apt = await Apartment.findOne({ id: tenant.apartmentId }).lean();
                    const prop = apt ? await Property.findOne({ id: apt.propertyId }).lean() : null;
                    if (prop && prop.userId) {
                        if (tenant.userId !== prop.userId) {
                            targetUserId = prop.userId;
                            needsUpdate = true;
                        }
                    }
                }

                if (!targetUserId) {
                    targetUserId = defaultUserId;
                    needsUpdate = true;
                }

                let updatePayload = {};
                if (needsUpdate) {
                    updatePayload.userId = targetUserId;
                }
                if (tenant.isAssigned === undefined) {
                    updatePayload.isAssigned = true;
                }

                if (Object.keys(updatePayload).length > 0) {
                    await Tenant.updateOne({ id: tenant.id }, { $set: updatePayload });
                    tenantMigratedCount++;
                }
            }

            if (result.modifiedCount > 0) {
                console.log(`[MIGRATION] Assigned ${result.modifiedCount} legacy properties in MongoDB to User: ${defaultUserId}`);
            }
            if (tenantMigratedCount > 0) {
                console.log(`[MIGRATION] Repaired/Assigned ${tenantMigratedCount} tenants in MongoDB`);
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
            mockData.tenants = mockData.tenants.map(t => {
                let updated = false;
                const newT = { ...t };
                
                let targetUserId = newT.userId;
                if (newT.apartmentId) {
                    const apt = mockData.apartments.find(a => String(a.id) === String(newT.apartmentId));
                    const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId)) : null;
                    if (prop && prop.userId) {
                        if (newT.userId !== prop.userId) {
                            targetUserId = prop.userId;
                            updated = true;
                        }
                    }
                }
                if (!targetUserId) {
                    targetUserId = defaultUserId;
                    updated = true;
                }
                if (newT.isAssigned === undefined) {
                    newT.isAssigned = true;
                    updated = true;
                }
                if (updated) {
                    count++;
                    return { ...newT, userId: targetUserId, isAssigned: newT.isAssigned !== undefined ? newT.isAssigned : true };
                }
                return t;
            });
            if (count > 0) {
                saveMock();
                console.log(`[MIGRATION] Assigned/Repaired legacy entities in Mock DB`);
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
            mockData.settings[`currency_${id}`] = 'CFA';
            mockData.settings[`lang_${id}`] = 'en';
            mockData.settings[`notificationThresholdDays_${id}`] = 3;
            saveMock();

            await migrateLegacyData(id);

            const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
            return res.status(201).json({ status: 'success', token, user: { id, name, email: lowercaseEmail } });
        } else {
            const exists = await User.findOne({ email: lowercaseEmail });
            if (exists) return res.status(400).json({ error: 'Email already registered.' });

            const newUser = await User.create({ id, name, email: lowercaseEmail, password: hashedPassword });
            
            // Seed default settings for the user
            await Setting.insertMany([
                { key: 'currency', value: 'CFA', userId: newUser.id },
                { key: 'lang', value: 'en', userId: newUser.id },
                { key: 'notificationThresholdDays', value: '3', userId: newUser.id }
            ]);
            
            await migrateLegacyData(newUser.id);

            const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
            return res.status(201).json({ status: 'success', token, user: { id, name, email: lowercaseEmail } });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ error: 'Google credential token is required.' });
    }
    
    try {
        let payload;
        // Verify Google token
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID
            });
            payload = ticket.getPayload();
        } catch (verifyError) {
            // Dev override: if GOOGLE_CLIENT_ID is missing and we are in mock mode,
            // we decode the JWT token without verification to extract mock fields for local validation.
            if (!process.env.GOOGLE_CLIENT_ID && !isConnected()) {
                const parts = token.split('.');
                if (parts.length === 3) {
                    payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
                } else {
                    throw verifyError;
                }
            } else {
                throw verifyError;
            }
        }

        const { email, name, sub } = payload;
        if (!email) {
            return res.status(400).json({ error: 'Google profile must share email address.' });
        }
        
        const lowercaseEmail = email.toLowerCase().trim();
        let user = null;

        if (!isConnected()) {
            // Mock Mode User Lookup / Registration
            user = mockData.users.find(u => u.email === lowercaseEmail);
            if (!user) {
                const id = `u${Date.now()}`;
                user = { id, name, email: lowercaseEmail, googleId: sub };
                mockData.users.push(user);
                
                // Seed default settings in mock
                mockData.settings[`currency_${id}`] = 'CFA';
                mockData.settings[`lang_${id}`] = 'en';
                mockData.settings[`notificationThresholdDays_${id}`] = 3;
                saveMock();
            }
        } else {
            // MongoDB User Lookup / Registration
            user = await User.findOne({ email: lowercaseEmail });
            if (!user) {
                const id = `u${Date.now()}`;
                user = await User.create({ 
                    id, 
                    name, 
                    email: lowercaseEmail, 
                    password: await bcrypt.hash(Math.random().toString(36), 10), // random password fallback
                    googleId: sub 
                });
                
                // Seed default settings for the user
                await Setting.insertMany([
                    { key: 'currency', value: 'CFA', userId: user.id },
                    { key: 'lang', value: 'en', userId: user.id },
                    { key: 'notificationThresholdDays', value: '3', userId: user.id }
                ]);
            }
        }

        // Run migration for legacy data, if any
        await migrateLegacyData(user.id);

        // Generate application session JWT
        const sessionToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ 
            status: 'success', 
            token: sessionToken, 
            user: { id: user.id, name: user.name, email: user.email } 
        });

    } catch (e) {
        console.error("Google authentication error:", e.message);
        res.status(401).json({ error: `Google login failed: ${e.message}` });
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

            await migrateLegacyData(user.id);
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ status: 'success', token, user: { id: user.id, name: user.name, email: lowercaseEmail } });
        } else {
            const user = await User.findOne({ email: lowercaseEmail });
            if (!user) return res.status(400).json({ error: 'Invalid email or password.' });

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ error: 'Invalid email or password.' });

            await migrateLegacyData(user.id);
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ status: 'success', token, user: { id: user.id, name: user.name, email: lowercaseEmail } });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }
    const lowercaseEmail = email.toLowerCase().trim();
    try {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + 3600000; // 1 hour expiration

        let userFound = false;
        let smtpConfig = null;
        let userName = '';

        if (!isConnected()) {
            const userIndex = mockData.users.findIndex(u => u.email === lowercaseEmail);
            if (userIndex !== -1) {
                mockData.users[userIndex].resetPasswordToken = token;
                mockData.users[userIndex].resetPasswordExpires = new Date(expires).toISOString();
                userName = mockData.users[userIndex].name;
                saveMock();
                userFound = true;
                
                // Get SMTP configuration for this user
                smtpConfig = mockData.settings[`smtp_config_${mockData.users[userIndex].id}`];
            }
        } else {
            const user = await User.findOne({ email: lowercaseEmail });
            if (user) {
                user.resetPasswordToken = token;
                user.resetPasswordExpires = expires;
                await user.save();
                userName = user.name;
                userFound = true;
                
                // Get SMTP configuration for this user
                const row = await Setting.findOne({ key: 'smtp_config', userId: user.id });
                if (row) smtpConfig = JSON.parse(row.value);
            }
        }

        // To prevent user enumeration, we return success even if the email does not exist
        if (!userFound) {
            return res.json({ status: 'success', message: 'If that email address exists, a password reset link has been sent.' });
        }

        const getClientOrigin = () => {
            if (req.headers.origin) return req.headers.origin;
            if (req.headers.referer) {
                try {
                    return new URL(req.headers.referer).origin;
                } catch (e) {}
            }
            const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
            return `${protocol}://${req.headers.host || 'localhost:8080'}`;
        };
        const clientOrigin = getClientOrigin();
        const resetLink = `${clientOrigin}/reset-password?token=${token}&email=${encodeURIComponent(lowercaseEmail)}`;

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

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #2D60FF;">Reset Your Password</h2>
                    <p>Hello ${userName},</p>
                    <p>We received a request to reset the password for your Property Manager account.</p>
                    <p>Please click the button below to reset your password. This link is valid for 1 hour.</p>
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${resetLink}" style="background-color: #2D60FF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
                    </div>
                    <p>If the button above doesn't work, copy and paste this URL into your browser:</p>
                    <p style="word-break: break-all; color: #64748B;">${resetLink}</p>
                    <p style="margin-top: 30px; font-size: 0.88rem; color: #64748B;">If you did not request a password reset, you can safely ignore this email.</p>
                </div>
            `;

            await transporter.sendMail({
                from: `"${smtpConfig.from || 'Property Manager'}" <${smtpConfig.user}>`,
                to: lowercaseEmail,
                subject: 'Reset your Property Manager Password',
                html: emailHtml
            });

            return res.json({ status: 'success', message: 'If that email address exists, a password reset link has been sent.' });
        } else {
            // Simulated delivery
            console.log(`📧 [RESET PASSWORD SIMULATION] To: ${lowercaseEmail} | Subject: Reset your Property Manager Password`);
            console.log(`🔗 Link: ${resetLink}`);
            const isLocalRequest = req.headers.host && (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1'));
            return res.json({ 
                status: 'success', 
                message: isLocalRequest
                    ? 'Password reset link simulated in server console (no SMTP configured).'
                    : 'If that email address exists, a password reset link has been sent.',
                simulatedLink: isLocalRequest ? resetLink : undefined
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
        return res.status(400).json({ error: 'Email, token, and new password are required.' });
    }
    const lowercaseEmail = email.toLowerCase().trim();
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        let userFound = false;

        if (!isConnected()) {
            const userIndex = mockData.users.findIndex(u => u.email === lowercaseEmail);
            if (userIndex !== -1) {
                const user = mockData.users[userIndex];
                if (user.resetPasswordToken === token && user.resetPasswordExpires) {
                    const expiry = new Date(user.resetPasswordExpires).getTime();
                    if (expiry > Date.now()) {
                        mockData.users[userIndex].password = hashedPassword;
                        mockData.users[userIndex].resetPasswordToken = undefined;
                        mockData.users[userIndex].resetPasswordExpires = undefined;
                        saveMock();
                        userFound = true;
                    }
                }
            }
        } else {
            const user = await User.findOne({
                email: lowercaseEmail,
                resetPasswordToken: token,
                resetPasswordExpires: { $gt: Date.now() }
            });
            if (user) {
                user.password = hashedPassword;
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;
                await user.save();
                userFound = true;
            }
        }

        if (!userFound) {
            return res.status(400).json({ error: 'Password reset link is invalid or has expired.' });
        }

        res.json({ status: 'success', message: 'Your password has been reset successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
    const host = req.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    if (!isLocalhost) {
        return res.status(403).json({ error: 'Manual password change is only allowed on localhost.' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    try {
        if (!isConnected()) {
            const user = mockData.users.find(u => u.id === req.userId);
            if (!user) return res.status(404).json({ error: 'User not found.' });

            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) return res.status(400).json({ error: 'Incorrect current password.' });

            user.password = await bcrypt.hash(newPassword, 10);
            saveMock();
            return res.json({ status: 'success', message: 'Password updated successfully!' });
        } else {
            const user = await User.findOne({ id: req.userId });
            if (!user) return res.status(404).json({ error: 'User not found.' });

            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) return res.status(400).json({ error: 'Incorrect current password.' });

            user.password = await bcrypt.hash(newPassword, 10);
            await user.save();
            return res.json({ status: 'success', message: 'Password updated successfully!' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/public/tenant/:token', async (req, res) => {
    const { token } = req.params;
    try {
        if (!isConnected()) {
            const tenant = mockData.tenants.find(t => t.paymentToken === token);
            if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

            const apt = mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId));
            const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId)) : null;

            const utilities = mockData.utilities.filter(u => 
                String(u.apartmentId) === String(tenant.apartmentId) && 
                u.status !== 'Paid'
            );

            return res.json({
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    rentAmount: tenant.rentAmount,
                    lastPaidMonth: tenant.lastPaidMonth,
                },
                apartment: apt ? { unitNumber: apt.unitNumber } : null,
                property: prop ? { name: prop.name } : null,
                pendingUtilities: utilities.map(u => ({
                    id: u.id,
                    type: u.type,
                    amount: u.amount,
                    month: u.month
                }))
            });
        } else {
            const tenant = await Tenant.findOne({ paymentToken: token }).lean();
            if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

            const apt = await Apartment.findOne({ id: tenant.apartmentId }).lean();
            const prop = apt ? await Property.findOne({ id: apt.propertyId }).lean() : null;

            const utilities = await Utility.find({ 
                apartmentId: tenant.apartmentId,
                status: { $ne: 'Paid' }
            }).lean();

            return res.json({
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    rentAmount: tenant.rentAmount,
                    lastPaidMonth: tenant.lastPaidMonth,
                },
                apartment: apt ? { unitNumber: apt.unitNumber } : null,
                property: prop ? { name: prop.name } : null,
                pendingUtilities: utilities.map(u => ({
                    id: u.id,
                    type: u.type,
                    amount: u.amount,
                    month: u.month
                }))
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/public/payments/submit', async (req, res) => {
    const { paymentToken, type, amount, date, monthPaid, monthList, depositMonths, utilityId, note, proofFile, proofFileType } = req.body;
    if (!paymentToken || !type || !amount || !date || !proofFile) {
        return res.status(400).json({ error: 'Token, type, amount, date and proof document are required.' });
    }
    try {
        if (!isConnected()) {
            const tenant = mockData.tenants.find(t => t.paymentToken === paymentToken);
            if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

            // Determine monthPaid from list if type is Rent
            const finalMonthPaid = type === 'Rent' 
                ? (monthList && monthList.length > 0 ? monthList[monthList.length - 1] : monthPaid)
                : undefined;

            // Build note with months info if Rent
            let finalNote = note;
            if (type === 'Rent' && monthList && monthList.length > 0) {
                finalNote = `[Months: ${monthList.join(', ')}] ${note || ''}`;
            } else if (type === 'Utility Bill' && utilityId) {
                finalNote = `[Utility: ${utilityId}] ${note || ''}`;
            }

            const newPayment = {
                id: `pay_${Date.now()}`,
                tenantId: tenant.id,
                apartmentId: tenant.apartmentId,
                amount: Number(amount),
                date,
                monthPaid: finalMonthPaid,
                monthList: type === 'Rent' ? monthList : undefined,
                depositMonths: type === 'Deposit' ? Number(depositMonths || 0) : undefined,
                type,
                note: finalNote,
                status: 'Pending',
                proofFile,
                proofFileType
            };

            mockData.payments.push(newPayment);
            saveMock();
            return res.status(201).json({ status: 'success', message: 'Proof of payment submitted successfully for verification!' });
        } else {
            const tenant = await Tenant.findOne({ paymentToken }).lean();
            if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

            // Determine monthPaid from list if type is Rent
            const finalMonthPaid = type === 'Rent' 
                ? (monthList && monthList.length > 0 ? monthList[monthList.length - 1] : monthPaid)
                : undefined;

            // Build note with months info if Rent
            let finalNote = note;
            if (type === 'Rent' && monthList && monthList.length > 0) {
                finalNote = `[Months: ${monthList.join(', ')}] ${note || ''}`;
            } else if (type === 'Utility Bill' && utilityId) {
                finalNote = `[Utility: ${utilityId}] ${note || ''}`;
            }

            const paymentData = {
                id: `pay_${Date.now()}`,
                tenantId: tenant.id,
                apartmentId: tenant.apartmentId,
                amount: Number(amount),
                date,
                monthPaid: finalMonthPaid,
                monthList: type === 'Rent' ? monthList : undefined,
                depositMonths: type === 'Deposit' ? Number(depositMonths || 0) : undefined,
                type,
                note: finalNote,
                status: 'Pending',
                proofFile,
                proofFileType
            };

            await Payment.create(paymentData);
            return res.status(201).json({ status: 'success', message: 'Proof of payment submitted successfully for verification!' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const recalculateTenantFields = async (tenantId) => {
    try {
        if (!isConnected()) {
            const tenantIndex = mockData.tenants.findIndex(t => String(t.id) === String(tenantId));
            if (tenantIndex === -1) return;

            const allPayments = mockData.payments.filter(p => String(p.tenantId) === String(tenantId) && p.status === 'Approved');
            const rentPayments = allPayments.filter(p => p.type === 'Rent');
            const depositPayments = allPayments.filter(p => p.type === 'Deposit');

            const lastPaidMonth = rentPayments.map(p => p.monthPaid).sort().pop() || '';
            const depositPaidAmount = depositPayments.reduce((sum, p) => sum + p.amount, 0);
            const depositMonthsPaid = depositPayments.reduce((sum, p) => sum + (p.depositMonths || 0), 0);

            mockData.tenants[tenantIndex].lastPaidMonth = lastPaidMonth;
            mockData.tenants[tenantIndex].depositPaidAmount = depositPaidAmount;
            mockData.tenants[tenantIndex].depositMonthsPaid = depositMonthsPaid;
            saveMock();
            console.log(`[RECALCULATION] Mock Tenant ${tenantId} updated: lastPaidMonth=${lastPaidMonth}, depositPaidAmount=${depositPaidAmount}, depositMonthsPaid=${depositMonthsPaid}`);
        } else {
            const tenant = await Tenant.findOne({ id: tenantId });
            if (!tenant) return;

            const allPayments = await Payment.find({ tenantId, status: 'Approved' }).lean();
            const rentPayments = allPayments.filter(p => p.type === 'Rent');
            const depositPayments = allPayments.filter(p => p.type === 'Deposit');

            const lastPaidMonth = rentPayments.map(p => p.monthPaid).sort().pop() || '';
            const depositPaidAmount = depositPayments.reduce((sum, p) => sum + p.amount, 0);
            const depositMonthsPaid = depositPayments.reduce((sum, p) => sum + (p.depositMonths || 0), 0);

            tenant.lastPaidMonth = lastPaidMonth;
            tenant.depositPaidAmount = depositPaidAmount;
            tenant.depositMonthsPaid = depositMonthsPaid;
            await tenant.save();
            console.log(`[RECALCULATION] MongoDB Tenant ${tenantId} updated: lastPaidMonth=${lastPaidMonth}, depositPaidAmount=${depositPaidAmount}, depositMonthsPaid=${depositMonthsPaid}`);
        }
    } catch (e) {
        console.error("Failed to recalculate tenant fields:", e.message);
    }
};

app.put('/api/payments/:id/approve', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const payment = mockData.payments.find(p => String(p.id) === String(req.params.id));
            if (!payment) return res.status(404).json({ error: 'Payment not found.' });

            payment.status = 'Approved';
            
            // If Rent and has multiple months in monthList, split the payment
            if (payment.type === 'Rent' && payment.monthList && payment.monthList.length > 1) {
                const months = [...payment.monthList];
                const splitAmount = payment.amount / months.length;

                payment.amount = splitAmount;
                payment.monthPaid = months[0];
                payment.monthList = [months[0]];

                for (let i = 1; i < months.length; i++) {
                    const month = months[i];
                    mockData.payments.push({
                        id: `pay_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
                        tenantId: payment.tenantId,
                        apartmentId: payment.apartmentId,
                        amount: splitAmount,
                        date: payment.date,
                        monthPaid: month,
                        monthList: [month],
                        type: 'Rent',
                        note: payment.note,
                        status: 'Approved',
                        proofFile: payment.proofFile,
                        proofFileType: payment.proofFileType
                    });
                }
            }

            // Reconcile utility status if applicable
            if (payment.type === 'Utility Bill' && payment.note) {
                const match = payment.note.match(/\[Utility:\s*([^\]]+)\]/);
                if (match && match[1]) {
                    const utilId = match[1].trim();
                    const utilIndex = mockData.utilities.findIndex(u => String(u.id) === String(utilId));
                    if (utilIndex !== -1) {
                        mockData.utilities[utilIndex].status = 'Paid';
                    }
                }
            }

            saveMock();
            await recalculateTenantFields(payment.tenantId);
            return res.json({ status: 'success', message: 'Payment approved successfully!' });
        } else {
            const payment = await Payment.findOne({ id: req.params.id });
            if (!payment) return res.status(404).json({ error: 'Payment not found.' });

            payment.status = 'Approved';

            // If Rent and has multiple months in monthList, split the payment
            if (payment.type === 'Rent' && payment.monthList && payment.monthList.length > 1) {
                const months = [...payment.monthList];
                const splitAmount = payment.amount / months.length;

                payment.amount = splitAmount;
                payment.monthPaid = months[0];
                payment.monthList = [months[0]];

                for (let i = 1; i < months.length; i++) {
                    const month = months[i];
                    await Payment.create({
                        id: `pay_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
                        tenantId: payment.tenantId,
                        apartmentId: payment.apartmentId,
                        amount: splitAmount,
                        date: payment.date,
                        monthPaid: month,
                        monthList: [month],
                        type: 'Rent',
                        note: payment.note,
                        status: 'Approved',
                        proofFile: payment.proofFile,
                        proofFileType: payment.proofFileType
                    });
                }
            }

            await payment.save();

            // Reconcile utility status if applicable
            if (payment.type === 'Utility Bill' && payment.note) {
                const match = payment.note.match(/\[Utility:\s*([^\]]+)\]/);
                if (match && match[1]) {
                    const utilId = match[1].trim();
                    await Utility.findOneAndUpdate({ id: utilId }, { status: 'Paid' });
                }
            }

            await recalculateTenantFields(payment.tenantId);
            return res.json({ status: 'success', message: 'Payment approved successfully!' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/payments/:id/reject', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const payment = mockData.payments.find(p => String(p.id) === String(req.params.id));
            if (!payment) return res.status(404).json({ error: 'Payment not found.' });

            payment.status = 'Rejected';
            saveMock();
            await recalculateTenantFields(payment.tenantId);
            return res.json({ status: 'success', message: 'Payment rejected successfully!' });
        } else {
            const payment = await Payment.findOne({ id: req.params.id });
            if (!payment) return res.status(404).json({ error: 'Payment not found.' });

            payment.status = 'Rejected';
            await payment.save();
            await recalculateTenantFields(payment.tenantId);
            return res.json({ status: 'success', message: 'Payment rejected successfully!' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Data Hydration Endpoint ───────────────────────────────────────────

app.get('/api/data', authMiddleware, async (req, res) => {
    try {
        // Ensure legacy database entries are dynamically migrated to the active user on page refresh
        await migrateLegacyData(req.userId);

        if (!isConnected()) {
            const properties = mockData.properties.filter(p => p.userId === req.userId);
            const propIds = properties.map(p => p.id);

            const apartments = mockData.apartments.filter(a => propIds.includes(a.propertyId));
            const aptIds = apartments.map(a => a.id);

            const tenants = mockData.tenants
                .filter(t => t.userId === req.userId || aptIds.includes(t.apartmentId))
                .map(t => ({ ...t, isAssigned: t.isAssigned !== undefined ? t.isAssigned : true }));
            const tenantIds = tenants.map(t => t.id);

            const payments = mockData.payments.filter(p => tenantIds.includes(p.tenantId));
            const rawContracts = mockData.contracts.filter(c => tenantIds.includes(c.tenantId));
            const contracts = rawContracts.map(c => ({
                ...c,
                agreedDay: c.agreedDay !== undefined ? c.agreedDay : c.agreedPaymentDay,
                deposit: c.deposit !== undefined ? c.deposit : c.depositAmount,
                notes: c.notes !== undefined ? c.notes : c.terms,
                active: c.active !== undefined ? c.active : (c.status === 'Active')
            }));
            const utilities = mockData.utilities.filter(u => aptIds.includes(u.apartmentId));

            const settings = {};
            settings.currency = mockData.settings[`currency_${req.userId}`] || mockData.settings.currency || 'CFA';
            settings.lang = mockData.settings[`lang_${req.userId}`] || mockData.settings.lang || 'en';
            settings.notificationThresholdDays = mockData.settings[`notificationThresholdDays_${req.userId}`] || mockData.settings.notificationThresholdDays || 3;
            settings.frontendBaseUrl = mockData.settings[`frontendBaseUrl_${req.userId}`] || mockData.settings.frontendBaseUrl || '';

            return res.json({ 
                properties, apartments, tenants, payments, settings, 
                unit_types: mockData.unit_types, contracts, utilities 
            });
        }
        
        const properties = await Property.find({ userId: req.userId }).lean();
        const propIds = properties.map(p => p.id);
        
        const apartments = await Apartment.find({ propertyId: { $in: propIds } }).lean();
        const aptIds = apartments.map(a => a.id);
        
        const rawTenants = await Tenant.find({ $or: [ { userId: req.userId }, { apartmentId: { $in: aptIds } } ] }).lean();
        const tenants = rawTenants.map(t => ({
            ...t,
            isAssigned: t.isAssigned !== undefined ? t.isAssigned : true
        }));
        const tenantIds = tenants.map(t => t.id);
        
        const [payments, settingsRows, unit_types, rawContracts, utilities] = await Promise.all([
            Payment.find({ tenantId: { $in: tenantIds } }).sort({ date: -1 }).lean(),
            Setting.find({ userId: req.userId }).lean(),
            UnitType.find().lean(),
            Contract.find({ tenantId: { $in: tenantIds } }).lean(),
            Utility.find({ apartmentId: { $in: aptIds } }).lean()
        ]);

        const contracts = rawContracts.map(c => ({
            ...c,
            agreedDay: c.agreedDay !== undefined ? c.agreedDay : c.agreedPaymentDay,
            deposit: c.deposit !== undefined ? c.deposit : c.depositAmount,
            notes: c.notes !== undefined ? c.notes : c.terms,
            active: c.active !== undefined ? c.active : (c.status === 'Active')
        }));
        
        const settings = {};
        settingsRows.forEach(row => settings[row.key] = row.value);
        if (!settings.currency) settings.currency = 'CFA';
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
            
            let hasAccess = false;
            if (tenant.userId && tenant.userId === req.userId) {
                hasAccess = true;
            } else if (tenant.apartmentId) {
                const apt = mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId));
                const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
                if (prop) hasAccess = true;
            } else {
                hasAccess = true;
            }
            if (!hasAccess) return res.status(403).json({ error: 'Tenant access denied.' });

            mockPOST('payments', req.body); 
            return res.status(201).json({ status: 'success' }); 
        }
        
        const tenant = await Tenant.findOne({ id: tenantId });
        if (!tenant) return res.status(400).json({ error: 'Tenant not found.' });
        
        let hasAccess = false;
        if (tenant.userId && tenant.userId === req.userId) {
            hasAccess = true;
        } else if (tenant.apartmentId) {
            const apt = await Apartment.findOne({ id: tenant.apartmentId });
            const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
            if (prop) hasAccess = true;
        } else {
            hasAccess = true;
        }
        if (!hasAccess) return res.status(403).json({ error: 'Tenant access denied.' });

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
            
            let hasAccess = false;
            if (tenant) {
                if (tenant.userId && tenant.userId === req.userId) {
                    hasAccess = true;
                } else if (tenant.apartmentId) {
                    const apt = mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId));
                    const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
                    if (prop) hasAccess = true;
                } else {
                    hasAccess = true;
                }
            } else {
                hasAccess = true;
            }
            if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

            if (tenant) {
                if (payment.type === 'Deposit') {
                    tenant.depositPaidAmount = Math.max(0, (tenant.depositPaidAmount || 0) - payment.amount);
                    tenant.depositMonthsPaid = Math.max(0, (tenant.depositMonthsPaid || 0) - (payment.depositMonths || 0));
                } else {
                    const remainingRentPayments = mockData.payments.filter(p => 
                        String(p.id) !== String(req.params.id) && 
                        String(p.tenantId) === String(payment.tenantId) && 
                        p.type !== 'Deposit'
                    );
                    const latestMonth = remainingRentPayments.map(p => p.monthPaid).sort().pop() || '';
                    tenant.lastPaidMonth = latestMonth;
                }
            }

            mockData.payments = mockData.payments.filter(p => String(p.id) !== String(req.params.id));
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const payment = await Payment.findOne({ id: req.params.id });
        if (!payment) return res.status(404).json({ error: 'Payment not found.' });
        const tenant = await Tenant.findOne({ id: payment.tenantId });
        
        let hasAccess = false;
        if (tenant) {
            if (tenant.userId && tenant.userId === req.userId) {
                hasAccess = true;
            } else if (tenant.apartmentId) {
                const apt = await Apartment.findOne({ id: tenant.apartmentId });
                const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
                if (prop) hasAccess = true;
            } else {
                hasAccess = true;
            }
        } else {
            hasAccess = true;
        }
        if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

        if (tenant) {
            if (payment.type === 'Deposit') {
                tenant.depositPaidAmount = Math.max(0, (tenant.depositPaidAmount || 0) - payment.amount);
                tenant.depositMonthsPaid = Math.max(0, (tenant.depositMonthsPaid || 0) - (payment.depositMonths || 0));
            } else {
                const remainingRentPayments = await Payment.find({ 
                    id: { $ne: req.params.id }, 
                    tenantId: payment.tenantId, 
                    type: { $ne: 'Deposit' } 
                }).lean();
                const latestMonth = remainingRentPayments.map(p => p.monthPaid).sort().pop() || '';
                tenant.lastPaidMonth = latestMonth;
            }
            await tenant.save();
        }

        await Payment.findOneAndDelete({ id: req.params.id });
        res.json({ status: 'success' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/payments/:id', authMiddleware, async (req, res) => {
    const { amount, date, note } = req.body;
    try {
        if (!isConnected()) {
            const payment = mockData.payments.find(p => String(p.id) === String(req.params.id));
            if (!payment) return res.status(404).json({ error: 'Payment not found.' });
            
            const tenant = mockData.tenants.find(t => String(t.id) === String(payment.tenantId));
            const apt = tenant ? mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId)) : null;
            const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
            if (!prop) return res.status(403).json({ error: 'Access denied.' });

            payment.amount = Number(amount) || payment.amount;
            payment.date = date || payment.date;
            payment.note = note !== undefined ? note : payment.note;
            saveMock();
            return res.json({ status: 'success' });
        }
        
        const payment = await Payment.findOne({ id: req.params.id });
        if (!payment) return res.status(404).json({ error: 'Payment not found.' });
        
        const tenant = await Tenant.findOne({ id: payment.tenantId });
        if (tenant) {
            const apt = await Apartment.findOne({ id: tenant.apartmentId });
            const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
            if (!prop) return res.status(403).json({ error: 'Access denied.' });
        }

        await Payment.findOneAndUpdate(
            { id: req.params.id }, 
            { 
                amount: Number(amount) || undefined, 
                date: date || undefined, 
                note: note !== undefined ? note : undefined 
            }
        );
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
        if (apartmentId) {
            if (!isConnected()) { 
                const apt = mockData.apartments.find(a => String(a.id) === String(apartmentId));
                const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
                if (!prop) return res.status(403).json({ error: 'Apartment access denied.' });
            } else {
                const apt = await Apartment.findOne({ id: apartmentId });
                const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
                if (!prop) return res.status(403).json({ error: 'Apartment access denied.' });
            }
        }

        // Ensure active unit is not already occupied by another active tenant
        const isAssigned = req.body.isAssigned !== false;
        if (isAssigned && apartmentId) {
            if (!isConnected()) {
                const occupied = mockData.tenants.some(t => String(t.apartmentId) === String(apartmentId) && t.isAssigned !== false);
                if (occupied) return res.status(400).json({ error: 'This unit is already occupied by an active tenant.' });
            } else {
                const occupied = await Tenant.findOne({ apartmentId, isAssigned: { $ne: false } });
                if (occupied) return res.status(400).json({ error: 'This unit is already occupied by an active tenant.' });
            }
        }

        if (!isConnected()) { 
            const newTenant = {
                ...req.body,
                userId: req.userId,
                paymentToken: req.body.paymentToken || crypto.randomUUID()
            };
            mockPOST('tenants', newTenant); 
            return res.status(201).json({ status: 'success', tenant: newTenant }); 
        }
        
        const tenantData = {
            ...req.body,
            userId: req.userId,
            paymentToken: req.body.paymentToken || crypto.randomUUID()
        };
        const createdTenant = await Tenant.create(tenantData); 
        res.status(201).json({ status: 'success', tenant: createdTenant }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tenants/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const tenant = mockData.tenants.find(t => String(t.id) === String(req.params.id));
            if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

            // Verify ownership of the existing tenant
            let hasAccess = false;
            if (tenant.userId && tenant.userId === req.userId) {
                hasAccess = true;
            } else if (tenant.apartmentId) {
                const apt = mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId));
                const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
                if (prop) hasAccess = true;
            } else {
                hasAccess = true;
            }
            if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

            // Verify access to the new apartment if provided
            if (req.body.apartmentId) {
                const newApt = mockData.apartments.find(a => String(a.id) === String(req.body.apartmentId));
                const newProp = newApt ? mockData.properties.find(p => String(p.id) === String(newApt.propertyId) && p.userId === req.userId) : null;
                if (!newProp) return res.status(403).json({ error: 'Access denied to new apartment.' });
            }

            // Ensure active unit is not already occupied by another active tenant
            const checkAssigned = req.body.isAssigned !== undefined ? (req.body.isAssigned !== false) : (tenant.isAssigned !== false);
            const checkAptId = req.body.apartmentId !== undefined ? req.body.apartmentId : tenant.apartmentId;
            if (checkAssigned && checkAptId) {
                const occupied = mockData.tenants.some(t => String(t.apartmentId) === String(checkAptId) && t.isAssigned !== false && String(t.id) !== String(req.params.id));
                if (occupied) return res.status(400).json({ error: 'The selected unit is currently occupied by another active tenant.' });
            }

            mockData.tenants = mockData.tenants.map(t => String(t.id) === String(req.params.id) ? { ...t, ...req.body } : t);
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const tenant = await Tenant.findOne({ id: req.params.id });
        if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

        // Verify ownership of the existing tenant
        let hasAccess = false;
        if (tenant.userId && tenant.userId === req.userId) {
            hasAccess = true;
        } else if (tenant.apartmentId) {
            const apt = await Apartment.findOne({ id: tenant.apartmentId });
            const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
            if (prop) hasAccess = true;
        } else {
            hasAccess = true;
        }
        if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

        // Verify access to the new apartment if provided
        if (req.body.apartmentId) {
            const newApt = await Apartment.findOne({ id: req.body.apartmentId });
            const newProp = newApt ? await Property.findOne({ id: newApt.propertyId, userId: req.userId }) : null;
            if (!newProp) return res.status(403).json({ error: 'Access denied to new apartment.' });
        }

        // Ensure active unit is not already occupied by another active tenant
        const checkAssigned = req.body.isAssigned !== undefined ? (req.body.isAssigned !== false) : (tenant.isAssigned !== false);
        const checkAptId = req.body.apartmentId !== undefined ? req.body.apartmentId : tenant.apartmentId;
        if (checkAssigned && checkAptId) {
            const occupied = await Tenant.findOne({ apartmentId: checkAptId, isAssigned: { $ne: false }, id: { $ne: req.params.id } });
            if (occupied) return res.status(400).json({ error: 'The selected unit is currently occupied by another active tenant.' });
        }

        await Tenant.findOneAndUpdate({ id: req.params.id }, req.body); 
        res.json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tenants/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const tenant = mockData.tenants.find(t => String(t.id) === String(req.params.id));
            if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });
            
            let hasAccess = false;
            if (tenant.userId && tenant.userId === req.userId) {
                hasAccess = true;
            } else if (tenant.apartmentId) {
                const apt = mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId));
                const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
                if (prop) hasAccess = true;
            } else {
                hasAccess = true;
            }
            if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

            mockData.tenants = mockData.tenants.filter(t => String(t.id) !== String(req.params.id));
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const tenant = await Tenant.findOne({ id: req.params.id });
        if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });
        
        let hasAccess = false;
        if (tenant.userId && tenant.userId === req.userId) {
            hasAccess = true;
        } else if (tenant.apartmentId) {
            const apt = await Apartment.findOne({ id: tenant.apartmentId });
            const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
            if (prop) hasAccess = true;
        } else {
            hasAccess = true;
        }
        if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

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
            
            let hasAccess = false;
            if (tenant.userId && tenant.userId === req.userId) {
                hasAccess = true;
            } else if (tenant.apartmentId) {
                const apt = mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId));
                const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
                if (prop) hasAccess = true;
            } else {
                hasAccess = true;
            }
            if (!hasAccess) return res.status(403).json({ error: 'Tenant access denied.' });

            mockPOST('contracts', req.body); 
            return res.status(201).json({ status: 'success' }); 
        }
        
        const tenant = await Tenant.findOne({ id: tenantId });
        if (!tenant) return res.status(400).json({ error: 'Tenant not found.' });
        
        let hasAccess = false;
        if (tenant.userId && tenant.userId === req.userId) {
            hasAccess = true;
        } else if (tenant.apartmentId) {
            const apt = await Apartment.findOne({ id: tenant.apartmentId });
            const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
            if (prop) hasAccess = true;
        } else {
            hasAccess = true;
        }
        if (!hasAccess) return res.status(403).json({ error: 'Tenant access denied.' });

        const contractData = {
            ...req.body,
            agreedPaymentDay: req.body.agreedDay !== undefined ? req.body.agreedDay : req.body.agreedPaymentDay,
            depositAmount: req.body.deposit !== undefined ? req.body.deposit : req.body.depositAmount,
            terms: req.body.notes !== undefined ? req.body.notes : req.body.terms,
            status: req.body.active !== undefined ? (req.body.active ? 'Active' : 'Inactive') : req.body.status
        };

        await Contract.create(contractData); 
        res.status(201).json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/contracts/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const contract = mockData.contracts.find(c => String(c.id) === String(req.params.id));
            if (!contract) return res.status(404).json({ error: 'Contract not found.' });
            const tenant = mockData.tenants.find(t => String(t.id) === String(contract.tenantId));
            
            let hasAccess = false;
            if (tenant) {
                if (tenant.userId && tenant.userId === req.userId) {
                    hasAccess = true;
                } else if (tenant.apartmentId) {
                    const apt = mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId));
                    const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
                    if (prop) hasAccess = true;
                } else {
                    hasAccess = true;
                }
            } else {
                hasAccess = true;
            }
            if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

            mockData.contracts = mockData.contracts.map(c => String(c.id) === String(req.params.id) ? { ...c, ...req.body } : c);
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const contract = await Contract.findOne({ id: req.params.id });
        if (!contract) return res.status(404).json({ error: 'Contract not found.' });
        const tenant = await Tenant.findOne({ id: contract.tenantId });
        
        let hasAccess = false;
        if (tenant) {
            if (tenant.userId && tenant.userId === req.userId) {
                hasAccess = true;
            } else if (tenant.apartmentId) {
                const apt = await Apartment.findOne({ id: tenant.apartmentId });
                const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
                if (prop) hasAccess = true;
            } else {
                hasAccess = true;
            }
        } else {
            hasAccess = true;
        }
        if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

        const contractData = {
            ...req.body,
            agreedPaymentDay: req.body.agreedDay !== undefined ? req.body.agreedDay : req.body.agreedPaymentDay,
            depositAmount: req.body.deposit !== undefined ? req.body.deposit : req.body.depositAmount,
            terms: req.body.notes !== undefined ? req.body.notes : req.body.terms,
            status: req.body.active !== undefined ? (req.body.active ? 'Active' : 'Inactive') : req.body.status
        };

        await Contract.findOneAndUpdate({ id: req.params.id }, contractData); 
        res.json({ status: 'success' }); 
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/contracts/:id', authMiddleware, async (req, res) => {
    try {
        if (!isConnected()) {
            const contract = mockData.contracts.find(c => String(c.id) === String(req.params.id));
            if (!contract) return res.status(404).json({ error: 'Contract not found.' });
            const tenant = mockData.tenants.find(t => String(t.id) === String(contract.tenantId));
            
            let hasAccess = false;
            if (tenant) {
                if (tenant.userId && tenant.userId === req.userId) {
                    hasAccess = true;
                } else if (tenant.apartmentId) {
                    const apt = mockData.apartments.find(a => String(a.id) === String(tenant.apartmentId));
                    const prop = apt ? mockData.properties.find(p => String(p.id) === String(apt.propertyId) && p.userId === req.userId) : null;
                    if (prop) hasAccess = true;
                } else {
                    hasAccess = true;
                }
            } else {
                hasAccess = true;
            }
            if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

            mockData.contracts = mockData.contracts.filter(c => String(c.id) !== String(req.params.id));
            saveMock(); 
            return res.json({ status: 'success' });
        }
        
        const contract = await Contract.findOne({ id: req.params.id });
        if (!contract) return res.status(404).json({ error: 'Contract not found.' });
        const tenant = await Tenant.findOne({ id: contract.tenantId });
        
        let hasAccess = false;
        if (tenant) {
            if (tenant.userId && tenant.userId === req.userId) {
                hasAccess = true;
            } else if (tenant.apartmentId) {
                const apt = await Apartment.findOne({ id: tenant.apartmentId });
                const prop = apt ? await Property.findOne({ id: apt.propertyId, userId: req.userId }) : null;
                if (prop) hasAccess = true;
            } else {
                hasAccess = true;
            }
        } else {
            hasAccess = true;
        }
        if (!hasAccess) return res.status(403).json({ error: 'Access denied.' });

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
