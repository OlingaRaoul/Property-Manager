# Implementation Plan — Multi-User Management & JWT Authentication

This plan outlines the architecture, database modifications, backend logic, and frontend components required to migrate **Property Manager Pro** from a single-manager application into a secure, multi-tenant platform. Each property manager will sign in to their own account and only view and control properties, units, tenants, contracts, utilities, and payments associated with their user profile.

---

## User Review Required

> [!IMPORTANT]
> **Data Migration & Backward Compatibility**:
> Existing database records do not have a `userId` field.
> To prevent application crashes and maintain compatibility with existing deployments, we will implement a automatic **migration/fallback mechanism**:
> * If a property lacks a `userId`, the backend will default its owner to a pre-defined system manager, or automatically assign it to the first registered user during the initial signup.
> * A script/handler will run on server start to migrate unassociated properties to a default user.

> [!WARNING]
> **Mock Mode Isolation**:
> We will also implement multi-tenant isolation in **Mock DB Mode** (`mock_db.json`). We'll update the mock endpoints in `server.js` to simulate user validation, JWT token returns, and mock record filtering.

---

## Open Questions

> [!IMPORTANT]
> **1. Public Signups vs. Admin Invitations**
> * **Option A (Recommended)**: Public signup allowed. Anyone can create an account and immediately start adding properties.
> * **Option B**: Managed signup. Users can only be created by an administrator, or signups are restricted via an access token.
> * *We will proceed with Option A (Public Signups) as it aligns best with product expansion, unless you specify otherwise.*
>
> **2. System Settings Scope**
> * Should the application currency and language settings be global (for the whole site) or custom per manager?
> * *We recommend making currency/language custom per user, saving settings using a composite key or a `userId` attribute.*

---

## Proposed Changes

### 📦 Dependencies Layer

#### [MODIFY] [package.json](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/backend/package.json)
* Add `bcryptjs` (password hashing) and `jsonwebtoken` (JWT creation/verification).
```json
"dependencies": {
  "bcryptjs": "^3.0.0",
  "jsonwebtoken": "^9.0.2",
  ...
}
```

---

### 🗄️ Database & Models

#### [MODIFY] [models.js](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/backend/models.js)
* **NEW** Add a `User` schema storing encrypted login credentials:
  ```javascript
  const UserSchema = new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true, lowercase: true },
      password: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
  });
  ```
* **MODIFY** Update `PropertySchema` and `SettingSchema` to include a relationship reference `userId`:
  ```javascript
  // Property Schema
  const PropertySchema = new mongoose.Schema({
      ...
      userId: { type: String, ref: 'User', required: true }
  });

  // Setting Schema
  const SettingSchema = new mongoose.Schema({
      key: { type: String, required: true },
      value: { type: String },
      userId: { type: String, ref: 'User', required: true } // Settings isolated per user
  });
  SettingSchema.index({ key: 1, userId: 1 }, { unique: true }); // Unique setting per manager
  ```

---

### 🛡️ Backend Middleware & Routing API

#### [MODIFY] [server.js](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/backend/server.js)
1. **JWT Verification Middleware**:
   Create a secure middleware to intercept `/api/...` routes:
   ```javascript
   const authMiddleware = (req, res, next) => {
       const header = req.headers.authorization;
       if (!header || !header.startsWith('Bearer ')) {
           return res.status(401).json({ error: 'Authorization token required.' });
       }
       const token = header.split(' ')[1];
       try {
           const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pm_super_secret_key_2026');
           req.userId = decoded.userId;
           next();
       } catch (err) {
           res.status(401).json({ error: 'Session expired. Please log in again.' });
       }
   };
   ```
2. **Auth API Handlers**:
   * `POST /api/auth/signup`: Hashes passwords with 10 salt rounds and returns a standard JWT token.
   * `POST /api/auth/login`: Checks email existences and validates passwords.
3. **Data Fetching isolation (`GET /api/data`)**:
   * Modify query structures so MongoDB filters all models based on `req.userId` recursively (transitively fetching apartments, tenants, payments, contracts, and utilities matching properties owned by `req.userId`).
4. **Mock Mode Fallback Isolation**:
   * Update the `mockData` object and CRUD methods. When MERN runs in mock mode, simulate JWT verification and filter mock arrays inside `server.js` using `req.userId`.
5. **Safety Write-Validations**:
   * For POST/PUT/DELETE commands, verify that the active `req.userId` owns the target entity before saving database records.

---

### 🖥️ Frontend Architecture & UI Views

#### [NEW] [AuthContext.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/context/AuthContext.jsx)
* Build a React Auth Context to hold login state, user details, and active tokens:
  ```javascript
  export const AuthProvider = ({ children }) => {
      const [user, setUser] = useState(null);
      const [token, setToken] = useState(localStorage.getItem('token'));
      ...
  }
  ```
* Wire Axios interceptors to auto-attach the Authorization token header globally on request creations.

#### [NEW] [Login.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/pages/Login.jsx) & [Signup.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/pages/Signup.jsx)
* Premium design built with modern CSS (glassmorphism details, smooth form transitions, soft HSL color inputs, and error handlers).

#### [NEW] [ProtectedRoute.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/components/ProtectedRoute.jsx)
* Protect app pages. Redirects visitors to `/login` if unauthenticated.

#### [MODIFY] [App.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/App.jsx)
* Integrate `AuthProvider`.
* Render `/login` and `/signup` routes.
* Wrap all main application routes inside `<ProtectedRoute>`.

#### [MODIFY] [Sidebar.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/components/Sidebar.jsx) & [Header.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/components/Header.jsx)
* Display active user profile, and add a sleek **Logout** button.

---

## Verification Plan

### Automated Tests
1. **Unit & Integration Tests**:
   * Boot the backend server in dev environment.
   * Send REST requests via standard requests (curl or client queries) to test:
     * Authentication routes (`/api/auth/signup`, `/api/auth/login`) with both valid and invalid email/password shapes.
     * Route protection blockages on endpoints like `/api/data` without tokens.
     * Transitive filtering verification (create User A and User B, assign properties, assert that GET `/api/data` returns mutually isolated records).
2. **Mock Mode Verification**:
   * Disable MongoDB and confirm local `mock_db.json` data queries remain strictly isolated by user ID.

### Manual Verification
1. **Interactive Review**:
   * Register User A ("Manager A") and add "Sunset Boulevard Towers".
   * Register User B ("Manager B") and add "Royal Plaza".
   * Log in as Manager A: Verify that "Royal Plaza" is completely invisible in dashboard, property inventories, utilities trackers, and contract pages.
   * Log out and log back in as Manager B: Verify that only "Royal Plaza" is displayed.
   * Verify print receipts generated for respective managers reflect correct currency selections.
