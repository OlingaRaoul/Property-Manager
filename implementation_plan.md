# Implementation Plan — Simultaneous Rent and Deposit Saving in Payment Modal

This plan describes how we will update the payment register/edit modal in `Payments.jsx` to allow saving both Rent and Security Deposit payments simultaneously. This prevents one payment type from being discarded when the other is updated during editing, and enables the combined "Rent & Deposit" state to persist correctly.

---

## Proposed Changes

### 🖥️ Frontend Views & Interactions

#### [MODIFY] [Payments.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/pages/Payments.jsx)

1. **Update `handleTenantChange`**:
   * Reset `depositAmountMonths` to `0` when changing the selected tenant to prevent carrying over selections.

2. **Refactor `handleSave` to Save Both Modes Simultanouesly**:
   * Change validation logic to ensure that at least one of `selectedMonths.length > 0` OR `depositAmountMonths > 0` is true, rather than restricting checks to the currently active tab mode.
   * Preserve metadata from the original group when editing:
     * `status`: `editGroup?.status || 'Approved'`
     * `proofFile`: `editGroup?.proofFile`
     * `proofFileType`: `editGroup?.proofFileType`
   * Populate `newPayments` with:
     * A deposit payment record if `depositAmountMonths > 0`.
     * Rent payment records (one per month) if `selectedMonths.length > 0`.
   * Post all generated payments to the backend.

3. **Update Modal Footer Save Button**:
   * Update the disabled check to enable the "Register/Save" button as long as at least one payment (rent month or deposit month) is selected, regardless of which tab is currently active:
     ```javascript
     disabled={saving || (selectedMonths.length === 0 && depositAmountMonths === 0)}
     ```

---

## Verification Plan

### Automated Tests
* Run `npm run build` in the `frontend/` directory to verify that the build compiles cleanly without syntax or compilation errors.

### Manual Verification
1. Open the application locally in the browser.
2. Select a tenant, configure both a Rent payment (select a month) and a Security Deposit payment (select 1 month).
3. Save the payment. Verify that it appears in the ledger history with the badge type **Rent & Deposit**.
4. Edit the saved group: change the Rent month or the Deposit months, save again, and verify that the other category is not deleted and both continue to display as **Rent & Deposit**.
