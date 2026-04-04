const Database = require('better-sqlite3');
const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

const app = express();
const db = new Database('aura.db', { verbose: console.log });

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// --- Database Setup ---
// IF NOT EXISTS ensures persistence on restart

db.prepare(`
  CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS apartments (
    id TEXT PRIMARY KEY,
    propertyId TEXT,
    unitNumber TEXT,
    type TEXT,
    FOREIGN KEY (propertyId) REFERENCES properties(id)
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    apartmentId TEXT,
    rentAmount INTEGER,
    dueDateDay INTEGER,
    lastPaidMonth TEXT,
    FOREIGN KEY (apartmentId) REFERENCES apartments(id)
  )
`).run();

// Payments Table
db.prepare(`
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    tenantId TEXT,
    amount INTEGER,
    date TEXT,
    monthPaid TEXT,
    FOREIGN KEY (tenantId) REFERENCES tenants(id)
  )
`).run();

// Settings table
db.prepare(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`).run();

// Unit Types table
db.prepare(`
  CREATE TABLE IF NOT EXISTS unit_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  )
`).run();

// Contracts Table
db.prepare(`
  CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    tenantId TEXT,
    startDate TEXT,
    endDate TEXT,
    terms TEXT,
    status TEXT,
    FOREIGN KEY (tenantId) REFERENCES tenants(id)
  )
`).run();

// Utilities Table
db.prepare(`
  CREATE TABLE IF NOT EXISTS utilities (
    id TEXT PRIMARY KEY,
    apartmentId TEXT,
    tenantId TEXT,
    type TEXT NOT NULL,
    lastReading REAL,
    currentReading REAL,
    amount REAL,
    date TEXT,
    status TEXT DEFAULT 'Unpaid',
    month TEXT,
    FOREIGN KEY (apartmentId) REFERENCES apartments(id),
    FOREIGN KEY (tenantId) REFERENCES tenants(id)
  )
`).run();

// Default unit types if not exists
const checkTypes = db.prepare('SELECT * FROM unit_types').get();
if (!checkTypes) {
    db.prepare('INSERT INTO unit_types (id, name) VALUES (?, ?)').run('1', 'Room');
    db.prepare('INSERT INTO unit_types (id, name) VALUES (?, ?)').run('2', 'Studio');
}

// Default currency if not exists
const checkSettings = db.prepare('SELECT * FROM settings WHERE key = ?').get('currency');
if (!checkSettings) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('currency', '$');
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('lang', 'en');
}

// --- API Endpoints ---

// Contracts CRUD (MOVED UP FOR PRIORITY)
app.get('/api/contracts', (req, res) => {
    console.log("Fetching all contracts...");
    const contracts = db.prepare('SELECT * FROM contracts').all();
    res.json(contracts);
});

app.post('/api/contracts', (req, res) => {
    console.log("Contract record request received:", req.body);
    const { id, tenantId, startDate, endDate, terms, status } = req.body;
    try {
        db.prepare(`
            INSERT INTO contracts (id, tenantId, startDate, endDate, terms, status) 
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, tenantId, startDate, endDate, terms, status);
        res.status(201).json({ status: 'success' });
    } catch (e) {
        console.error("Contract Save Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'Property Manager Admin Server Online', version: '1.2.0-contracts' });
});

app.get('/api/data', (req, res) => {
    const properties = db.prepare('SELECT * FROM properties').all();
    const apartments = db.prepare('SELECT * FROM apartments').all();
    const tenants = db.prepare('SELECT * FROM tenants').all();
    const payments = db.prepare('SELECT * FROM payments ORDER BY date DESC').all();
    const settingsRows = db.prepare('SELECT * FROM settings').all();
    const unit_types = db.prepare('SELECT * FROM unit_types').all();
    const contracts = db.prepare('SELECT * FROM contracts').all();
    const utilities = db.prepare('SELECT * FROM utilities').all();
    
    // Convert settings rows to key-value object
    const settings = {};
    settingsRows.forEach(row => settings[row.key] = row.value);
    
    res.json({ properties, apartments, tenants, payments, settings, unit_types, contracts, utilities });
});

// Add Payment
app.post('/api/payments', (req, res) => {
    const { id, tenantId, amount, date, monthPaid } = req.body;
    db.prepare('INSERT INTO payments (id, tenantId, amount, date, monthPaid) VALUES (?, ?, ?, ?, ?)')
      .run(id, tenantId, amount, date, monthPaid);
    res.status(201).json({ status: 'success' });
});

app.put('/api/payments/:id', (req, res) => {
    const { amount, date, monthPaid } = req.body;
    db.prepare('UPDATE payments SET amount = ?, date = ?, monthPaid = ? WHERE id = ?')
      .run(amount, date, monthPaid, req.params.id);
    res.json({ status: 'success' });
});

app.delete('/api/payments/:id', (req, res) => {
    db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
    res.json({ status: 'success' });
});

// Update Settings
app.post('/api/settings', (req, res) => {
    const { key, value } = req.body;
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(key, value);
    res.json({ status: 'success' });
});

// Add Property
app.post('/api/properties', (req, res) => {
    const { id, name, address } = req.body;
    db.prepare('INSERT INTO properties (id, name, address) VALUES (?, ?, ?)')
      .run(id, name, address);
    res.status(201).json({ status: 'success' });
});

// Update Property
app.put('/api/properties/:id', (req, res) => {
    const { name, address } = req.body;
    db.prepare('UPDATE properties SET name = ?, address = ? WHERE id = ?')
      .run(name, address, req.params.id);
    res.json({ status: 'success' });
});

// Delete Property
app.delete('/api/properties/:id', (req, res) => {
    const id = req.params.id;
    // Delete tenants first (linked to apartments in this property)
    db.prepare('DELETE FROM tenants WHERE apartmentId IN (SELECT id FROM apartments WHERE propertyId = ?)').run(id);
    // Delete apartments in this property
    db.prepare('DELETE FROM apartments WHERE propertyId = ?').run(id);
    // Finally delete the property
    db.prepare('DELETE FROM properties WHERE id = ?').run(id);
    res.json({ status: 'success' });
});

// Add Apartment
app.post('/api/apartments', (req, res) => {
    const { id, propertyId, unitNumber, type } = req.body;
    db.prepare('INSERT INTO apartments (id, propertyId, unitNumber, type) VALUES (?, ?, ?, ?)')
      .run(id, propertyId, unitNumber, type);
    res.status(201).json({ status: 'success' });
});

// Add Tenant
app.post('/api/tenants', (req, res) => {
    const { id, name, email, apartmentId, rentAmount, dueDateDay, lastPaidMonth } = req.body;
    db.prepare(`
        INSERT INTO tenants (id, name, email, apartmentId, rentAmount, dueDateDay, lastPaidMonth) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, email || '', apartmentId, rentAmount, dueDateDay, lastPaidMonth || '');
    res.status(201).json({ status: 'success' });
});

// Update Tenant
app.put('/api/tenants/:id', (req, res) => {
    const { name, email, rentAmount, dueDateDay, apartmentId } = req.body;
    db.prepare('UPDATE tenants SET name = ?, email = ?, rentAmount = ?, dueDateDay = ?, apartmentId = ? WHERE id = ?')
      .run(name, email || '', rentAmount, dueDateDay, apartmentId, req.params.id);
    res.json({ status: 'success' });
});

// Delete Tenant (Removes tenant from room)
app.delete('/api/tenants/:id', (req, res) => {
    db.prepare('DELETE FROM tenants WHERE id = ?').run(req.params.id);
    res.json({ status: 'success' });
});

// Update Paid Month
app.patch('/api/tenants/:id/pay', (req, res) => {
    const { lastPaidMonth } = req.body;
    db.prepare('UPDATE tenants SET lastPaidMonth = ? WHERE id = ?')
      .run(lastPaidMonth, req.params.id);
    res.json({ status: 'success' });
});

// --- Utilities API ---
app.get('/api/utilities', (req, res) => {
    const rows = db.prepare('SELECT * FROM utilities').all();
    res.json(rows);
});

app.post('/api/utilities', (req, res) => {
    const { id, apartmentId, tenantId, type, lastReading, currentReading, amount, date, status, month } = req.body;
    db.prepare(`
        INSERT INTO utilities (id, apartmentId, tenantId, type, lastReading, currentReading, amount, date, status, month)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, apartmentId, tenantId, type, lastReading, currentReading, amount, date, status || 'Unpaid', month);
    res.status(201).json({ status: 'success' });
});

app.patch('/api/utilities/:id', (req, res) => {
    const { status } = req.body;
    db.prepare('UPDATE utilities SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ status: 'success' });
});

app.delete('/api/utilities/:id', (req, res) => {
    db.prepare('DELETE FROM utilities WHERE id = ?').run(req.params.id);
    res.json({ status: 'success' });
});

// --- SMTP Settings API ---
app.get('/api/smtp-settings', (req, res) => {
    const rows = db.prepare("SELECT * FROM settings WHERE key LIKE 'smtp_%'").all();
    const smtp = {};
    rows.forEach(r => smtp[r.key.replace('smtp_', '')] = r.value);
    res.json(smtp);
});

app.post('/api/smtp-settings', (req, res) => {
    const { host, port, user, pass, from } = req.body;
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    upsert.run('smtp_host', host || '');
    upsert.run('smtp_port', String(port || 587));
    upsert.run('smtp_user', user || '');
    upsert.run('smtp_pass', pass || '');
    upsert.run('smtp_from', from || user || '');
    res.json({ status: 'success' });
});

// Send Receipt via Email — Real Nodemailer (with PDF Attachment)
app.post('/api/send-receipt', async (req, res) => {
    const { to, subject, body } = req.body;
    
    // Load SMTP credentials from DB
    const rows = db.prepare("SELECT * FROM settings WHERE key LIKE 'smtp_%'").all();
    const smtp = {};
    rows.forEach(r => smtp[r.key.replace('smtp_', '')] = r.value);
    
    if (!smtp.host || !smtp.user || !smtp.pass) {
        console.log(`📧 [MOCK] To: ${to} | Subject: ${subject}`);
        return res.json({ status: 'success', message: 'Logged (no SMTP configured).' });
    }
    
    try {
        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: parseInt(smtp.port) || 587,
            secure: parseInt(smtp.port) === 465,
            auth: { user: smtp.user, pass: smtp.pass }
        });
        
        // Generate PDF Document in Memory
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        
        doc.fontSize(20).text('PROPERTY MANAGER ADMIN', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).font('Courier').text(body);
        doc.end();

        const pdfBuffer = await new Promise((resolve) => {
            doc.on('end', () => {
                resolve(Buffer.concat(buffers));
            });
        });
        
        // Send email with PDF attachment
        await transporter.sendMail({
            from: `"Property Manager Admin" <${smtp.from || smtp.user}>`,
            to,
            subject,
            text: body,
            attachments: [
                {
                    filename: 'Receipt.pdf',
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        });
        
        console.log(`✅ Email sent to ${to} with PDF Attachment`);
        res.json({ status: 'success', message: `Email sent to ${to}` });
    } catch (err) {
        console.error('❌ Email send error:', err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Seed Data Endpoint
app.post('/api/seed', (req, res) => {
    db.prepare('DELETE FROM tenants').run();
    db.prepare('DELETE FROM apartments').run();
    db.prepare('DELETE FROM properties').run();

    const props = [
        { id: 'p1', name: 'Westside Towers', address: '123 Main St' },
        { id: 'p2', name: 'Azure Heights', address: '45 Skyway' },
        { id: 'p4', name: 'Summit View', address: '88 Hillcrest Rd' }
    ];

    const propStmt = db.prepare('INSERT INTO properties (id, name, address) VALUES (@id, @name, @address)');
    props.forEach(p => propStmt.run(p));

    const apps = [
        { id: 'a1', propertyId: 'p1', unitNumber: 'Apt 304', type: 'Studio' },
        { id: 'a2', propertyId: 'p1', unitNumber: 'Apt 102', type: 'Room' },
        { id: 'a3', propertyId: 'p2', unitNumber: 'Suite A', type: 'Studio' },
        { id: 'a4', propertyId: 'p4', unitNumber: 'PH 1', type: 'Studio' }
    ];

    const appStmt = db.prepare('INSERT INTO apartments (id, propertyId, unitNumber, type) VALUES (@id, @propertyId, @unitNumber, @type)');
    apps.forEach(a => appStmt.run(a));

    const tenants = [
        { id: 't1', name: 'Sarah Chen', apartmentId: 'a1', rentAmount: 2850, dueDateDay: 1, lastPaidMonth: '2026-04' },
        { id: 't2', name: 'David Lee', apartmentId: 'a2', rentAmount: 2850, dueDateDay: 2, lastPaidMonth: '2026-03' },
        { id: 't3', name: 'Maria Garcia', apartmentId: 'a3', rentAmount: 3200, dueDateDay: 15, lastPaidMonth: '2026-03' }
    ];

    const tenantStmt = db.prepare('INSERT INTO tenants (id, name, apartmentId, rentAmount, dueDateDay, lastPaidMonth) VALUES (@id, @name, @apartmentId, @rentAmount, @dueDateDay, @lastPaidMonth)');
    tenants.forEach(t => tenantStmt.run(t));

    const pastPayments = [
        { id: 'pay1', tenantId: 't1', amount: 2850, date: '2026-01-05', monthPaid: '2026-01' },
        { id: 'pay2', tenantId: 't1', amount: 2850, date: '2026-02-04', monthPaid: '2026-02' },
        { id: 'pay3', tenantId: 't1', amount: 2850, date: '2026-03-02', monthPaid: '2026-03' },
        { id: 'pay4', tenantId: 't1', amount: 2850, date: '2026-04-01', monthPaid: '2026-04' },
        
        { id: 'pay5', tenantId: 't2', amount: 2850, date: '2026-01-10', monthPaid: '2026-01' },
        { id: 'pay6', tenantId: 't2', amount: 2850, date: '2026-02-08', monthPaid: '2026-02' },
        
        { id: 'pay7', tenantId: 't3', amount: 3200, date: '2026-03-20', monthPaid: '2026-03' }
    ];

    const payStmt = db.prepare('INSERT INTO payments (id, tenantId, amount, date, monthPaid) VALUES (@id, @tenantId, @amount, @date, @monthPaid)');
    pastPayments.forEach(p => payStmt.run(p));

    res.json({ message: 'Hierarchical dummy data and historical payments seeded successfully!' });
});

// Unit Types CRUD
app.post('/api/unit-types', (req, res) => {
    const { id, name } = req.body;
    db.prepare('INSERT INTO unit_types (id, name) VALUES (?, ?)').run(id, name);
    res.status(201).json({ status: 'success' });
});

app.delete('/api/unit-types/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM unit_types WHERE id = ?').run(id);
    res.status(200).json({ status: 'success' });
});

// Contracts CRUD
app.post('/api/contracts', (req, res) => {
    const { id, tenantId, startDate, endDate, terms, status } = req.body;
    db.prepare(`
        INSERT INTO contracts (id, tenantId, startDate, endDate, terms, status) 
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, tenantId, startDate, endDate, terms, status);
    res.status(201).json({ status: 'success' });
});

app.put('/api/contracts/:id', (req, res) => {
    const { startDate, endDate, terms, status } = req.body;
    db.prepare('UPDATE contracts SET startDate = ?, endDate = ?, terms = ?, status = ? WHERE id = ?')
      .run(startDate, endDate, terms, status, req.params.id);
    res.json({ status: 'success' });
});

app.delete('/api/contracts/:id', (req, res) => {
    db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params.id);
    res.json({ status: 'success' });
});

// Server boot
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Property Manager Admin Database Server running at http://localhost:${PORT}`);
});
