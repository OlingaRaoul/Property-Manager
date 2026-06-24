# Walkthrough — Analytics Dashboard Reports & Landlord/Tenant Signature Integration

We have successfully implemented advanced analytical dashboard reports and integrated matching landlord and tenant signature placeholders across all financial statements and receipts:

1. **Property Performance & Yield Report**: Expected vs. actual collections and occupancy rates per property with custom dynamic visual progress bars.
2. **Tenant Payment Performance & Risk Index**: Tracks payment speed (on-time rate, average days late) and assigns risk levels (High, Medium, Low) to active tenants.
3. **Future Cash Flow Forecasting**: Renders a 6-month visual line chart transitioning from actual cash inflow (past 3 months) to projected revenue (next 3 months) adjusted by historical collection efficiency.
4. **Recent Transactions Table Upgrades**:
   - **Positioning**: Moved the Recent Transactions table up to the top of the dashboard, directly below the stats cards grid and before the Financial Analytics Report.
   - **Grouping**: Grouped transactions by `tenantId` and `date` to mirror the ledger history table, collapsing multiple split payments (like Rent + Deposit) made at the same time into a single clean line item.
   - **Type Details**: Added a new **Type** column displaying descriptive labels ('Rent', 'Deposit', or 'Rent & Deposit') with matching theme-tailored colors.
   - **Month Formatting**: Replaced raw ISO dates/months (e.g. `2026-06`) with beautiful formatted month names (e.g. `Jun 2026`) matching the system translation settings, wrapped in status-pill classes.
   - **Pagination**: Implemented page-by-page rendering (5 records per page) with Previous and Next action buttons.
   - **Bottom Spacing**: Introduced a spacer at the bottom of the dashboard page container, offering a comfortable visual breathing space.
5. **Property PDF Report Generation Tool Bar**:
   - **Position**: Placed at the very top of the dashboard page, immediately under the header and above the stats grid.
   - **Controls**: Includes a **Print PDF Report for** property selector dropdown, **From** & **To** custom date pickers (allowing users to choose the print period independently of the main dashboard date range), and a **Print PDF Report** action button.
   - **PDF Generation & Styling**: Generates a high-fidelity print document incorporating the selected property's collected rent list, rent totals, deposit totals, and grand totals for the custom selected period range. It utilizes a highly optimized A4 print layout with tight margins (`@page`), condensed table cell paddings (`6px 8px`), and compact font sizes (`11px` body font, `10px` table entries) for maximum content density and readability. Opens the native print dialog automatically to save as a PDF.
6. **Tenant History Modal Ledger Upgrades**:
   - **Print Financial Report**: Added a **Print Financial Report** button at the top header of the modal. Clicking this compiles a structured Tenant Ledger Statement PDF, highlighting their total paid rent and security deposits held in A4 format.
   - **Action Buttons**: Embedded identical payment history action buttons into the modal's ledger table:
     - **Print Receipt**: Opens an overlay preview modal displaying the receipt details (including tenant, property/unit info, security deposit metrics, landlord signature block, and line items) matching the property ledger page. Clicking the print icon inside this preview launches a dedicated, properly-sized popup window (`window.open()`) to trigger the browser print dialog for the premium A5 receipt.
     - **Edit**: Closes the modal and redirects the user to the `/payments` route. The Payments page reads this state on mount to auto-trigger the corresponding group edit dialog.
     - **Delete**: Prompts for confirmation, sends API deletion requests, and updates the local state in real-time.
7. **✍️ Landlord & Tenant Signatures**:
   - **Receipt Print Templates**: Unified the signature and verification layout inside `printReceipt` (`Payments.jsx` and `App.jsx`). Shows the Landlord Signature placeholder on the left, "Payment Confirmed" verification in the center, and a Tenant Signature line on the right.
   - **Receipt Screen Previews**: Styled the screen modal preview footer (`Payments.jsx` and `App.jsx`) to feature the Landlord Signature, status badge, and Tenant Signature placeholder side-by-side.
   - **Tenant Ledger PDF Statement**: Added matching side-by-side signature placeholders above the page footer inside `handlePrintTenantPDF` (`App.jsx`).
   - **Property Financial Report PDF**: Embedded the Landlord Signature placeholder/image above the page footer inside `handlePrintPDF` (`Dashboard.jsx`) (omitting the Tenant Signature placeholder as the report covers multiple tenancies).

---

## What Was Added & Changed

### 📊 Advanced Calculations and Metrics
* **File Modified**: [Dashboard.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/pages/Dashboard.jsx)
  * **isTenantActiveInMonth**: Smart helper that checks if a tenant was active in a given month. It prioritizes lease contract coverage dates (`state.contracts`) and falls back to their first payment month up to the current month if no contract exists.
  * **checkIsPaymentOnTime**: Calculates whether a rent payment was completed on or before its dynamic monthly due date (`dueDateDay`), adjusting automatically for the number of days in that month (e.g. leap years, shorter months).
  * **calculateDaysLate**: Computes the exact number of days a payment was overdue relative to its calculated monthly due date.
  * **Property Yield**: Computes occupancy rates ($\frac{\text{Occupied Units}}{\text{Total Units}} \times 100$) and sums the rent amount expected from active tenants for each month in the selected range, comparing it directly to actual rent payments made.
  * **Tenant Risk Tiers**:
    - **High Risk**: Active tenant with unpaid rent balance exceeding $\ge 2$ months.
    - **Medium Risk**: Active tenant overdue by $1$ month, currently using their deposit, or having a historical on-time payment rate $< 50\%$.
    - **Low Risk**: Standard active tenant with no overdue balance and reliable payment history.
  * **Historical Collection Rate**: Analyzes the last 6 completed months of rent expected vs. actual collections across the entire portfolio (capping the rate between 50% and 100% for safety) to discount future projections.
  * **Future Cash Flow Forecast**: Renders a timeline combining 3 months of actual collections with 3 months of projected income based on active contracts and adjusted by the portfolio's collection rate.

### 🖥️ User Interface Layout & Styling
* **File Modified**: [Dashboard.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/pages/Dashboard.jsx)
  * **Property Performance & Yield List**: Adds a dedicated panel showing occupancy badges, total expected vs. actual numbers, and custom horizontal comparison fill bars. The bars change color dynamically (Green for $\ge 90\%$, Yellow/Orange for $\ge 70\%$, and Red for $< 70\%$).
  * **Tenant Risk & Reliability Index List**: Renders active tenants sorted by risk tier (High risk first). Shows their property, unit number, on-time payment rate, average days late, and a colored status badge. Tenant names link directly to their payment history modal.
  * **Future Cash Flow Forecasting Chart**: Integrates the custom `ForecastChart` component to display past actual revenue and future projected cash inflows. It includes dotted lines and hover tooltip indicators.
  * **Recent Transactions List & Controls**: Recoded the payments list to combine individual records matching the same tenant and date. Renders pagination buttons for navigating through the ledger entries. Formats the month cell via the `formatMonth` helper.
  * **PDF Report Tool Bar**: Renders a dropdown property picker and primary action print button next to each other at the top. On click, it runs a pop-up print script that outputs the formatted financial ledger sheet.

---

## Verification Results

### 1. Compilation Verification
* Tested with `npm run build` in the `frontend/` directory. The build completed with **zero compilation warnings or errors** and generated minified bundles cleanly.

### 2. Manual Verification Options
* Property metrics and expected vs. actual yields recalculate instantly when selecting different date ranges (e.g. Last 30 Days, YTD).
* Tenant Risk correctly identifies tenants using deposit as Medium Risk, and lists High Risk tenants if they exceed 2 months overdue.
* Recent transaction pagination correctly renders and navigates ledger pages.
* The Print PDF button opens a beautifully styled printable document showing exact payments collected, rent totals, and deposit totals for the selected property and period.
* Open a tenant ledger statement or print receipt to verify that both Landlord and Tenant Signature placeholders align neatly side-by-side at the bottom of the printed reports/receipts. General property financial reports will only display the Landlord Signature.
