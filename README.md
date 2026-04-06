# Property Manager Pro 🏢

[![MERN Stack](https://img.shields.io/badge/Stack-MERN-blue.svg)](https://mongodb.com)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://reactjs.org)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](https://nodejs.org)

A premium, state-of-the-art property management suite migrated from legacy monolithic structures to a modern **MERN stack**. Designed with the **BankDash** aesthetic, it provides a seamless experience for managing properties, tenants, and full financial lifecycles.

---

### 🚀 Live Demo
### 👉 [**View Property Manager Pro Live**](https://property-manager-xi-pearl.vercel.app/)

---

## ✨ Key Features

### 📊 Portfolio Dashboard
- **Instant Insights**: Real-time visualization of revenue, billed utilities, and outstanding arrears.
- **KPI Summary**: Quick-glance cards for Total Readings, Total Billed, and Outstanding balances.

### 👥 Tenant & Unit Registry
- **Modern Typography**: Integrated **Sora** and **Outfit** fonts for a geometric, premium look.
- **Dynamic Leasing**: Manage properties and units with easy tenant assignment and unassignment.

### 💰 Advanced Payment Ledger
- **Multi-Month Selection**: A 19-month rolling grid (6 past, current, 12 future) for flexible billing.
- **Advance Payments**: Support for future rent payments with unique visual highlighting.
- **Smart Due Dates**: Derived directly from active contracts, ensuring precision in "Paid" vs "Due" status.
- **Professional Receipts**: One-click **Print Receipt** feature that generates a clean, standalone HTML receipt in a new window for perfect browser printing (A5 optimized).

### 📜 Intelligent Contracts
- **Automated Due Logic**: Set an "agreed day" for payments. The system automatically caps the due date to the last day of shorter months (e.g., Feb 28th if the agreed day is 31st).
- **Full CRUD**: Detailed contract management with live due-date previews.

### ⚡ Utility Consumption Audit
- **Multi-Service Tracking**: Record readings for Electricity (Zap), Water (Droplet), and Gas (Flame).
- **Live Calculator**: Auto-computes `units consumed × rate = amount` instantly during data entry.
- **Bidirectional Toggles**: Easily mark utilities as Paid or revert them to Unpaid with a single click.

---

## 🛠️ Technology Stack

### Frontend
- **React.js (Vite)**: For a high-performance, single-page application experience.
- **Design System**: Custom Vanilla CSS inspired by **BankDash** (Premium Blue: `#2D60FF`).
- **Icons**: [Lucide-React](https://lucide.dev/) for consistent, beautiful iconography.
- **Typography**: Sora (Headers) and Outfit (Body) via Google Fonts.

### Backend
- **Node.js & Express**: Scalable RESTful API architecture.
- **MongoDB & Mongoose**: Flexible document storage with a robust schema for tenants, payments, and contracts.
- **Mock Fallback**: Integrated database connection detection that falls back to a JSON-based mock database if MongoDB is unreachable, ensuring zero downtime during development.

---

## 🚀 Installation & Setup

### 1. Prerequisites
- Node.js (v16+)
- MongoDB (Running locally or via Atlas)

### 2. Clone the Repository
```bash
git clone https://github.com/OlingaRaoul/Property-Manager.git
cd Property-Manager
```

### 3. Backend Setup
```bash
cd backend
npm install
npm start
```
*The API will be available at `http://localhost:3000`.*

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*The Dashboard will be accessible at `http://localhost:5173`.*

---

## 📂 Project Structure

```bash
├── backend/
│   ├── server.js          # Express API & MongoDB/Mock Logic
│   ├── mock_db.json       # Fallback storage for offline development
│   └── package.json       # Backend dependencies
├── frontend/
│   ├── src/
│   │   ├── pages/         # Dashboard, Tenants, Payments, Contracts, Utilities
│   │   ├── context/       # StateContext for global MERN data hydration
│   │   ├── utils.js       # Formatting and calculation helpers
│   │   └── App.jsx        # Routing and Layout
│   ├── index.html         # Google Fonts & Root entry
│   └── package.json       # Vite & React configurations
└── README.md              # Project Documentation
```

---

## 🔐 Data Security
- **Local Persistence**: All data is stored in your MongoDB instance.
- **Mock Mode**: When in mock mode, data is saved to `backend/mock_db.json` (ensure this is ignored in production).
- **Computer-Generated Receipts**: Receipts are generated client-side for privacy and speed, requiring no server-side signature.

## ☁️ Cloud Deployment
- **Frontend**: Hosted on **Vercel** ([Live Link](https://property-manager-xi-pearl.vercel.app/))
- **Backend API**: Hosted on **Render** (Auto-deploys on every commit)
- **Database**: **MongoDB Atlas** (Shared M0 Cluster)

---

## 📄 License
This project is licensed under the MIT License. Built with ❤️ by the Property Manager Pro Team.
