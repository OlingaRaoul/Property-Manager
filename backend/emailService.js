const { Resend } = require('resend');

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
 * Send an email with automatic fallback if custom domain is pending verification
 */
async function sendEmail({ to, subject, html, replyTo, text }) {
    const resend = getResendClient();
    if (!resend) {
        throw new Error('Resend API key is not configured. Please set RESEND_API_KEY.');
    }

    // Try primary sender first
    try {
        const result = await resend.emails.send({
            from: PRIMARY_FROM,
            to: Array.isArray(to) ? to : [to],
            reply_to: replyTo,
            subject,
            html,
            text
        });

        if (result.error) {
            // Check if domain is unverified
            if (result.error.message && result.error.message.includes('not verified')) {
                console.warn(`[Resend] Primary domain not verified yet (${PRIMARY_FROM}). Retrying with fallback (${FALLBACK_FROM})...`);
                const fallbackResult = await resend.emails.send({
                    from: FALLBACK_FROM,
                    to: Array.isArray(to) ? to : [to],
                    reply_to: replyTo,
                    subject,
                    html,
                    text
                });

                if (fallbackResult.error) {
                    throw new Error(fallbackResult.error.message || 'Failed to send via fallback email');
                }
                return {
                    success: true,
                    id: fallbackResult.data?.id,
                    sender: FALLBACK_FROM,
                    note: 'Delivered via Resend dev fallback. Please verify pmanager.net in Resend dashboard to send from receipts@pmanager.net.'
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
            const fallbackResult = await resend.emails.send({
                from: FALLBACK_FROM,
                to: Array.isArray(to) ? to : [to],
                reply_to: replyTo,
                subject,
                html,
                text
            });
            if (fallbackResult.error) {
                throw new Error(fallbackResult.error.message);
            }
            return {
                success: true,
                id: fallbackResult.data?.id,
                sender: FALLBACK_FROM,
                note: 'Delivered via Resend dev fallback. Please verify pmanager.net in Resend dashboard to send from receipts@pmanager.net.'
            };
        }
        throw err;
    }
}

/**
 * Generate HTML template for a Rent Receipt
 */
function buildRentReceiptHtml({
    receiptNo,
    date,
    tenantName,
    tenantPhone,
    tenantEmail,
    propertyName,
    propertyAddress,
    unitNumber,
    unitType,
    items = [],
    totalAmount,
    currency = 'EUR',
    note,
    signatureUrl,
    depositInfo
}) {
    const formattedTotal = Number(totalAmount || 0).toLocaleString();
    
    const rowsHtml = items.map(item => `
        <tr style="border-bottom: 1px solid #E6EFF5;">
            <td style="padding: 12px 14px; font-weight: 600; color: #1e293b;">${item.description || 'Monthly Rent'}</td>
            <td style="padding: 12px 14px; color: #64748b;">${item.period || '—'}</td>
            <td style="padding: 12px 14px; text-align: right; font-weight: 700; color: #2563eb;">
                ${Number(item.amount || 0).toLocaleString()} ${currency}
            </td>
        </tr>
    `).join('');

    let depositBlock = '';
    if (depositInfo && (depositInfo.required > 0 || depositInfo.paid > 0)) {
        depositBlock = `
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-top: 18px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 8px;">
                Security Deposit Overview
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                    <td style="color: #64748b; padding-bottom: 4px;">Deposit Progress:</td>
                    <td style="text-align: right; font-weight: 700; color: #1e293b;">${depositInfo.monthsPaid || 0} / ${depositInfo.monthsTotal || 0} months</td>
                </tr>
                <tr>
                    <td style="color: #64748b; padding-bottom: 4px;">Held Deposit:</td>
                    <td style="text-align: right; font-weight: 700; color: #2563eb;">${Number(depositInfo.paid || 0).toLocaleString()} ${currency}</td>
                </tr>
                <tr>
                    <td style="color: #64748b;">Required Total:</td>
                    <td style="text-align: right; font-weight: 700; color: #1e293b;">${Number(depositInfo.required || 0).toLocaleString()} ${currency}</td>
                </tr>
            </table>
        </div>
        `;
    }

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt ${receiptNo}</title>
    </head>
    <body style="margin: 0; padding: 24px 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
            <!-- Header -->
            <tr>
                <td style="background: linear-width; background-color: #1e40af; padding: 28px 32px; color: #ffffff;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td>
                                <span style="display: inline-block; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #bfdbfe; font-weight: 700;">Official Payment Confirmation</span>
                                <h1 style="margin: 4px 0 0 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">RENT RECEIPT</h1>
                            </td>
                            <td style="text-align: right; vertical-align: top;">
                                <div style="font-size: 11px; color: #bfdbfe; text-transform: uppercase; font-weight: 600;">Receipt Number</div>
                                <div style="font-size: 16px; font-weight: 800; color: #ffffff; font-family: monospace;">${receiptNo}</div>
                                <div style="font-size: 12px; color: #93c5fd; margin-top: 3px;">Date: ${date}</div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- Status Banner -->
            <tr>
                <td style="background-color: #ecfdf5; padding: 12px 32px; border-bottom: 1px solid #a7f3d0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="color: #065f46; font-size: 13px; font-weight: 700;">
                                ✓ STATUS: PAYMENT RECEIVED & CONFIRMED
                            </td>
                            <td style="text-align: right; color: #047857; font-size: 13px; font-weight: 800;">
                                ${formattedTotal} ${currency}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- Body Details -->
            <tr>
                <td style="padding: 28px 32px;">
                    <!-- 2-Column Info Grid -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                        <tr>
                            <td width="48%" style="vertical-align: top; background-color: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Received From</div>
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${tenantName || 'Tenant'}</div>
                                ${tenantPhone ? `<div style="font-size: 12px; color: #64748b; margin-top: 4px;">📞 ${tenantPhone}</div>` : ''}
                                ${tenantEmail ? `<div style="font-size: 12px; color: #64748b;">✉️ ${tenantEmail}</div>` : ''}
                            </td>
                            <td width="4%"></td>
                            <td width="48%" style="vertical-align: top; background-color: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Property & Unit</div>
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${propertyName || 'Property'}</div>
                                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Unit: <strong style="color: #2563eb;">${unitNumber || '—'}</strong> ${unitType ? `(${unitType})` : ''}</div>
                                ${propertyAddress ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">📍 ${propertyAddress}</div>` : ''}
                            </td>
                        </tr>
                    </table>

                    <!-- Payment Items Table -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                        <thead>
                            <tr style="background-color: #1e293b; color: #ffffff;">
                                <th style="padding: 10px 14px; text-align: left; border-radius: 8px 0 0 0; font-weight: 700;">Description</th>
                                <th style="padding: 10px 14px; text-align: left; font-weight: 700;">Period</th>
                                <th style="padding: 10px 14px; text-align: right; border-radius: 0 8px 0 0; font-weight: 700;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        <tfoot>
                            <tr style="background-color: #f8fafc;">
                                <td colspan="2" style="padding: 14px; font-weight: 800; font-size: 14px; color: #0f172a;">TOTAL PAID</td>
                                <td style="padding: 14px; text-align: right; font-weight: 900; font-size: 17px; color: #2563eb;">
                                    ${formattedTotal} ${currency}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    ${depositBlock}

                    ${note ? `
                    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 0 8px 8px 0; margin-top: 18px; font-size: 12px; color: #92400e;">
                        <strong>Note:</strong> ${note}
                    </div>
                    ` : ''}

                    <!-- Signature / Sign-off -->
                    <div style="margin-top: 28px; padding-top: 18px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: flex-end;">
                        <div>
                            ${signatureUrl ? `
                                <img src="${signatureUrl}" alt="Landlord Signature" style="max-height: 45px; display: block; margin-bottom: 4px;" />
                            ` : ''}
                            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b;">
                                Landlord / Property Manager
                            </div>
                        </div>
                    </div>
                </td>
            </tr>

            <!-- Footer -->
            <tr>
                <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                    <p style="margin: 0 0 4px 0;">This is an automated payment receipt sent via <strong>Property Manager Pro</strong>.</p>
                    <p style="margin: 0;">For inquiries or questions, please contact your property manager directly.</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}

/**
 * Generate HTML template for a Utility Bill
 */
function buildUtilityBillHtml({
    billId,
    tenantName,
    propertyName,
    propertyAddress,
    unitNumber,
    type = 'Electricity',
    month,
    date,
    lastReading,
    currentReading,
    unitsConsumed,
    ratePerUnit,
    amount,
    currency = 'EUR',
    status = 'Unpaid',
    note
}) {
    const formattedAmount = Number(amount || 0).toLocaleString();
    const isPaid = status === 'Paid';
    const statusBg = isPaid ? '#ecfdf5' : '#fef2f2';
    const statusColor = isPaid ? '#047857' : '#b91c1c';
    const statusBorder = isPaid ? '#a7f3d0' : '#fecaca';

    let typeColor = '#f59e0b';
    let typeEmoji = '⚡';
    if (type === 'Water') {
        typeColor = '#3b82f6';
        typeEmoji = '💧';
    } else if (type === 'Gas') {
        typeColor = '#ef4444';
        typeEmoji = '🔥';
    }

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Utility Bill - ${type} - ${month}</title>
    </head>
    <body style="margin: 0; padding: 24px 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
            <!-- Header -->
            <tr>
                <td style="background-color: #0f172a; padding: 28px 32px; color: #ffffff;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td>
                                <span style="display: inline-block; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700;">Utility Statement</span>
                                <h1 style="margin: 4px 0 0 0; font-size: 22px; font-weight: 800; color: #ffffff;">
                                    ${typeEmoji} ${type.toUpperCase()} BILL
                                </h1>
                            </td>
                            <td style="text-align: right; vertical-align: top;">
                                <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Bill Period</div>
                                <div style="font-size: 15px; font-weight: 800; color: #ffffff;">${month}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Date: ${date}</div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- Status Banner -->
            <tr>
                <td style="background-color: ${statusBg}; padding: 12px 32px; border-bottom: 1px solid ${statusBorder};">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="color: ${statusColor}; font-size: 13px; font-weight: 700;">
                                ${isPaid ? '✓ PAID IN FULL' : '⚠️ PAYMENT DUE'}
                            </td>
                            <td style="text-align: right; color: ${statusColor}; font-size: 14px; font-weight: 900;">
                                ${formattedAmount} ${currency}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- Body Details -->
            <tr>
                <td style="padding: 28px 32px;">
                    <!-- Tenant & Property card -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                        <tr>
                            <td width="48%" style="vertical-align: top; background-color: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Billed To</div>
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${tenantName || 'Tenant'}</div>
                                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Unit: <strong style="color: #2563eb;">${unitNumber || '—'}</strong></div>
                            </td>
                            <td width="4%"></td>
                            <td width="48%" style="vertical-align: top; background-color: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Property Location</div>
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${propertyName || 'Property'}</div>
                                ${propertyAddress ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">📍 ${propertyAddress}</div>` : ''}
                            </td>
                        </tr>
                    </table>

                    <!-- Consumption Grid -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 12px;">
                            Meter Reading & Consumption Breakdown
                        </div>
                        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 8px 0; color: #64748b;">Previous Reading:</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #1e293b;">${lastReading ?? '—'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 8px 0; color: #64748b;">Current Reading:</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #1e293b;">${currentReading ?? '—'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 8px 0; color: #64748b;">Units Consumed:</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 800; color: ${typeColor};">
                                    ${unitsConsumed ?? (Number(currentReading || 0) - Number(lastReading || 0))} units
                                </td>
                            </tr>
                            ${ratePerUnit ? `
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 8px 0; color: #64748b;">Rate per Unit:</td>
                                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #1e293b;">${ratePerUnit} ${currency}</td>
                            </tr>
                            ` : ''}
                            <tr>
                                <td style="padding: 12px 0 0 0; font-weight: 800; font-size: 15px; color: #0f172a;">TOTAL AMOUNT DUE:</td>
                                <td style="padding: 12px 0 0 0; text-align: right; font-weight: 900; font-size: 18px; color: #2563eb;">
                                    ${formattedAmount} ${currency}
                                </td>
                            </tr>
                        </table>
                    </div>

                    ${note ? `
                    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 0 8px 8px 0; margin-top: 14px; font-size: 12px; color: #92400e;">
                        <strong>Note:</strong> ${note}
                    </div>
                    ` : ''}
                </td>
            </tr>

            <!-- Footer -->
            <tr>
                <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                    <p style="margin: 0 0 4px 0;">This is an automated utility statement sent via <strong>Property Manager Pro</strong>.</p>
                    <p style="margin: 0;">Please ensure timely payment according to your lease terms.</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}

module.exports = {
    sendEmail,
    buildRentReceiptHtml,
    buildUtilityBillHtml,
    PRIMARY_FROM,
    FALLBACK_FROM
};
