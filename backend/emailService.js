const { Resend } = require('resend');
const { generateRentReceiptPdf, generateUtilityBillPdf } = require('./pdfGenerator');

// Initialize Resend with API key from environment
const getResendClient = () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;
    return new Resend(apiKey);
};

// Default senders
const PRIMARY_FROM = process.env.RESEND_FROM_EMAIL || 'Property Manager <receipts@app.pmanager.net>';
const FALLBACK_FROM = process.env.RESEND_FALLBACK_FROM || 'Property Manager <onboarding@resend.dev>';

/**
 * Send an email with attachments and automatic fallback if custom domain is pending verification
 */
async function sendEmail({ to, subject, html, text, attachments = [], replyTo }) {
    const resend = getResendClient();
    if (!resend) {
        throw new Error('Resend API key is not configured. Please set RESEND_API_KEY.');
    }

    const payload = {
        from: PRIMARY_FROM,
        to: Array.isArray(to) ? to : [to],
        reply_to: replyTo,
        subject,
        html,
        text,
        attachments: attachments || []
    };

    // Try primary sender first
    try {
        const result = await resend.emails.send(payload);

        if (result.error) {
            // Check if domain is unverified
            if (result.error.message && result.error.message.includes('not verified')) {
                console.warn(`[Resend] Primary domain not verified yet (${PRIMARY_FROM}). Retrying with fallback (${FALLBACK_FROM})...`);
                const fallbackPayload = {
                    ...payload,
                    from: FALLBACK_FROM
                };
                const fallbackResult = await resend.emails.send(fallbackPayload);

                if (fallbackResult.error) {
                    throw new Error(fallbackResult.error.message || 'Failed to send via fallback email');
                }
                return {
                    success: true,
                    id: fallbackResult.data?.id,
                    sender: FALLBACK_FROM,
                    note: 'Delivered via Resend dev fallback. Please complete verification of app.pmanager.net in Resend dashboard.'
                };
            }
            throw new Error(result.error.message || 'Resend delivery failed');
        }

        return {
            success: true,
            id: result.data?.id,
            sender: PRIMARY_FROM
        };
    } catch (err) {
        // If the error explicitly mentions domain not verified, try fallback
        if (err.message && err.message.includes('not verified')) {
            console.warn(`[Resend] Retrying with fallback sender ${FALLBACK_FROM}...`);
            const fallbackPayload = {
                ...payload,
                from: FALLBACK_FROM
            };
            const fallbackResult = await resend.emails.send(fallbackPayload);
            if (fallbackResult.error) {
                throw new Error(fallbackResult.error.message);
            }
            return {
                success: true,
                id: fallbackResult.data?.id,
                sender: FALLBACK_FROM,
                note: 'Delivered via Resend dev fallback. Please complete verification of app.pmanager.net in Resend dashboard.'
            };
        }
        throw err;
    }
}

/**
 * Generate formal email copy for a Rent Receipt (high inbox deliverability)
 */
function buildFormalRentReceiptEmail(data) {
    const tenantName = data.tenantName || 'Valued Resident';
    const propertyName = data.propertyName || 'Property Management';
    const unitNumber = data.unitNumber || '—';
    const receiptNo = data.receiptNo || 'RCP-CONFIRM';
    const date = data.date || new Date().toISOString().split('T')[0];
    const currency = data.currency || 'EUR';
    const totalAmount = Number(data.totalAmount || 0).toLocaleString();

    const itemsSummary = (data.items && data.items.length > 0)
        ? data.items.map(it => `${it.description || 'Rent'} (${it.period || '—'}): <strong>${Number(it.amount || 0).toLocaleString()} ${currency}</strong>`).join('<br/>')
        : `Payment: <strong>${totalAmount} ${currency}</strong>`;

    const textItemsSummary = (data.items && data.items.length > 0)
        ? data.items.map(it => `• ${it.description || 'Rent'} (${it.period || '—'}): ${Number(it.amount || 0).toLocaleString()} ${currency}`).join('\n')
        : `• Payment: ${totalAmount} ${currency}`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>Payment Receipt - ${receiptNo}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #1e40af; font-size: 20px;">${propertyName}</h2>
            <div style="font-size: 13px; color: #64748b; font-weight: 500;">Official Payment Confirmation</div>
        </div>

        <p>Dear ${tenantName},</p>

        <p>Thank you for your payment. We have successfully received and processed your payment for <strong>${propertyName}</strong>, Unit <strong>${unitNumber}</strong>.</p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                    <td style="padding: 6px 0; color: #64748b; width: 42%;">Receipt Number:</td>
                    <td style="padding: 6px 0; font-weight: bold; font-family: monospace; color: #0f172a;">${receiptNo}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #64748b;">Payment Date:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${date}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Payment Breakdown:</td>
                    <td style="padding: 6px 0; color: #0f172a;">${itemsSummary}</td>
                </tr>
                <tr style="border-top: 1px solid #e2e8f0;">
                    <td style="padding: 10px 0 6px 0; font-weight: bold; color: #0f172a;">Total Paid:</td>
                    <td style="padding: 10px 0 6px 0; font-weight: 800; font-size: 16px; color: #16a34a;">${totalAmount} ${currency}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #64748b;">Status:</td>
                    <td style="padding: 6px 0; font-weight: bold; color: #16a34a;">✓ PAID & CONFIRMED</td>
                </tr>
            </table>
        </div>

        <p>Your official payment receipt has been generated and is attached to this email as a PDF (<strong>Receipt_${receiptNo}.pdf</strong>) for your records.</p>

        ${data.note ? `<p style="font-size: 13px; color: #475569; background: #fffbeb; border-left: 3px solid #f59e0b; padding: 8px 12px; border-radius: 4px;"><strong>Note:</strong> ${data.note}</p>` : ''}

        <p>Please retain the attached PDF receipt for your records. If you have any questions or discrepancies, please contact the management office.</p>

        <p style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 13px; color: #64748b;">
            Sincerely,<br/>
            <strong>Property Management Office</strong><br/>
            ${propertyName}<br/>
            ${data.propertyAddress ? `<span style="font-size: 12px; color: #94a3b8;">${data.propertyAddress}</span><br/>` : ''}
            <span style="font-size: 11px; color: #94a3b8;">Property Manager Pro • www.pmanager.net</span>
        </p>
    </body>
    </html>
    `;

    const text = `
Dear ${tenantName},

Thank you for your payment. We have successfully received and processed your payment for ${propertyName}, Unit ${unitNumber}.

PAYMENT DETAILS:
------------------------------------------
Receipt Number: ${receiptNo}
Payment Date: ${date}
${textItemsSummary}
Total Paid: ${totalAmount} ${currency}
Status: PAID & CONFIRMED
------------------------------------------

Your official receipt (Receipt_${receiptNo}.pdf) is attached to this email as a PDF.

${data.note ? `Note: ${data.note}\n` : ''}
Please keep the attached document for your records. If you have any questions, please contact the management office.

Sincerely,
Property Management Office
${propertyName}
${data.propertyAddress || ''}
    `.trim();

    return { html, text };
}

/**
 * Generate formal email copy for a Utility Bill
 */
function buildFormalUtilityBillEmail(data) {
    const tenantName = data.tenantName || 'Valued Resident';
    const propertyName = data.propertyName || 'Property Management';
    const unitNumber = data.unitNumber || '—';
    const type = data.type || 'Utility';
    const month = data.month || 'Current Period';
    const currency = data.currency || 'EUR';
    const amount = Number(data.amount || 0).toLocaleString();
    const isPaid = data.status === 'Paid';
    const statusText = isPaid ? 'PAID IN FULL' : 'PAYMENT DUE';

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>${type} Statement - ${month}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #0f172a; font-size: 20px;">${propertyName}</h2>
            <div style="font-size: 13px; color: #64748b; font-weight: 500;">${type} Statement & Bill Notice</div>
        </div>

        <p>Dear ${tenantName},</p>

        <p>Please find below your utility billing summary for <strong>${propertyName}</strong>, Unit <strong>${unitNumber}</strong> for the billing period of <strong>${month}</strong>.</p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                    <td style="padding: 6px 0; color: #64748b; width: 45%;">Utility Type:</td>
                    <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${type}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #64748b;">Billing Period:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${month}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #64748b;">Units Consumed:</td>
                    <td style="padding: 6px 0; font-weight: bold; color: #2563eb;">${data.unitsConsumed ?? '—'} units</td>
                </tr>
                ${data.ratePerUnit ? `
                <tr>
                    <td style="padding: 6px 0; color: #64748b;">Rate per Unit:</td>
                    <td style="padding: 6px 0; color: #0f172a;">${data.ratePerUnit} ${currency}</td>
                </tr>
                ` : ''}
                <tr style="border-top: 1px solid #e2e8f0;">
                    <td style="padding: 10px 0 6px 0; font-weight: bold; color: #0f172a;">Total Amount Due:</td>
                    <td style="padding: 10px 0 6px 0; font-weight: 800; font-size: 16px; color: ${isPaid ? '#16a34a' : '#b91c1c'};">${amount} ${currency}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #64748b;">Payment Status:</td>
                    <td style="padding: 6px 0; font-weight: bold; color: ${isPaid ? '#16a34a' : '#b91c1c'};">
                        ${isPaid ? '✓ PAID IN FULL' : '⚠️ PAYMENT DUE'}
                    </td>
                </tr>
            </table>
        </div>

        <p>A detailed statement with meter readings is attached as a PDF (<strong>Utility_Statement_${type}_${unitNumber}.pdf</strong>) for your reference.</p>

        ${data.note ? `<p style="font-size: 13px; color: #475569; background: #fffbeb; border-left: 3px solid #f59e0b; padding: 8px 12px; border-radius: 4px;"><strong>Note:</strong> ${data.note}</p>` : ''}

        <p>If you have already settled this bill, thank you and please disregard the payment notice. For any questions regarding your meter readings, please contact the office.</p>

        <p style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 13px; color: #64748b;">
            Sincerely,<br/>
            <strong>Property Management Office</strong><br/>
            ${propertyName}<br/>
            <span style="font-size: 11px; color: #94a3b8;">Property Manager Pro • www.pmanager.net</span>
        </p>
    </body>
    </html>
    `;

    const text = `
Dear ${tenantName},

Please find below your ${type} statement for ${propertyName}, Unit ${unitNumber} for ${month}.

STATEMENT SUMMARY:
------------------------------------------
Utility: ${type}
Period: ${month}
Consumption: ${data.unitsConsumed ?? '—'} units
${data.ratePerUnit ? `Rate: ${data.ratePerUnit} ${currency}\n` : ''}Total Amount: ${amount} ${currency}
Status: ${statusText}
------------------------------------------

A detailed PDF statement is attached to this email.

${data.note ? `Note: ${data.note}\n` : ''}
Sincerely,
Property Management Office
${propertyName}
    `.trim();

    return { html, text };
}

/**
 * Send rent receipt email with attached PDF
 */
async function sendRentReceiptWithPdf({ to, receiptData, subject, replyTo }) {
    // 1. Generate PDF buffer
    const pdfBuffer = await generateRentReceiptPdf(receiptData);
    const receiptNo = receiptData.receiptNo || `RCP-${Date.now()}`;
    const filename = `Receipt_${receiptNo}.pdf`;

    // 2. Generate formal email text & HTML
    const { html, text } = buildFormalRentReceiptEmail(receiptData);
    const emailSubject = subject || `Official Rent Receipt: ${receiptNo} — Unit ${receiptData.unitNumber || '—'} (${receiptData.propertyName || 'Property Manager'})`;

    // 3. Send via Resend with attachment
    return await sendEmail({
        to,
        subject: emailSubject,
        html,
        text,
        replyTo,
        attachments: [
            {
                filename,
                content: pdfBuffer
            }
        ]
    });
}

/**
 * Send utility bill email with attached PDF
 */
async function sendUtilityBillWithPdf({ to, utilityData, subject, replyTo }) {
    // 1. Generate PDF buffer
    const pdfBuffer = await generateUtilityBillPdf(utilityData);
    const filename = `Utility_Statement_${utilityData.type || 'Bill'}_${utilityData.unitNumber || 'Unit'}.pdf`;

    // 2. Generate formal email text & HTML
    const { html, text } = buildFormalUtilityBillEmail(utilityData);
    const emailSubject = subject || `Utility Statement: ${utilityData.type || 'Utility'} — Unit ${utilityData.unitNumber || '—'} (${utilityData.month || ''})`;

    // 3. Send via Resend with attachment
    return await sendEmail({
        to,
        subject: emailSubject,
        html,
        text,
        replyTo,
        attachments: [
            {
                filename,
                content: pdfBuffer
            }
        ]
    });
}

module.exports = {
    sendEmail,
    sendRentReceiptWithPdf,
    sendUtilityBillWithPdf,
    generateRentReceiptPdf,
    generateUtilityBillPdf,
    buildFormalRentReceiptEmail,
    buildFormalUtilityBillEmail,
    PRIMARY_FROM,
    FALLBACK_FROM
};
