# Implementation Plan — Landlord Signature Setup & Receipt Integration

This plan details the UI additions, state handling, database operations, and print rendering logic to allow property managers to configure their signature in settings and have it automatically embedded at the bottom of generated rent receipts/invoices.

---

## Proposed Changes

### ⚙️ Settings View

#### [MODIFY] [Settings.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/pages/Settings.jsx)
We will add a new **Signature Configuration** card under the settings grid. This card will have three states:
1. **Preview State**: Shows the currently saved signature image, and provides options to:
   * **Draw Signature** (switches to Canvas editor).
   * **Upload Picture** (switches to File uploader).
   * **Delete Signature** (removes from settings).
2. **Drawing Canvas State**:
   * Renders a responsive HTML5 `<canvas>` element (e.g., 400x150 px).
   * Supports mouse and touch interactions (fully mobile compatible via `onTouchStart`, `onTouchMove`, and `onTouchEnd`).
   * Uses `touch-action: none` to prevent page scrolling while drawing.
   * Controls: **Clear** (wipes canvas), **Save** (converts to base64 and posts to API), and **Cancel**.
3. **Upload File State**:
   * Styled drop area or standard file input accepting `image/*`.
   * Automatically converts the image to base64 using a `FileReader`.
   * Controls: **Save** and **Cancel**.

All save actions will POST to `/api/settings` with `{ key: "signature", value: base64Data }` and update the global app state context.

---

### 📄 Payments & Receipt View

#### [MODIFY] [Payments.jsx](file:///Users/olingajoseph/Documents/My%20projects/Property_manager/frontend/src/pages/Payments.jsx)
We will remove the `"Computer-generated receipt — no signature required."` text entirely and replace it with a Landlord Signature block:

1. **Receipt Print Popup (`printReceipt` function)**:
   * Replace the footer HTML block.
   * If a signature is saved, render the base64 image:
     ```html
     <div class="signature-container" style="text-align: left;">
       <img src="${signature}" style="max-height: 40px; max-width: 150px; display: block; margin-bottom: 2px;" alt="Landlord Signature" />
       <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px solid #E6EFF5; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Landlord Signature</div>
     </div>
     ```
   * If no signature is configured yet, render a signature line placeholder:
     ```html
     <div class="signature-container" style="text-align: left; padding-top: 20px;">
       <div style="font-size: 8px; color: #718EBF; text-transform: uppercase; border-top: 1px dashed #B1B1B1; display: inline-block; width: 120px; padding-top: 2px; font-weight: bold;">Landlord Signature</div>
     </div>
     ```
2. **Receipt Preview Modal**:
   * Implement the identical dynamic layout in the preview modal JSX at line 718.

---

## Verification Plan

### Manual Verification
1. **Signature Drawing**:
   * Go to **Settings** page. Click **Draw Signature**.
   * Draw a signature and click **Save**. Confirm the preview updates.
   * Refresh the page to verify it loads correctly from the database.
2. **Signature Image Upload**:
   * Click **Upload Picture** on settings page.
   * Choose any PNG/JPG image containing a signature.
   * Click **Save** and verify the preview displays the uploaded image.
3. **Receipt Preview and Printing**:
   * Open a payment receipt preview. Verify the landlord signature block renders at the bottom.
   * Print the receipt and verify the print layout looks pristine.
4. **No Signature Fallback**:
   * Delete the signature in settings. Verify the receipt renders a signature line placeholder without the old "computer-generated" text.
