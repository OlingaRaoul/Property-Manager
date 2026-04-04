# Property Manager Admin🏢

A comprehensive, state-of-the-art property management suite built to simplify the operations of modern real estate portfolios. Property Manager Admin handles everything from tracking units and tenants to recording rent ledgers, distributing digital PDF receipts, and monitoring overdue payments effortlessly.

---

## ✨ Key Features

- **Property & Tenant Logistics:**
  - Create and manage unlimited properties and sub-units.
  - Dynamically assign and unassign tenants to active units.
  - Track lease details and rental variations seamlessly.
- **Financial Ledger Engine:**
  - Integrated billing logic that automatically distinguishes between pre-payments, overdue intervals, and settled accounts based on precise calendar dates.
  - Centralized portfolio dashboard displaying instant revenue analytics and overdue arrears.
- **Smart Digital Receipts & Utilities:**
  - Instant server-side generation of elegant `.pdf` rent and utility receipts.
  - Native integration with standard SMTP providers, enabling single-click email dispatch to your tenants with their receipts securely attached.
  - Tracking system for utilities (water, electricity) across properties.
- **Global & Extensible Configurations:**
  - Real-time locale swapping (English/Français).
  - Dynamic currency configurations handling a global array of operational symbols.
  - Granular management configurations, modularly decoupled into focused Javascript components.
  
---

## 🛠️ Technology Stack

The architecture relies on a highly performant and secure stack that limits heavy dependencies:

* **Frontend:**
  * Clean **Vanilla HTML/CSS/JS** paired with Lucide Icons for rapid execution and unparalleled browser compatibility without build-step clutter.
  * Modular UI dynamically hydrated by responsive JavaScript files logic `(js/*.js)`.
* **Backend:**
  * **Node.js** running an **Express** web server engine.
  * Rapid data persistence via local **better-sqlite3** bindings, acting as an extremely robust lightweight database (`aura.db`).
  * **Nodemailer** + **PDFKit** to transform raw receipt streams and distribute files effortlessly.

---

## 🚀 Installation & Setup

Want to run Property Manager Admin on a local server or deploy?

**1. Clone the repository**
```bash
git clone https://github.com/OlingaRaoul/Property-Manager.git
cd Property-Manager
```

**2. Install runtime dependencies**
The backend relies on specifically mapped packages to render PDFs and proxy connections:
```bash
npm install
```

**3. Launch the Server Environment**
Start the central Aura application wrapper:
```bash
node server.js
```
*The server will securely boot to handle the API and database on port 3000.*

**4. Open Dashboard in Browser**
Access the fully realized interface by heading directly to:
👉 [http://localhost:3000](http://localhost:3000)

*(Note: To safeguard CORS policies, ensure you access the app over localhost rather than statically double-clicking `index.html`).*

---

## 📂 Project Structure

```bash
├── package.json        # Dependencies (Express, SQLite3, Nodemailer, PDFKit)
├── server.js           # Core backend endpoints & data manipulation engine
├── index.html          # Primary Single-Page-Application View structure
├── style.css           # CSS Variables, Design System & Grid layout logic
├── .gitignore          # Security rules preventing upload of dynamic local data
└── js/                 # Modularized Application Logic
    ├── state.js          # Core storage and locale state engine
    ├── actions.js        # Global dispatch window configurations
    ├── events.js         # Broad structural DOM Content Handlers 
    ├── modals.js         # Dialog creation and transition routing
    ├── receipts.js       # Transaction interception and receipt payload prep
    ├── rent-engine.js    # Arrears metrics and billing horizon mathematics
    ├── view-routing.js   # Side-bar view switching configuration
    └── render.js         # Massive UI/UX rendering engine (Stats, Charts)
```

---

## 🔐 Security & SMTP Guidelines

When interacting with the Email Receipt functionality located inside the **Configure SMTP** dashboard module:
1. We recommended you utilize **App Passwords** (often generated statically from your Google or Microsoft Provider) rather than primary personal passwords to guarantee authorization bounds context.
2. The `aura.db` file is fully ignored from public syncing natively via `.gitignore`, permanently restricting any risk of leaking sensitive tenant configurations or saved SMTP hashes upstream to GitHub.
