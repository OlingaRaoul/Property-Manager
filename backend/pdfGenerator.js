const PDFDocument = require('pdfkit');

/**
 * Generate a clean, professional A4 PDF receipt using PDFKit
 * Returns a Promise that resolves with a Buffer
 */
function generateRentReceiptPdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 45,
                info: {
                    Title: `Receipt ${data.receiptNo || ''}`,
                    Author: 'Property Manager Pro',
                    Subject: 'Rent Payment Receipt'
                }
            });

            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', err => reject(err));

            const currency = data.currency || 'EUR';
            const total = Number(data.totalAmount || 0).toLocaleString();

            // ── Colors ──
            const primaryColor = '#1e40af'; // Blue
            const textDark = '#0f172a';
            const textMuted = '#64748b';
            const borderColor = '#e2e8f0';
            const bgLight = '#f8fafc';
            const greenPaid = '#16a34a';

            // ── Top Header Bar ──
            doc.rect(45, 45, 505, 55).fill(primaryColor);

            doc.fillColor('#ffffff')
               .fontSize(10)
               .font('Helvetica-Bold')
               .text('OFFICIAL PAYMENT RECEIPT', 65, 58, { letterSpacing: 1 });

            doc.fontSize(18)
               .font('Helvetica-Bold')
               .text(data.propertyName || 'PROPERTY MANAGER PRO', 65, 73);

            // Receipt number & date on the right
            doc.fontSize(9)
               .font('Helvetica')
               .fillColor('#bfdbfe')
               .text('RECEIPT NO:', 360, 58, { width: 170, align: 'right' });

            doc.fontSize(12)
               .font('Helvetica-Bold')
               .fillColor('#ffffff')
               .text(data.receiptNo || `RCP-${Date.now()}`, 360, 70, { width: 170, align: 'right' });

            doc.fontSize(9)
               .font('Helvetica')
               .fillColor('#93c5fd')
               .text(`Date: ${data.date || new Date().toISOString().split('T')[0]}`, 360, 85, { width: 170, align: 'right' });

            let y = 115;

            // ── Status Banner ──
            doc.rect(45, y, 505, 26).fill('#ecfdf5');
            doc.rect(45, y, 505, 26).stroke('#a7f3d0');

            doc.fillColor(greenPaid)
               .fontSize(10)
               .font('Helvetica-Bold')
               .text('✓ STATUS: PAYMENT RECEIVED & CONFIRMED', 60, y + 8);

            doc.fontSize(11)
               .font('Helvetica-Bold')
               .text(`${total} ${currency}`, 360, y + 7, { width: 175, align: 'right' });

            y += 40;

            // ── Info Cards (Received From & Property Details) ──
            const cardWidth = 245;
            const cardHeight = 85;

            // Tenant Card
            doc.roundedRect(45, y, cardWidth, cardHeight, 6).fill(bgLight);
            doc.roundedRect(45, y, cardWidth, cardHeight, 6).stroke(borderColor);

            doc.fillColor(textMuted)
               .fontSize(8)
               .font('Helvetica-Bold')
               .text('RECEIVED FROM', 57, y + 10, { letterSpacing: 0.5 });

            doc.fillColor(textDark)
               .fontSize(12)
               .font('Helvetica-Bold')
               .text(data.tenantName || 'Tenant', 57, y + 24);

            doc.fontSize(9)
               .font('Helvetica')
               .fillColor(textMuted);

            let tenantSubY = y + 42;
            if (data.tenantPhone) {
                doc.text(`Phone: ${data.tenantPhone}`, 57, tenantSubY);
                tenantSubY += 13;
            }
            if (data.tenantEmail) {
                doc.text(`Email: ${data.tenantEmail}`, 57, tenantSubY);
            }

            // Unit / Property Card
            const card2X = 305;
            doc.roundedRect(card2X, y, cardWidth, cardHeight, 6).fill(bgLight);
            doc.roundedRect(card2X, y, cardWidth, cardHeight, 6).stroke(borderColor);

            doc.fillColor(textMuted)
               .fontSize(8)
               .font('Helvetica-Bold')
               .text('PROPERTY & UNIT', card2X + 12, y + 10, { letterSpacing: 0.5 });

            doc.fillColor(textDark)
               .fontSize(12)
               .font('Helvetica-Bold')
               .text(data.propertyName || 'Property', card2X + 12, y + 24);

            doc.fontSize(9)
               .font('Helvetica')
               .fillColor(primaryColor)
               .text(`Unit: ${data.unitNumber || '—'} ${data.unitType ? `(${data.unitType})` : ''}`, card2X + 12, y + 42);

            if (data.propertyAddress) {
                doc.fillColor(textMuted)
                   .text(data.propertyAddress, card2X + 12, y + 56, { width: cardWidth - 24 });
            }

            y += cardHeight + 25;

            // ── Table Header ──
            doc.rect(45, y, 505, 22).fill('#1e293b');
            doc.fillColor('#ffffff')
               .fontSize(9)
               .font('Helvetica-Bold');

            doc.text('DESCRIPTION', 55, y + 6);
            doc.text('PERIOD', 250, y + 6);
            doc.text('AMOUNT', 420, y + 6, { width: 115, align: 'right' });

            y += 22;

            // ── Table Rows ──
            const items = data.items && data.items.length > 0
                ? data.items
                : [{ description: 'Monthly Rent', period: 'Current Period', amount: data.totalAmount || 0 }];

            items.forEach((item, index) => {
                const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                doc.rect(45, y, 505, 24).fill(rowBg);
                doc.rect(45, y, 505, 24).stroke(borderColor);

                doc.fillColor(textDark)
                   .fontSize(9)
                   .font('Helvetica-Bold')
                   .text(item.description || 'Monthly Rent', 55, y + 7);

                doc.fillColor(textMuted)
                   .font('Helvetica')
                   .text(item.period || '—', 250, y + 7);

                doc.fillColor(primaryColor)
                   .font('Helvetica-Bold')
                   .text(`${Number(item.amount || 0).toLocaleString()} ${currency}`, 420, y + 7, { width: 115, align: 'right' });

                y += 24;
            });

            // ── Total Row ──
            doc.rect(45, y, 505, 28).fill('#f1f5f9');
            doc.rect(45, y, 505, 28).stroke('#cbd5e1');

            doc.fillColor(textDark)
               .fontSize(10)
               .font('Helvetica-Bold')
               .text('TOTAL PAID', 55, y + 9);

            doc.fillColor(primaryColor)
               .fontSize(13)
               .font('Helvetica-Bold')
               .text(`${total} ${currency}`, 400, y + 8, { width: 135, align: 'right' });

            y += 40;

            // ── Deposit Info (if any) ──
            if (data.depositInfo && (data.depositInfo.required > 0 || data.depositInfo.paid > 0)) {
                doc.roundedRect(45, y, 505, 55, 6).fill('#f8fafc');
                doc.roundedRect(45, y, 505, 55, 6).stroke(borderColor);

                doc.fillColor(textMuted)
                   .fontSize(8)
                   .font('Helvetica-Bold')
                   .text('SECURITY DEPOSIT OVERVIEW', 57, y + 8, { letterSpacing: 0.5 });

                doc.fontSize(9)
                   .font('Helvetica')
                   .fillColor(textDark);

                const depColWidth = 160;
                doc.text(`Deposit Progress: ${data.depositInfo.monthsPaid || 0} / ${data.depositInfo.monthsTotal || 0} months`, 57, y + 25);
                doc.text(`Held Deposit: ${Number(data.depositInfo.paid || 0).toLocaleString()} ${currency}`, 57 + depColWidth, y + 25);
                doc.text(`Required Total: ${Number(data.depositInfo.required || 0).toLocaleString()} ${currency}`, 57 + depColWidth * 2, y + 25);

                y += 70;
            }

            // ── Note (if any) ──
            if (data.note) {
                doc.roundedRect(45, y, 505, 30, 4).fill('#fffbeb');
                doc.roundedRect(45, y, 505, 30, 4).stroke('#fde68a');

                doc.fillColor('#92400e')
                   .fontSize(8.5)
                   .font('Helvetica')
                   .text(`Note: ${data.note}`, 55, y + 9, { width: 485 });

                y += 45;
            }

            // ── Signature / Sign-off Block ──
            y = Math.max(y + 20, 640);
            doc.moveTo(45, y).lineTo(550, y).dash(3, { space: 3 }).stroke('#cbd5e1');

            y += 15;
            // Left signature: Landlord
            doc.undash();
            doc.moveTo(45, y + 40).lineTo(200, y + 40).stroke('#cbd5e1');
            doc.fontSize(8)
               .fillColor(textMuted)
               .font('Helvetica-Bold')
               .text('AUTHORIZED SIGNATURE / LANDLORD', 45, y + 45);

            // Right signature: Tenant
            doc.moveTo(395, y + 40).lineTo(550, y + 40).stroke('#cbd5e1');
            doc.text('TENANT SIGNATURE', 395, y + 45, { width: 155, align: 'right' });

            // ── Bottom Footer ──
            doc.fontSize(8)
               .fillColor('#94a3b8')
               .font('Helvetica')
               .text('This receipt is an official document generated by Property Manager Pro • www.pmanager.net', 45, 770, { align: 'center', width: 505 });

            doc.end();
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Generate a clean A4 PDF for Utility Bills
 */
function generateUtilityBillPdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 45,
                info: {
                    Title: `Utility Bill - ${data.type || ''}`,
                    Author: 'Property Manager Pro',
                    Subject: 'Utility Statement'
                }
            });

            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', err => reject(err));

            const currency = data.currency || 'EUR';
            const total = Number(data.amount || 0).toLocaleString();
            const isPaid = data.status === 'Paid';

            const primaryColor = '#0f172a';
            const textDark = '#0f172a';
            const textMuted = '#64748b';
            const borderColor = '#e2e8f0';
            const bgLight = '#f8fafc';

            // Top Header Bar
            doc.rect(45, 45, 505, 55).fill(primaryColor);

            doc.fillColor('#ffffff')
               .fontSize(10)
               .font('Helvetica-Bold')
               .text('UTILITY STATEMENT', 65, 58, { letterSpacing: 1 });

            doc.fontSize(18)
               .font('Helvetica-Bold')
               .text(`${(data.type || 'UTILITY').toUpperCase()} STATEMENT`, 65, 73);

            doc.fontSize(9)
               .font('Helvetica')
               .fillColor('#94a3b8')
               .text('PERIOD:', 360, 58, { width: 170, align: 'right' });

            doc.fontSize(12)
               .font('Helvetica-Bold')
               .fillColor('#ffffff')
               .text(data.month || 'Current Month', 360, 70, { width: 170, align: 'right' });

            doc.fontSize(9)
               .font('Helvetica')
               .fillColor('#94a3b8')
               .text(`Date: ${data.date || ''}`, 360, 85, { width: 170, align: 'right' });

            let y = 115;

            // Status Banner
            const statusBg = isPaid ? '#ecfdf5' : '#fef2f2';
            const statusBorder = isPaid ? '#a7f3d0' : '#fecaca';
            const statusColor = isPaid ? '#15803d' : '#b91c1c';

            doc.rect(45, y, 505, 26).fill(statusBg);
            doc.rect(45, y, 505, 26).stroke(statusBorder);

            doc.fillColor(statusColor)
               .fontSize(10)
               .font('Helvetica-Bold')
               .text(isPaid ? '✓ STATUS: PAID IN FULL' : '⚠️ STATUS: PAYMENT DUE', 60, y + 8);

            doc.fontSize(11)
               .font('Helvetica-Bold')
               .text(`${total} ${currency}`, 360, y + 7, { width: 175, align: 'right' });

            y += 40;

            // Info Cards
            const cardWidth = 245;
            const cardHeight = 70;

            // Tenant Card
            doc.roundedRect(45, y, cardWidth, cardHeight, 6).fill(bgLight);
            doc.roundedRect(45, y, cardWidth, cardHeight, 6).stroke(borderColor);

            doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold').text('BILLED TO', 57, y + 10);
            doc.fillColor(textDark).fontSize(12).font('Helvetica-Bold').text(data.tenantName || 'Tenant', 57, y + 24);
            doc.fontSize(9).font('Helvetica').fillColor(textMuted).text(`Unit: ${data.unitNumber || '—'}`, 57, y + 42);

            // Property Card
            const card2X = 305;
            doc.roundedRect(card2X, y, cardWidth, cardHeight, 6).fill(bgLight);
            doc.roundedRect(card2X, y, cardWidth, cardHeight, 6).stroke(borderColor);

            doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold').text('PROPERTY', card2X + 12, y + 10);
            doc.fillColor(textDark).fontSize(12).font('Helvetica-Bold').text(data.propertyName || 'Property', card2X + 12, y + 24);
            if (data.propertyAddress) {
                doc.fontSize(9).font('Helvetica').fillColor(textMuted).text(data.propertyAddress, card2X + 12, y + 42, { width: cardWidth - 24 });
            }

            y += cardHeight + 25;

            // Consumption Card
            doc.roundedRect(45, y, 505, 120, 8).fill(bgLight);
            doc.roundedRect(45, y, 505, 120, 8).stroke(borderColor);

            doc.fillColor(textMuted).fontSize(9).font('Helvetica-Bold').text('METER READING & CONSUMPTION BREAKDOWN', 60, y + 12);

            let rowY = y + 32;
            doc.fontSize(9).font('Helvetica').fillColor(textMuted).text('Previous Reading:', 60, rowY);
            doc.fillColor(textDark).font('Helvetica-Bold').text(String(data.lastReading ?? '—'), 400, rowY, { width: 135, align: 'right' });

            rowY += 18;
            doc.fillColor(textMuted).font('Helvetica').text('Current Reading:', 60, rowY);
            doc.fillColor(textDark).font('Helvetica-Bold').text(String(data.currentReading ?? '—'), 400, rowY, { width: 135, align: 'right' });

            rowY += 18;
            doc.fillColor(textMuted).font('Helvetica').text('Units Consumed:', 60, rowY);
            doc.fillColor('#2563eb').font('Helvetica-Bold').text(`${data.unitsConsumed ?? 0} units`, 400, rowY, { width: 135, align: 'right' });

            if (data.ratePerUnit) {
                rowY += 18;
                doc.fillColor(textMuted).font('Helvetica').text('Rate per Unit:', 60, rowY);
                doc.fillColor(textDark).font('Helvetica-Bold').text(`${data.ratePerUnit} ${currency}`, 400, rowY, { width: 135, align: 'right' });
            }

            y += 135;

            // Total Due Box
            doc.rect(45, y, 505, 30).fill('#1e293b');
            doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text('TOTAL AMOUNT DUE:', 60, y + 10);
            doc.fontSize(14).font('Helvetica-Bold').text(`${total} ${currency}`, 400, y + 8, { width: 135, align: 'right' });

            y += 45;

            if (data.note) {
                doc.roundedRect(45, y, 505, 30, 4).fill('#fffbeb');
                doc.roundedRect(45, y, 505, 30, 4).stroke('#fde68a');
                doc.fillColor('#92400e').fontSize(8.5).font('Helvetica').text(`Note: ${data.note}`, 55, y + 9, { width: 485 });
            }

            // Footer
            doc.fontSize(8)
               .fillColor('#94a3b8')
               .font('Helvetica')
               .text('Property Manager Pro • Automated Utility Statement', 45, 770, { align: 'center', width: 505 });

            doc.end();
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Generate a clean A4 PDF for Statement of Arrears
 */
function generateArrearsStatementPdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 45,
                info: {
                    Title: `Statement of Arrears - ${data.tenantName || ''}`,
                    Author: 'Property Manager Pro',
                    Subject: 'Statement of Arrears & Overdue Rent Notice'
                }
            });

            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', err => reject(err));

            const currency = data.currency || '$';
            const totalOutstanding = Number(data.rentOutstandingAmount || 0).toLocaleString();

            const primaryColor = '#2D60FF'; // Blue matching original
            const textDark = '#1a1a2e';
            const textMuted = '#718EBF';
            const borderColor = '#E6EFF5';
            const bgLight = '#F5F7FA';

            // Top Header: Title on left, Statement Date on right
            doc.fillColor(primaryColor)
               .fontSize(20)
               .font('Helvetica-Bold')
               .text('STATEMENT OF ARREARS', 45, 45);

            doc.fillColor(textMuted)
               .fontSize(9)
               .font('Helvetica-Bold')
               .text('OUTSTANDING RENT & COVERAGE', 45, 68, { letterSpacing: 0.5 });

            doc.fontSize(9)
               .font('Helvetica')
               .fillColor(textMuted)
               .text('Statement Date', 360, 48, { width: 190, align: 'right' });

            doc.fontSize(11)
               .font('Helvetica-Bold')
               .fillColor('#343C6A')
               .text(data.statementDate || new Date().toISOString().split('T')[0], 360, 62, { width: 190, align: 'right' });

            // Blue horizontal divider line
            doc.rect(45, 82, 505, 2).fill(primaryColor);

            let y = 96;

            // Tenant & Property Cards
            const cardWidth = 245;
            const cardHeight = 78;

            // Tenant Card
            doc.roundedRect(45, y, cardWidth, cardHeight, 8).fill(bgLight);
            doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold').text('TENANT DETAILS', 57, y + 10, { letterSpacing: 0.5 });
            doc.fillColor(textDark).fontSize(13).font('Helvetica-Bold').text(data.tenantName || 'Tenant', 57, y + 23);

            let tenantSubY = y + 40;
            doc.fontSize(9).font('Helvetica').fillColor(textMuted);
            if (data.tenantPhone) {
                doc.text(`Phone: ${data.tenantPhone}`, 57, tenantSubY);
                tenantSubY += 13;
            }
            if (data.tenantEmail) {
                doc.text(`Email: ${data.tenantEmail}`, 57, tenantSubY);
            }

            // Unit Card
            const card2X = 305;
            doc.roundedRect(card2X, y, cardWidth, cardHeight, 8).fill(bgLight);
            doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold').text('PROPERTY / UNIT', card2X + 12, y + 10, { letterSpacing: 0.5 });
            doc.fillColor(textDark).fontSize(13).font('Helvetica-Bold').text(data.propertyName || 'Property', card2X + 12, y + 23);
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#2D60FF').text(`Unit: ${data.unitNumber || '—'}`, card2X + 12, y + 40);
            if (data.propertyAddress) {
                doc.fontSize(8.5).font('Helvetica').fillColor(textMuted).text(data.propertyAddress, card2X + 12, y + 54, { width: cardWidth - 24 });
            }

            y += cardHeight + 14;

            // Arrears Overview Card
            doc.roundedRect(45, y, 505, 52, 8).fill('#FFFBEB');
            doc.roundedRect(45, y, 505, 52, 8).stroke('#FEF3C7');

            doc.fillColor('#B45309').fontSize(8.5).font('Helvetica-Bold').text('ARREARS OVERVIEW', 57, y + 8, { letterSpacing: 0.5 });

            doc.fontSize(8).font('Helvetica-Bold').fillColor('#B45309');
            doc.text('MONTHS OVERDUE', 57, y + 23);
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#78350F').text(`${data.overdueMonths || 0} Month${data.overdueMonths !== 1 ? 's' : ''}`, 57, y + 34);

            doc.fontSize(8).font('Helvetica-Bold').fillColor('#B45309').text('LAST PAYMENT DATE', 220, y + 23);
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#343C6A').text(data.lastPaymentDate || '—', 220, y + 34);

            doc.fontSize(8).font('Helvetica-Bold').fillColor('#B45309').text('RENT OUTSTANDING', 380, y + 23, { width: 155, align: 'right' });
            doc.fontSize(13).font('Helvetica-Bold').fillColor('#EF4444').text(`${totalOutstanding} ${currency}`, 380, y + 34, { width: 155, align: 'right' });

            y += 64;

            // Table of Due Periods
            doc.fillColor(textMuted).fontSize(8.5).font('Helvetica-Bold').text('BREAKDOWN OF DUE PERIODS', 45, y, { letterSpacing: 0.5 });
            y += 12;

            doc.rect(45, y, 505, 20).fill('#2D60FF');
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
            doc.text('Due Period', 55, y + 5);
            doc.text('Due Date', 250, y + 5);
            doc.text('Amount', 420, y + 5, { width: 115, align: 'right' });

            y += 20;

            const breakdown = data.breakdown || [];
            breakdown.forEach((row, index) => {
                doc.rect(45, y, 505, 22).fill('#ffffff');
                doc.rect(45, y, 505, 22).stroke('#E6EFF5');

                const periodStr = row.period ? row.period.split(' ')[0] : '—';
                doc.fillColor(textDark).fontSize(9).font('Helvetica').text(periodStr, 55, y + 6);
                doc.fillColor(textDark).text(row.dueDate || '—', 250, y + 6);
                doc.fillColor('#EF4444').font('Helvetica-Bold').text(row.amount || `${Number(data.rentAmount || 0).toLocaleString()} ${currency}`, 420, y + 6, { width: 115, align: 'right' });

                y += 22;
            });

            y += 10;

            // Security Deposit info
            if (data.depositHeldAmount !== undefined || data.depositMonthsPaid) {
                doc.roundedRect(45, y, 505, 42, 8).fill(bgLight);
                doc.roundedRect(45, y, 505, 42, 8).stroke(borderColor);

                doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold').text('SECURITY DEPOSIT STATUS', 57, y + 6, { letterSpacing: 0.5 });
                doc.fillColor(textMuted).fontSize(7.5).font('Helvetica-Bold').text('TOTAL HELD', 57, y + 17);
                doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#343C6A')
                   .text(`${data.depositMonthsPaid || 0} / ${data.depositMonthsRequired || 0} Months`, 57, y + 27);
                doc.fontSize(8).font('Helvetica').fillColor(textMuted)
                   .text(`(${Number(data.depositHeldAmount || 0).toLocaleString()} ${currency})`, 130, y + 28);

                y += 52;
            }

            // Signatures block
            y = Math.max(y + 20, 650);
            if (data.signatureUrl) {
                // Draw line and label for owner signature
                doc.moveTo(45, y + 35).lineTo(185, y + 35).dash(3, { space: 3 }).stroke('#B1B1B1');
                doc.undash();
                doc.fontSize(7.5).fillColor(textMuted).font('Helvetica-Bold').text('PROPERTY OWNER SIGNATURE', 45, y + 40);
            } else {
                doc.moveTo(45, y + 35).lineTo(185, y + 35).dash(3, { space: 3 }).stroke('#B1B1B1');
                doc.undash();
                doc.fontSize(7.5).fillColor(textMuted).font('Helvetica-Bold').text('PROPERTY OWNER SIGNATURE', 45, y + 40);
            }

            doc.moveTo(395, y + 35).lineTo(550, y + 35).dash(3, { space: 3 }).stroke('#B1B1B1');
            doc.undash();
            doc.fontSize(7.5).fillColor(textMuted).font('Helvetica-Bold').text('TENANT SIGNATURE', 395, y + 40, { width: 155, align: 'right' });

            // Footer
            doc.moveTo(45, 760).lineTo(550, 760).dash(2, { space: 2 }).stroke('#E6EFF5');
            doc.undash();
            doc.fontSize(8)
               .fillColor(textMuted)
               .font('Helvetica-Bold')
               .text('Powered by Property Manager Suite', 45, 768);

            doc.fontSize(8)
               .fillColor('#EF4444')
               .font('Helvetica-Bold')
               .text('PAYMENT REQUIRED', 395, 768, { width: 155, align: 'right' });

            doc.end();
        } catch (e) {
            reject(e);
        }
    });
}

module.exports = {
    generateRentReceiptPdf,
    generateUtilityBillPdf,
    generateArrearsStatementPdf
};

