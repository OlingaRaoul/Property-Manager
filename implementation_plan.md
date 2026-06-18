# Implementation Plan — Unified Register & Edit Payment Interface

This plan details the design to merge the edit payment panel into the existing register payment modal. This will ensure they share the exact same UI layout, month grids, info strips, and state validation logic.

---

## Proposed Changes

### 🖥️ Frontend Views & Interactions

#### [MODIFY] [Payments.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/pages/Payments.jsx)

1. **Unify Modal States**:
   * Reuse the existing `showModal` hooks and layout for both creating and editing payments.
   * If `editGroup` is active, the modal operates in **Edit Mode**:
     * Title changes to `"Edit Payment"`.
     * The tenant selector dropdown is disabled (`disabled={true}`).
     * The month selection grid, date selector, notes, and total price breakdown behave identically.
2. **Exclude Current Group Months from Already-Paid Check**:
   * Update the `paidMonths` memo so that when `editGroup` is active, the months currently paid by the group are *not* marked as disabled ("already paid") in the grid, allowing the manager to toggle them.
3. **Refactor Action Handlers**:
   * **`openEditGroup`**: Sets the pre-filled states for `tenantId`, `selectedMonths` (populated with `editGroup.monthList`), `payDate`, and `note`. Sets `editGroup` to true.
   * **`closeModal`**: Safely clears all form and edit states.
   * **`handleSave`**:
     * If `editGroup` is active:
       * Delete all old payments associated with the group.
       * Subtract the deleted payments' values from the current local states.
     * Proceed with the standard split-payment logging logic (splitting deposit and rent, updating database collections, and applying React context updates).
4. **Remove Unused Elements**:
   * Delete the duplicate `Edit Payment Group` modal JSX and redundant edit-only state variables (`editAmount`, `editDate`, etc.).
