# Walkthrough — Resolving Token Race Condition on Page Refresh

We have identified and resolved the issue where data disappeared when the user refreshed the browser.

---

## 1. Root Cause Analysis

* **Race Condition on Initial Load**:
  * On page refresh, React state initializes.
  * In the original setup, `AuthProvider` initialized the token from `localStorage` into state immediately, but only set the `axios.defaults.headers.common['Authorization']` global header inside a `useEffect` block, which runs **after** the initial render (mount) is completed.
  * Concurrently, `StateProvider` observed that the `token` state was present (via the `useState` initializer value) and immediately fired the `fetchInitialData()` callback to load the MERN backend data.
  * Because `StateProvider`'s fetch was initiated during mount *before* the `AuthProvider`'s `useEffect` had run, the request to `/api/data` was sent without the `Authorization` header.
  * The backend responded with `401 Unauthorized` (unauthenticated request).
  * The Axios interceptor caught the 401 error, assumed the session had expired, cleared `localStorage`, and triggered a redirect/logout, causing all data to disappear.

---

## 2. Changes Made

### 🖥️ Frontend Context Updates
* **File modified**: [AuthContext.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/context/AuthContext.jsx)
  * Synchronously read `user` and `token` from `localStorage` inside the `useState` functional initializers.
  * Set `axios.defaults.headers.common['Authorization']` immediately when initializing the `token` state. This guarantees that the default authorization header is active *before* any child components render or make requests, preventing the race condition.
  * Removed the initial mount `useEffect` that was setting the headers asynchronously.
* **File modified**: [StateContext.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/context/StateContext.jsx)
  * Updated the `fetchInitialData` request to pass the Authorization header explicitly:
    ```javascript
    const { data } = await axios.get(`${API_URL}/data`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    ```
    This adds double-layered safety ensuring that initial data fetches are never sent without authorization credentials.

---

## 3. Verification & Testing

### Frontend Compilation
* Checked the production build compile:
  ```bash
  npm run build
  ✓ built in 368ms
  ```
