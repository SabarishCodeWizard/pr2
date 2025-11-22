// Authentication check for all pages
function checkAuthentication() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const loginTime = localStorage.getItem('loginTime');

    // Check if user is authenticated and session is valid (24 hours)
    if (!isAuthenticated || isAuthenticated !== 'true') {
        redirectToLogin();
        return false;
    }

    // Optional: Check if login session is still valid (24 hours)
    if (loginTime) {
        const loginDate = new Date(loginTime);
        const currentDate = new Date();
        const hoursDiff = (currentDate - loginDate) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
            // Session expired
            localStorage.clear();
            redirectToLogin();
            return false;
        }
    }

    return true;
}

function redirectToLogin() {
    window.location.href = 'login.html';
}

function logout() {
    localStorage.clear();
    redirectToLogin();
}

// Invoice history page functionality
document.addEventListener('DOMContentLoaded', async function () {

    if (!checkAuthentication()) {
        return;
    }

    // Initialize database
    await db.init();

    // Load recent invoices
    loadRecentInvoices();



    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');

    if (searchParam) {
        document.getElementById('searchInput').value = searchParam;
    }


    // Load all invoices
    loadInvoices();

    // Add event listeners
    document.getElementById('searchBtn').addEventListener('click', loadInvoices);
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('generateCustomerStatement').addEventListener('click', searchCustomerInvoices);
    document.getElementById('clearCustomerStatement').addEventListener('click', clearCustomerStatement);
});


// Search for all invoices by customer name
async function searchCustomerInvoices() {
    const customerName = document.getElementById('customerSearch').value.trim();

    if (!customerName) {
        alert('Please enter a customer name');
        return;
    }

    try {
        const invoices = await db.getAllInvoices();
        const customerInvoices = invoices.filter(invoice =>
            invoice.customerName.toLowerCase().includes(customerName.toLowerCase())
        );

        if (customerInvoices.length === 0) {
            document.getElementById('customerStatementResults').innerHTML = `
                <div class="no-customer-invoices">
                    No invoices found for customer: "${customerName}"
                </div>
            `;
            return;
        }

        displayCustomerStatementResults(customerName, customerInvoices);
    } catch (error) {
        console.error('Error searching customer invoices:', error);
        alert('Error searching customer invoices.');
    }
}


// Display customer statement results
async function displayCustomerStatementResults(customerName, invoices) {
    // Sort invoices by invoice number (newest first)
    invoices.sort((a, b) => {
        const numA = parseInt(a.invoiceNo) || 0;
        const numB = parseInt(b.invoiceNo) || 0;
        return numB - numA; // Descending order (newest first)
    });

    // Calculate returns for all invoices
    const invoicesWithReturns = await Promise.all(
        invoices.map(async (invoice) => {
            const totalReturns = await Utils.calculateTotalReturns(invoice.invoiceNo);
            return {
                ...invoice,
                totalReturns,
                adjustedBalanceDue: invoice.balanceDue - totalReturns
            };
        })
    );

    // Calculate summary statistics
    const totalInvoices = invoicesWithReturns.length;
    const totalCurrentBillAmount = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.subtotal, 0);
    const totalReturns = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.totalReturns, 0);
    const totalPaid = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.amountPaid, 0);

    // Get adjusted balance due from the most recent invoice
    const mostRecentInvoice = invoicesWithReturns[0];
    const adjustedBalanceDue = mostRecentInvoice.adjustedBalanceDue;

    document.getElementById('customerStatementResults').innerHTML = `
        <div class="customer-summary">
            <h4>Customer: ${customerName}</h4>
            <div class="summary-stats">
                <div class="stat-item">
                    <div class="stat-value">${totalInvoices}</div>
                    <div class="stat-label">Total Invoices</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">₹${Utils.formatCurrency(totalCurrentBillAmount)}</div>
                    <div class="stat-label">Total Current Bill Amount</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">₹${Utils.formatCurrency(totalPaid)}</div>
                    <div class="stat-label">Total Paid</div>
                </div>
                ${totalReturns > 0 ? `
                    <div class="stat-item">
                        <div class="stat-value" style="color: #dc3545;">-₹${Utils.formatCurrency(totalReturns)}</div>
                        <div class="stat-label">Total Returns</div>
                    </div>
                ` : ''}
                <div class="stat-item">
                    <div class="stat-value ${adjustedBalanceDue > 0 ? 'amount-negative' : (adjustedBalanceDue < 0 ? 'amount-positive' : '')}">
                        ₹${Utils.formatCurrency(adjustedBalanceDue)}
                    </div>
                    <div class="stat-label">${totalReturns > 0 ? 'Adjusted Balance Due' : 'Balance Due'}</div>
                </div>
            </div>
            
            <div class="customer-invoices-list">
                ${invoicesWithReturns.map(invoice => {
        const previousBalance = invoice.grandTotal - invoice.subtotal;
        return `
                    <div class="customer-invoice-item">
                        <div class="customer-invoice-info">
                            <strong>Invoice #${invoice.invoiceNo}</strong> - 
                            ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')} - 
                            Current: ₹${Utils.formatCurrency(invoice.subtotal)} - 
                            ${previousBalance > 0 ? `Prev Bal: ₹${Utils.formatCurrency(previousBalance)} - ` : ''}
                            Paid: ₹${Utils.formatCurrency(invoice.amountPaid)}
                            ${invoice.totalReturns > 0 ? ` - Returns: ₹${Utils.formatCurrency(invoice.totalReturns)}` : ''}
                            - Due: ₹${Utils.formatCurrency(invoice.totalReturns > 0 ? invoice.adjustedBalanceDue : invoice.balanceDue)}
                            ${invoice.totalReturns > 0 ? ' (Adjusted)' : ''}
                        </div>
                        ${invoice.totalReturns > 0 ? `
                            <div class="return-badge">
                                <i class="fas fa-undo"></i> Returns: ₹${Utils.formatCurrency(invoice.totalReturns)}
                            </div>
                        ` : ''}
                    </div>
                `}).join('')}
            </div>
            
            <div class="statement-actions">
                <button id="downloadCombinedStatement" onclick="generateCombinedStatement('${customerName}')">
                    <i class="fas fa-download"></i> Download Combined Statement PDF
                </button>
                <button id="shareCombinedStatement" onclick="shareCombinedStatementViaWhatsApp('${customerName}')">
                    <i class="fab fa-whatsapp"></i> Share via WhatsApp
                </button>
            </div>
        </div>
    `;
}

// Generate combined statement PDF for all customer invoices
async function generateCombinedStatement(customerName) {
    try {
        const invoices = await db.getAllInvoices();
        const customerInvoices = invoices.filter(invoice =>
            invoice.customerName.toLowerCase().includes(customerName.toLowerCase())
        );

        if (customerInvoices.length === 0) {
            alert('No invoices found for this customer.');
            return;
        }

        await generateCombinedPDFStatement(customerName, customerInvoices);
    } catch (error) {
        console.error('Error generating combined statement:', error);
        alert('Error generating combined statement.');
    }
}


// Generate combined PDF statement for all customer invoices - SIMPLE & PROFESSIONAL
async function generateCombinedPDFStatement(customerName, invoices) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        let yPos = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);

        // Simple color scheme
        const primaryColor = [0, 0, 0]; // Black
        const accentColor = [0, 100, 0]; // Dark Green
        const grayColor = [100, 100, 100]; // Gray

        // HEADER
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('PR FABRICS', pageWidth / 2, yPos, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text('42/65, THIRUNEELAKANDA PURAM, 1ST STREET, TIRUPUR 641-602', pageWidth / 2, yPos + 5, { align: 'center' });
        doc.text('Cell: 9952520181 | GSTIN: 33CLJPG4331G1ZG', pageWidth / 2, yPos + 10, { align: 'center' });

        yPos += 20;

        // TITLE
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('COMBINED ACCOUNT STATEMENT', pageWidth / 2, yPos, { align: 'center' });

        // Underline
        doc.setDrawColor(...accentColor);
        doc.setLineWidth(0.5);
        doc.line(pageWidth / 2 - 50, yPos + 2, pageWidth / 2 + 50, yPos + 2);

        yPos += 15;

        // Sort invoices by invoice number (newest first)
        invoices.sort((a, b) => {
            const numA = parseInt(a.invoiceNo) || 0;
            const numB = parseInt(b.invoiceNo) || 0;
            return numB - numA;
        });

        // Calculate returns for all invoices
        const invoicesWithReturns = await Promise.all(
            invoices.map(async (invoice) => {
                const totalReturns = await Utils.calculateTotalReturns(invoice.invoiceNo);
                const returns = await db.getReturnsByInvoice(invoice.invoiceNo);
                const payments = await db.getPaymentsByInvoice(invoice.invoiceNo);
                return {
                    ...invoice,
                    totalReturns,
                    adjustedBalanceDue: invoice.balanceDue - totalReturns,
                    returns,
                    payments
                };
            })
        );

        // Get customer details from the most recent invoice
        const mostRecentInvoice = invoicesWithReturns[0];
        const customerPhone = mostRecentInvoice.customerPhone || 'Not specified';
        const customerAddress = mostRecentInvoice.customerAddress || 'Not specified';

        // Calculate totals
        const totalCurrentBillAmount = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.subtotal, 0);
        const totalPaid = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
        const totalReturns = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.totalReturns, 0);
        const adjustedBalanceDue = mostRecentInvoice.adjustedBalanceDue;

        // STATEMENT INFORMATION SECTION
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('STATEMENT INFORMATION', margin, yPos);
        yPos += 7;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);

        doc.text(`Statement Date: ${new Date().toLocaleDateString('en-IN')}`, margin, yPos);
        yPos += 4;

        // Calculate statement period
        const invoiceDates = invoicesWithReturns.map(inv => new Date(inv.invoiceDate));
        const oldestDate = new Date(Math.min(...invoiceDates));
        const newestDate = new Date(Math.max(...invoiceDates));
        const statementPeriod = `${oldestDate.toLocaleDateString('en-IN')} to ${newestDate.toLocaleDateString('en-IN')}`;
        doc.text(`Statement Period: ${statementPeriod}`, margin, yPos);
        yPos += 4;

        doc.text(`Total Invoices: ${invoices.length}`, margin, yPos);
        yPos += 4;

        // Invoice numbers
        const invoiceNumbers = invoicesWithReturns.map(inv => inv.invoiceNo);
        const invoiceNumbersText = invoiceNumbers.length <= 3
            ? invoiceNumbers.join(', ')
            : `${invoiceNumbers.slice(0, 3).join(', ')}... (+${invoiceNumbers.length - 3} more)`;
        doc.text(`Invoice Numbers: ${invoiceNumbersText}`, margin, yPos);
        yPos += 10;

        // CUSTOMER INFORMATION SECTION
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('CUSTOMER INFORMATION', margin, yPos);
        yPos += 7;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);

        doc.text(`Name: ${customerName}`, margin, yPos);
        yPos += 4;
        doc.text(`Phone: ${customerPhone}`, margin, yPos);
        yPos += 4;
        doc.text(`Address: ${customerAddress}`, margin, yPos);
        yPos += 10;

        // Process each invoice separately
        for (let i = 0; i < invoicesWithReturns.length; i++) {
            const invoice = invoicesWithReturns[i];

            // Check if we need a new page before starting a new invoice
            if (yPos > 240) {
                doc.addPage();
                yPos = 20;
            }

            // INVOICE HEADER
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text(`INVOICE #${invoice.invoiceNo} - ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}`, margin, yPos);
            yPos += 6;

            // Simple underline for invoice header
            doc.setDrawColor(...grayColor);
            doc.setLineWidth(0.3);
            doc.line(margin, yPos, margin + 60, yPos);
            yPos += 8;

            // Invoice details table
            const invoiceTableHeaders = [['S.No.', 'Description', 'Qty', 'Rate', 'Amount']];
            const invoiceTableData = invoice.products.map((product, index) => [
                (index + 1).toString(),
                product.description,
                product.qty.toString(),
                Utils.formatCurrency(product.rate),
                Utils.formatCurrency(product.amount)
            ]);

            doc.autoTable({
                startY: yPos,
                head: invoiceTableHeaders,
                body: invoiceTableData,
                theme: 'grid',
                headStyles: {
                    fillColor: [240, 240, 240],
                    textColor: primaryColor,
                    fontStyle: 'bold',
                    fontSize: 8,
                    cellPadding: 3,
                    lineWidth: 0.3
                },
                bodyStyles: {
                    fontSize: 8,
                    cellPadding: 2,
                    lineColor: [220, 220, 220],
                    lineWidth: 0.1
                },
                columnStyles: {
                    0: { cellWidth: 12, halign: 'center' },
                    1: { cellWidth: 'auto', halign: 'left' },
                    2: { cellWidth: 15, halign: 'center' },
                    3: { cellWidth: 20, halign: 'right' },
                    4: { cellWidth: 22, halign: 'right' }
                },
                margin: { left: margin, right: margin },
                styles: {
                    lineColor: [200, 200, 200],
                    lineWidth: 0.2
                }
            });

            yPos = doc.lastAutoTable.finalY + 8;

            // Check if we need a new page before invoice summary
            if (yPos > 220) {
                doc.addPage();
                yPos = 20;
            }

            // INVOICE SUMMARY
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...grayColor);

            let summaryY = yPos;

            // Current Bill Amount
            doc.text('Current Bill Amount:', margin, summaryY);
            doc.text(`₹${Utils.formatCurrency(invoice.subtotal)}`, pageWidth - margin, summaryY, { align: 'right' });
            summaryY += 4;

            // Previous Balance
            const previousBalance = invoice.grandTotal - invoice.subtotal;
            if (previousBalance > 0) {
                doc.text('Previous Balance:', margin, summaryY);
                doc.text(`₹${Utils.formatCurrency(previousBalance)}`, pageWidth - margin, summaryY, { align: 'right' });
                summaryY += 4;
            }

            // Total Amount
            doc.setFont('helvetica', 'bold');
            doc.text('Total Amount:', margin, summaryY);
            doc.text(`₹${Utils.formatCurrency(invoice.grandTotal)}`, pageWidth - margin, summaryY, { align: 'right' });
            summaryY += 4;

            // Amount Paid
            doc.setFont('helvetica', 'normal');
            doc.text('Amount Paid:', margin, summaryY);
            doc.text(`₹${Utils.formatCurrency(invoice.amountPaid)}`, pageWidth - margin, summaryY, { align: 'right' });
            summaryY += 4;

            // Returns (if any)
            if (invoice.totalReturns > 0) {
                doc.text('Returns:', margin, summaryY);
                doc.text(`-₹${Utils.formatCurrency(invoice.totalReturns)}`, pageWidth - margin, summaryY, { align: 'right' });
                summaryY += 4;
            }

            // Balance Due
            doc.setFont('helvetica', 'bold');
            if (invoice.totalReturns > 0) {
                doc.text('Adjusted Balance Due:', margin, summaryY);
                doc.text(`₹${Utils.formatCurrency(invoice.adjustedBalanceDue)}`, pageWidth - margin, summaryY, { align: 'right' });
            } else {
                doc.text('Balance Due:', margin, summaryY);
                doc.text(`₹${Utils.formatCurrency(invoice.balanceDue)}`, pageWidth - margin, summaryY, { align: 'right' });
            }

            yPos = summaryY + 12;

            // Add return information if applicable for this invoice
            if (invoice.totalReturns > 0 && invoice.returns && invoice.returns.length > 0) {
                // Check if we need a new page
                if (yPos > 200) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...primaryColor);
                doc.text('RETURN INFORMATION', margin, yPos);
                yPos += 7;

                const returnTableHeaders = [['Date', 'Product', 'Qty', 'Rate', 'Amount']];
                const returnTableData = invoice.returns.map((returnItem, index) => [
                    new Date(returnItem.returnDate).toLocaleDateString('en-IN'),
                    returnItem.description,
                    returnItem.qty.toString(),
                    Utils.formatCurrency(returnItem.rate),
                    Utils.formatCurrency(returnItem.returnAmount)
                ]);

                doc.autoTable({
                    startY: yPos,
                    head: returnTableHeaders,
                    body: returnTableData,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [240, 240, 240],
                        textColor: primaryColor,
                        fontStyle: 'bold',
                        fontSize: 8,
                        cellPadding: 3
                    },
                    bodyStyles: {
                        fontSize: 7,
                        cellPadding: 2,
                        lineColor: [220, 220, 220],
                        lineWidth: 0.1
                    },
                    columnStyles: {
                        0: { cellWidth: 22, halign: 'center' },
                        1: { cellWidth: 'auto', halign: 'left' },
                        2: { cellWidth: 15, halign: 'center' },
                        3: { cellWidth: 20, halign: 'right' },
                        4: { cellWidth: 22, halign: 'right' }
                    },
                    margin: { left: margin, right: margin }
                });

                yPos = doc.lastAutoTable.finalY + 10;
            }

            // Add payment history for this invoice
            if (invoice.payments && invoice.payments.length > 0) {
                // Check if we need a new page for payment history
                if (yPos > 200) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...primaryColor);
                doc.text('PAYMENT HISTORY', margin, yPos);
                yPos += 7;

                // Create payment history table for this invoice
                const paymentTableHeaders = [['Date', 'Description', 'Amount', 'Balance']];
                const paymentTableData = generatePaymentTableData(invoice.payments, invoice.grandTotal, invoice.totalReturns);

                doc.autoTable({
                    startY: yPos,
                    head: paymentTableHeaders,
                    body: paymentTableData,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [240, 240, 240],
                        textColor: primaryColor,
                        fontStyle: 'bold',
                        fontSize: 8,
                        cellPadding: 3
                    },
                    bodyStyles: {
                        fontSize: 8,
                        cellPadding: 2,
                        lineColor: [220, 220, 220],
                        lineWidth: 0.1
                    },
                    columnStyles: {
                        0: { cellWidth: 25, halign: 'center' },
                        1: { cellWidth: 'auto', halign: 'left' },
                        2: { cellWidth: 25, halign: 'right' },
                        3: { cellWidth: 25, halign: 'right' }
                    },
                    margin: { left: margin, right: margin }
                });

                yPos = doc.lastAutoTable.finalY + 15;
            }

            // Add spacing between invoices
            if (i < invoicesWithReturns.length - 1) {
                // Simple separator line between invoices
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.2);
                doc.line(margin, yPos, pageWidth - margin, yPos);
                yPos += 8;
            }
        }

        // Check if we need a new page for account summary
        if (yPos > 180) {
            doc.addPage();
            yPos = 20;
        }

        // FINAL ACCOUNT SUMMARY
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('ACCOUNT SUMMARY', pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;

        // Underline for summary title
        doc.setDrawColor(...accentColor);
        doc.setLineWidth(0.5);
        doc.line(pageWidth / 2 - 30, yPos, pageWidth / 2 + 30, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);

        // Total Current Bill Amount
        doc.text('Total Current Bill Amount:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(totalCurrentBillAmount)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 6;

        // Total Amount Paid
        doc.text('Total Amount Paid:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(totalPaid)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 6;

        // Total Returns (if any)
        if (totalReturns > 0) {
            doc.text('Total Returns:', margin, yPos);
            doc.text(`-₹${Utils.formatCurrency(totalReturns)}`, pageWidth - margin, yPos, { align: 'right' });
            yPos += 6;
        }

        // Separator line before final balance
        doc.setDrawColor(...grayColor);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 6;

        // Outstanding Balance
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        if (totalReturns > 0) {
            doc.setTextColor(...accentColor);
            doc.text('ADJUSTED OUTSTANDING BALANCE:', margin, yPos);
            doc.text(`₹${Utils.formatCurrency(adjustedBalanceDue)}`, pageWidth - margin, yPos, { align: 'right' });
        } else {
            doc.setTextColor(...primaryColor);
            doc.text('OUTSTANDING BALANCE:', margin, yPos);
            doc.text(`₹${Utils.formatCurrency(adjustedBalanceDue)}`, pageWidth - margin, yPos, { align: 'right' });
        }

        // FOOTER
        yPos = pageHeight - 20;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text('This is a computer-generated statement. No signature is required.', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text('For any queries, please contact: 9952520181', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, yPos, { align: 'center' });

        // Generate filename and save
        const today = new Date();
        const dateFolder = today.toISOString().split('T')[0];
        const fileName = `Statement_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateFolder}.pdf`;

        doc.save(fileName);

        setTimeout(() => {
            alert(`Combined statement saved as: ${fileName}`);
        }, 500);

    } catch (error) {
        console.error('Error generating combined PDF statement:', error);
        throw error;
    }
}

// Load and display recent invoices (last 5 by invoice number)
async function loadRecentInvoices() {
    try {
        const invoices = await db.getAllInvoices();

        // Sort by invoice number in descending order (highest numbers first)
        const recentInvoices = invoices
            .sort((a, b) => {
                // Convert invoice numbers to numbers for proper numerical sorting
                const numA = parseInt(a.invoiceNo) || 0;
                const numB = parseInt(b.invoiceNo) || 0;
                return numB - numA; // Descending order (highest first)
            })
            .slice(0, 5);

        displayRecentInvoices(recentInvoices);
    } catch (error) {
        console.error('Error loading recent invoices:', error);
    }
}
// Display recent invoices at the top
function displayRecentInvoices(invoices) {
    const recentInvoicesList = document.getElementById('recentInvoicesList');

    if (invoices.length === 0) {
        recentInvoicesList.innerHTML = '<p class="no-recent-invoices">No recent invoices found.</p>';
        return;
    }

    recentInvoicesList.innerHTML = invoices.map(invoice => `
        <div class="recent-invoice-item" onclick="filterByInvoice('${invoice.invoiceNo}')">
            <span class="invoice-number">#${invoice.invoiceNo}</span>
            <span class="invoice-customer">${invoice.customerName}</span>
            <span class="invoice-date">${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>
            <span class="invoice-amount">₹${Utils.formatCurrency(invoice.subtotal)}</span>
        </div>
    `).join('');
}

// Filter invoices by specific invoice number
function filterByInvoice(invoiceNo) {
    document.getElementById('searchInput').value = invoiceNo;
    loadInvoices();
}

// Update the loadInvoices function to handle date filtering better
async function loadInvoices() {
    try {
        const invoices = await db.getAllInvoices();
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const fromDate = document.getElementById('fromDate').value;
        const toDate = document.getElementById('toDate').value;
        const fromInvoiceNo = document.getElementById('fromInvoiceNo').value;
        const toInvoiceNo = document.getElementById('toInvoiceNo').value;

        let filteredInvoices = invoices;

        // Apply search filter
        if (searchTerm) {
            filteredInvoices = filteredInvoices.filter(invoice =>
                invoice.customerName.toLowerCase().includes(searchTerm) ||
                invoice.invoiceNo.toLowerCase().includes(searchTerm)
            );
        }

        // Apply date filters
        if (fromDate) {
            filteredInvoices = filteredInvoices.filter(invoice =>
                invoice.invoiceDate >= fromDate
            );
        }

        if (toDate) {
            filteredInvoices = filteredInvoices.filter(invoice =>
                invoice.invoiceDate <= toDate
            );
        }

        // Apply invoice number range filter
        if (fromInvoiceNo || toInvoiceNo) {
            filteredInvoices = filteredInvoices.filter(invoice => {
                const invoiceNum = parseInt(invoice.invoiceNo) || 0;

                if (fromInvoiceNo && toInvoiceNo) {
                    return invoiceNum >= parseInt(fromInvoiceNo) && invoiceNum <= parseInt(toInvoiceNo);
                } else if (fromInvoiceNo) {
                    return invoiceNum >= parseInt(fromInvoiceNo);
                } else if (toInvoiceNo) {
                    return invoiceNum <= parseInt(toInvoiceNo);
                }
                return true;
            });
        }

        // Sort by invoice date and number (newest first)
        filteredInvoices.sort((a, b) => {
            // First sort by date (newest first)
            const dateCompare = new Date(b.invoiceDate) - new Date(a.invoiceDate);
            if (dateCompare !== 0) return dateCompare;

            // If same date, sort by invoice number (highest first)
            const numA = parseInt(a.invoiceNo) || 0;
            const numB = parseInt(b.invoiceNo) || 0;
            return numB - numA;
        });

        displayInvoices(filteredInvoices);
    } catch (error) {
        console.error('Error loading invoices:', error);
        alert('Error loading invoices.');
    }
}

// Add this function to get date statistics (optional)
async function getDateWiseStatistics() {
    try {
        const invoices = await db.getAllInvoices();
        const groupedInvoices = groupInvoicesByDate(invoices);

        return {
            totalDays: groupedInvoices.length,
            dateGroups: groupedInvoices,
            overallStats: {
                totalInvoices: invoices.length
            }
        };
    } catch (error) {
        console.error('Error getting date statistics:', error);
        return null;
    }
}


// Add Return to an invoice - UPDATED to show current adjusted balance
async function addReturn(invoiceNo) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        if (!invoiceData) {
            alert('Invoice not found!');
            return;
        }

        // Calculate current returns to get adjusted balance
        const totalReturns = await Utils.calculateTotalReturns(invoiceNo);
        const currentAdjustedBalance = invoiceData.balanceDue - totalReturns;

        // Create return dialog
        const returnDialog = document.createElement('div');
        returnDialog.className = 'return-dialog-overlay';
        returnDialog.innerHTML = `
            <div class="return-dialog">
                <div class="return-dialog-header">
                    <h3>Process Return - Invoice #${invoiceNo}</h3>
                    <button class="close-return-dialog">&times;</button>
                </div>
                
                <div class="return-customer-info">
                    <h4>Customer: ${invoiceData.customerName}</h4>
                    <p>Invoice Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}</p>
                    ${totalReturns > 0 ? `<p style="color: #dc3545; font-weight: bold;">Previous Returns: ₹${Utils.formatCurrency(totalReturns)}</p>` : ''}
                </div>

                <div class="return-form-section">
                    <div class="form-group">
                        <label for="returnDate">Return Date:</label>
                        <input type="date" id="returnDate" value="${new Date().toISOString().split('T')[0]}">
                    </div>

                    <div class="return-products-section">
                        <h4>Return Products</h4>
                        <div class="return-products-list" id="returnProductsList">
                            <!-- Return items will be added here -->
                        </div>
                        <button type="button" class="btn-add-return-item" onclick="addReturnItem()">
                            <i class="fas fa-plus"></i> Add Return Item
                        </button>
                    </div>

                    <div class="return-summary">
                        <div class="summary-item">
                            <span>Original Balance Due:</span>
                            <span>₹${Utils.formatCurrency(invoiceData.balanceDue)}</span>
                        </div>
                        ${totalReturns > 0 ? `
                        <div class="summary-item">
                            <span>Previous Returns:</span>
                            <span style="color: #dc3545;">-₹${Utils.formatCurrency(totalReturns)}</span>
                        </div>
                        <div class="summary-item">
                            <span>Current Balance Before This Return:</span>
                            <span>₹${Utils.formatCurrency(currentAdjustedBalance)}</span>
                        </div>
                        ` : ''}
                        <div class="summary-item">
                            <span>This Return Amount:</span>
                            <span id="totalReturnAmount">₹0.00</span>
                        </div>
                        <div class="summary-item total">
                            <span>New Adjusted Balance Due:</span>
                            <span id="adjustedBalanceDue">₹${Utils.formatCurrency(currentAdjustedBalance)}</span>
                        </div>
                    </div>

                    <div class="return-dialog-actions">
                        <button type="button" class="btn-save-return" onclick="saveReturn('${invoiceNo}')">
                            <i class="fas fa-save"></i> Save Return
                        </button>
                        <button type="button" class="btn-view-return-status" onclick="viewReturnStatus('${invoiceNo}')">
                            <i class="fas fa-history"></i> View Return Status
                        </button>
                        <button type="button" class="btn-cancel-return">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(returnDialog);

        // Store the current adjusted balance in a data attribute for calculations
        returnDialog.querySelector('.return-dialog').dataset.currentBalance = currentAdjustedBalance;

        // Initialize with one return item - pass the products
        addReturnItem(invoiceData.products || []);

        // Event listeners
        returnDialog.querySelector('.close-return-dialog').addEventListener('click', () => {
            document.body.removeChild(returnDialog);
        });

        returnDialog.querySelector('.btn-cancel-return').addEventListener('click', () => {
            document.body.removeChild(returnDialog);
        });

        returnDialog.addEventListener('click', (e) => {
            if (e.target === returnDialog) {
                document.body.removeChild(returnDialog);
            }
        });

    } catch (error) {
        console.error('Error opening return dialog:', error);
        alert('Error processing return.');
    }
}

// Update return summary - FIXED to use current adjusted balance
function updateReturnSummary() {
    let totalReturnAmount = 0;
    const returnItems = document.querySelectorAll('.return-item');

    returnItems.forEach(item => {
        const amount = parseFloat(item.querySelector('.return-amount').value) || 0;
        totalReturnAmount += amount;
    });

    document.getElementById('totalReturnAmount').textContent = `₹${Utils.formatCurrency(totalReturnAmount)}`;

    // Get current balance from data attribute instead of original balance
    const returnDialog = document.querySelector('.return-dialog');
    const currentBalance = parseFloat(returnDialog.dataset.currentBalance) || 0;
    const newAdjustedBalance = currentBalance - totalReturnAmount;

    document.getElementById('adjustedBalanceDue').textContent = `₹${Utils.formatCurrency(newAdjustedBalance)}`;
}

// Save return - UPDATED to handle multiple returns correctly
async function saveReturn(invoiceNo) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        const returnDate = document.getElementById('returnDate').value;
        const returnItems = document.querySelectorAll('.return-item');

        if (!returnDate) {
            alert('Please select a return date.');
            return;
        }

        if (returnItems.length === 0) {
            alert('Please add at least one return item.');
            return;
        }

        const returns = [];
        let totalReturnAmount = 0;

        // Collect return items
        for (const item of returnItems) {
            const index = item.dataset.index;
            const descriptionSelect = document.getElementById(`productDescription${index}`);
            const customInput = document.getElementById(`customProduct${index}`);
            const description = descriptionSelect.value === 'custom' ? customInput.value : descriptionSelect.value;
            const qty = parseFloat(document.getElementById(`returnQty${index}`).value) || 0;
            const rate = parseFloat(document.getElementById(`returnRate${index}`).value) || 0;
            const amount = parseFloat(document.getElementById(`returnAmount${index}`).value) || 0;
            const reason = document.getElementById(`returnReason${index}`).value;

            if (!description || qty <= 0 || rate <= 0) {
                alert('Please fill all required fields for return item ' + (parseInt(index) + 1));
                return;
            }

            // Check if returning more than available quantity for invoice products
            if (descriptionSelect.value !== 'custom' && descriptionSelect.value !== '') {
                const selectedOption = descriptionSelect.options[descriptionSelect.selectedIndex];
                const maxQty = parseFloat(selectedOption.dataset.maxqty) || 0;
                const alreadyReturnedQty = await getAlreadyReturnedQty(invoiceNo, description);

                if ((qty + alreadyReturnedQty) > maxQty) {
                    alert(`Cannot return ${qty} items. Only ${maxQty - alreadyReturnedQty} items available for return for "${description}".`);
                    return;
                }
            }

            returns.push({
                description,
                qty,
                rate,
                returnAmount: amount,
                reason,
                returnDate
            });

            totalReturnAmount += amount;
        }

        // Validate that return amount doesn't exceed current balance
        const currentReturns = await Utils.calculateTotalReturns(invoiceNo);
        const currentBalance = invoiceData.balanceDue - currentReturns;

        if (totalReturnAmount > currentBalance) {
            alert(`Return amount (₹${Utils.formatCurrency(totalReturnAmount)}) cannot exceed current balance (₹${Utils.formatCurrency(currentBalance)})`);
            return;
        }

        // Save return records
        for (const returnItem of returns) {
            const returnData = {
                invoiceNo: invoiceNo,
                customerName: invoiceData.customerName,
                ...returnItem,
                createdAt: new Date().toISOString()
            };
            await db.saveReturn(returnData);
        }

        // Update invoice with return information
        await Utils.updateInvoiceWithReturns(invoiceNo);

        // Update all subsequent invoices
        await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

        alert(`Return processed successfully! Total return amount: ₹${Utils.formatCurrency(totalReturnAmount)}`);

        // Close dialog and refresh
        document.querySelector('.return-dialog-overlay').remove();
        loadInvoices();

    } catch (error) {
        console.error('Error saving return:', error);
        alert('Error processing return.');
    }
}

// Helper function to get already returned quantity for a product
async function getAlreadyReturnedQty(invoiceNo, productDescription) {
    try {
        const returns = await db.getReturnsByInvoice(invoiceNo);
        const productReturns = returns.filter(returnItem =>
            returnItem.description === productDescription
        );

        return productReturns.reduce((total, returnItem) => total + returnItem.qty, 0);
    } catch (error) {
        console.error('Error getting already returned quantity:', error);
        return 0;
    }
}


// Add this new function to group invoices by date
function groupInvoicesByDate(invoices) {
    const groupedInvoices = {};

    invoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.invoiceDate).toLocaleDateString('en-IN');

        if (!groupedInvoices[invoiceDate]) {
            groupedInvoices[invoiceDate] = {
                date: invoiceDate,
                invoices: [],
                totalInvoices: 0
            };
        }

        groupedInvoices[invoiceDate].invoices.push(invoice);
        groupedInvoices[invoiceDate].totalInvoices++;
    });

    // Convert to array and sort by date (newest first)
    return Object.values(groupedInvoices).sort((a, b) => {
        return new Date(b.date.split('/').reverse().join('-')) - new Date(a.date.split('/').reverse().join('-'));
    });
}


// Modify the displayInvoices function to show date-wise grouping
async function displayInvoices(invoices) {
    const invoicesList = document.getElementById('invoicesList');

    if (invoices.length === 0) {
        invoicesList.innerHTML = '<p class="no-invoices">No invoices found.</p>';
        return;
    }

    // Group invoices by date
    const groupedInvoices = groupInvoicesByDate(invoices);

    let htmlContent = '';

    // Generate HTML for each date group
    for (const group of groupedInvoices) {
        // Calculate returns for all invoices in this date group first
        const invoicesWithReturns = await Promise.all(
            group.invoices.map(async (invoice) => {
                const totalReturns = await Utils.calculateTotalReturns(invoice.invoiceNo);
                const adjustedBalanceDue = invoice.balanceDue - totalReturns;

                return {
                    ...invoice,
                    totalReturns,
                    adjustedBalanceDue,
                    isCurrentAdjustedBalance: true
                };
            })
        );

        // Add date group header (only date and count)
        htmlContent += `
            <div class="date-group">
                <div class="date-group-header">
                    <h3 class="date-title">
                        <i class="fas fa-calendar-day"></i>
                        ${group.date}
                    </h3>
                    <div class="date-summary">
                        <span class="invoice-count">${group.totalInvoices} Invoice${group.totalInvoices > 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div class="date-invoices-list">
        `;

        // Add individual invoices for this date
        htmlContent += invoicesWithReturns.map(invoice => {
            // Calculate previous bill amount (grandTotal - subtotal)
            const previousBillAmount = invoice.grandTotal - invoice.subtotal;

            return `
            <div class="invoice-item">
                <div class="invoice-info">
                    <h3>Invoice #${invoice.invoiceNo}</h3>
                    <p><strong>Customer:</strong> ${invoice.customerName}</p>
                    
                    <p><strong>Current Bill Amount:</strong> ₹${Utils.formatCurrency(invoice.subtotal)}</p>
                    <p><strong>Previous Balance:</strong> ₹${Utils.formatCurrency(previousBillAmount)}</p>
                    <p><strong>Total Amount:</strong> ₹${Utils.formatCurrency(invoice.grandTotal)}</p>
                    <p><strong>Amount Paid:</strong> ₹${Utils.formatCurrency(invoice.amountPaid)} 
                        ${invoice.paymentMethod ? `<span class="payment-method-badge payment-method-${invoice.paymentMethod}">${invoice.paymentMethod.toUpperCase()}</span>` : ''}
                    </p>
                    ${invoice.totalReturns > 0 ? `
                        <p><strong>Return Amount:</strong> <span style="color: #dc3545;">-₹${Utils.formatCurrency(invoice.totalReturns)}</span></p>
                        <p><strong>Current Adjusted Balance Due:</strong> ₹${Utils.formatCurrency(invoice.adjustedBalanceDue)}</p>
                    ` : `
                        <p><strong>Balance Due:</strong> ₹${Utils.formatCurrency(invoice.balanceDue)}</p>
                    `}
                </div>
                <div class="invoice-actions">
                    <button class="btn-edit" onclick="editInvoice('${invoice.invoiceNo}')">Edit</button>
                    <button class="btn-payment" onclick="addPayment('${invoice.invoiceNo}')">Add Payment</button>
                    <button class="btn-return" onclick="addReturn('${invoice.invoiceNo}')">Return</button>
                    <button class="btn-statement" onclick="generateStatement('${invoice.invoiceNo}')">Statement</button>
                    <button class="btn-share" onclick="shareInvoiceViaWhatsApp('${invoice.invoiceNo}')">
                        <i class="fab fa-whatsapp"></i> Share
                    </button>

                    
    ${invoice.amountPaid > 0 ? `
        <button class="btn-payment-history" onclick="viewPaymentHistory('${invoice.invoiceNo}')">
            <i class="fas fa-history"></i> Payment History (₹${Utils.formatCurrency(invoice.amountPaid)})
        </button>
    ` : ''}
                ${invoice.totalReturns > 0 ? `
                    <button class="btn-return-status" onclick="viewReturnStatus('${invoice.invoiceNo}')">
                        <i class="fas fa-history"></i> View/Undo Returns (₹${Utils.formatCurrency(invoice.totalReturns)})
                    </button>
                ` : ''}
                    <button class="btn-delete" onclick="deleteInvoice('${invoice.invoiceNo}')">Delete</button>
                </div>
            </div>
            `;
        }).join('');

        // Close date group
        htmlContent += `
                </div>
            </div>
        `;
    }

    invoicesList.innerHTML = htmlContent;
}

// Add new function to filter by specific date
function filterByDate(selectedDate) {
    document.getElementById('fromDate').value = selectedDate;
    document.getElementById('toDate').value = selectedDate;
    loadInvoices();
}

//  <button class="btn-view" onclick="viewInvoice('${invoice.invoiceNo}')">View</button>
// <button class="btn-pdf" onclick="generateInvoicePDF('${invoice.invoiceNo}')">PDF</button>

async function shareCombinedStatementViaWhatsApp(customerName) {
    try {
        const invoices = await db.getAllInvoices();
        const customerInvoices = invoices.filter(invoice =>
            invoice.customerName.toLowerCase().includes(customerName.toLowerCase())
        );

        if (customerInvoices.length === 0) {
            alert('No invoices found for this customer.');
            return;
        }

        // Sort invoices by invoice number (newest first)
        customerInvoices.sort((a, b) => {
            const numA = parseInt(a.invoiceNo) || 0;
            const numB = parseInt(b.invoiceNo) || 0;
            return numB - numA;
        });

        // Calculate returns for all invoices
        const invoicesWithReturns = await Promise.all(
            customerInvoices.map(async (invoice) => {
                const totalReturns = await Utils.calculateTotalReturns(invoice.invoiceNo);
                const returns = await db.getReturnsByInvoice(invoice.invoiceNo);
                return {
                    ...invoice,
                    totalReturns,
                    returns,
                    adjustedBalanceDue: invoice.balanceDue - totalReturns
                };
            })
        );

        // Calculate totals with returns
        const totalInvoices = invoicesWithReturns.length;
        const totalCurrentBillAmount = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.subtotal, 0);
        const totalPaid = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
        const totalReturns = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.totalReturns, 0);

        // Calculate payment breakdown totals
        const totalCashPaid = invoicesWithReturns.reduce((sum, invoice) => sum + (invoice.paymentBreakdown?.cash || 0), 0);
        const totalUpiPaid = invoicesWithReturns.reduce((sum, invoice) => sum + (invoice.paymentBreakdown?.upi || 0), 0);
        const totalAccountPaid = invoicesWithReturns.reduce((sum, invoice) => sum + (invoice.paymentBreakdown?.account || 0), 0);

        // Get adjusted balance from the most recent invoice
        const mostRecentInvoice = invoicesWithReturns[0];
        const adjustedBalanceDue = mostRecentInvoice.adjustedBalanceDue;

        // Get customer details from the most recent invoice
        const customerPhone = mostRecentInvoice.customerPhone;
        const customerAddress = mostRecentInvoice.customerAddress;

        // Create WhatsApp message with professional formatting
        const message = `*PR FABRICS - ACCOUNT STATEMENT*
*GSTIN: 33CLJPG4331G1ZG*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*CUSTOMER DETAILS*
────────────────────────────────
👤 Customer: ${customerName}
📍 Address: ${customerAddress || 'Not specified'}
📊 Total Invoices: ${totalInvoices}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${invoicesWithReturns.map((invoice, index) => {
            const previousBalance = invoice.grandTotal - invoice.subtotal;

            // Build payment breakdown for each invoice
            let paymentDetails = '';
            if (invoice.paymentBreakdown) {
                const payments = [];
                if (invoice.paymentBreakdown.cash > 0) payments.push(`💵 Cash: ₹${Utils.formatCurrency(invoice.paymentBreakdown.cash)}`);
                if (invoice.paymentBreakdown.upi > 0) payments.push(`📱 UPI: ₹${Utils.formatCurrency(invoice.paymentBreakdown.upi)}`);
                if (invoice.paymentBreakdown.account > 0) payments.push(`🏦 Account: ₹${Utils.formatCurrency(invoice.paymentBreakdown.account)}`);
                paymentDetails = payments.length > 0 ? `\n💳 ${payments.join(' | ')}` : '';
            }

            // Build product details
            const productDetails = invoice.products && invoice.products.length > 0 ?
                `\n📦 *PRODUCTS:*\n${invoice.products.map((product, index) =>
                    `   ${index + 1}. ${product.description}\n      Qty: ${product.qty} × Rate: ₹${Utils.formatCurrency(product.rate)} = ₹${Utils.formatCurrency(product.amount)}`
                ).join('\n')}` : '';

            // Build return details
            const returnDetails = invoice.returns && invoice.returns.length > 0 ?
                `\n🔄 *RETURNS:*\n${invoice.returns.map((returnItem, index) =>
                    `   ${index + 1}. ${returnItem.description}\n      Qty: ${returnItem.qty} × Rate: ₹${Utils.formatCurrency(returnItem.rate)} = -₹${Utils.formatCurrency(returnItem.returnAmount)}${returnItem.reason ? `\n      Reason: ${returnItem.reason}` : ''}`
                ).join('\n')}` : '';

            return `*INVOICE #${invoice.invoiceNo}* ${index < invoicesWithReturns.length - 1 ? '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄' : ''}
📅 Date: ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}

💰 *BILL SUMMARY:*
   Current Bill: ₹${Utils.formatCurrency(invoice.subtotal)}
   ${previousBalance > 0 ? `Previous Balance: ₹${Utils.formatCurrency(previousBalance)}` : ''}
   Total Amount: ₹${Utils.formatCurrency(invoice.grandTotal)}
   Amount Paid: ₹${Utils.formatCurrency(invoice.amountPaid)}${paymentDetails}
   ${invoice.totalReturns > 0 ? `Returns: -₹${Utils.formatCurrency(invoice.totalReturns)}` : ''}

${productDetails}${returnDetails}

${invoice.totalReturns > 0 ?
                    `✅ *ADJUSTED BALANCE DUE: ₹${Utils.formatCurrency(invoice.adjustedBalanceDue)}*` :
                    `✅ *BALANCE DUE: ₹${Utils.formatCurrency(invoice.balanceDue)}*`}`;
        }).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*OVERALL ACCOUNT SUMMARY*
────────────────────────────────
📊 Total Invoices: ${totalInvoices}
💰 Total Current Bill Amount: ₹${Utils.formatCurrency(totalCurrentBillAmount)}
💳 Total Amount Paid: ₹${Utils.formatCurrency(totalPaid)}
${totalCashPaid > 0 ? `   💵 Cash: ₹${Utils.formatCurrency(totalCashPaid)}` : ''}
${totalUpiPaid > 0 ? `   📱 UPI: ₹${Utils.formatCurrency(totalUpiPaid)}` : ''}
${totalAccountPaid > 0 ? `   🏦 Account: ₹${Utils.formatCurrency(totalAccountPaid)}` : ''}
${totalReturns > 0 ? `🔄 Total Returns: -₹${Utils.formatCurrency(totalReturns)}` : ''}

${totalReturns > 0 ?
                `✅ *ADJUSTED OUTSTANDING BALANCE: ₹${Utils.formatCurrency(adjustedBalanceDue)}*` :
                `✅ *OUTSTANDING BALANCE: ₹${Utils.formatCurrency(mostRecentInvoice.balanceDue)}*`}

${totalReturns > 0 ? `
*RETURN SUMMARY*
────────────────────────────────
📦 Total Return Amount: ₹${Utils.formatCurrency(totalReturns)}
` : ''}

*INVOICE NUMBERS*
────────────────────────────────
${invoicesWithReturns.map(invoice =>
                    `• #${invoice.invoiceNo} - ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')} - Due: ₹${Utils.formatCurrency(invoice.totalReturns > 0 ? invoice.adjustedBalanceDue : invoice.balanceDue)}`
                ).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*CONTACT INFORMATION*
────────────────────────────────
🏢 *PR FABRICS*
📍 Tirupur
📞 *Phone: 9952520181*

_This is an automated statement. Please contact us for any queries._`;

        // Open WhatsApp with the message
        openWhatsApp(customerPhone, message);

    } catch (error) {
        console.error('Error sharing combined statement:', error);
        alert('Error sharing statement. Please try again.');
    }
}


// Share individual invoice via WhatsApp
async function shareInvoiceViaWhatsApp(invoiceNo) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);

        if (!invoiceData) {
            alert('Invoice not found!');
            return;
        }

        // Calculate previous balance and returns
        const previousBalance = invoiceData.grandTotal - invoiceData.subtotal;
        const totalReturns = await Utils.calculateTotalReturns(invoiceNo);
        const adjustedBalanceDue = invoiceData.balanceDue - totalReturns;

        // Get detailed return information
        const returns = await db.getReturnsByInvoice(invoiceNo);

        // Build payment breakdown message
        let paymentBreakdownMessage = '';
        if (invoiceData.paymentBreakdown) {
            const paymentMethods = [];
            if (invoiceData.paymentBreakdown.cash > 0) paymentMethods.push(`💵 Cash: ₹${Utils.formatCurrency(invoiceData.paymentBreakdown.cash)}`);
            if (invoiceData.paymentBreakdown.upi > 0) paymentMethods.push(`📱 UPI: ₹${Utils.formatCurrency(invoiceData.paymentBreakdown.upi)}`);
            if (invoiceData.paymentBreakdown.account > 0) paymentMethods.push(`🏦 Account: ₹${Utils.formatCurrency(invoiceData.paymentBreakdown.account)}`);

            if (paymentMethods.length > 0) {
                paymentBreakdownMessage = `\n💳 ${paymentMethods.join(' | ')}`;
            }
        }

        // Create WhatsApp message with professional formatting
        const message = `*PR FABRICS - INVOICE STATEMENT*
*GSTIN: 33CLJPG4331G1ZG*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*INVOICE DETAILS*
────────────────────────────────
📄 Invoice #: ${invoiceData.invoiceNo}
📅 Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}
👤 Customer: ${invoiceData.customerName}
📍 Address: ${invoiceData.customerAddress || 'Not specified'}
📞 Phone: ${invoiceData.customerPhone || 'Not specified'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*PRODUCT DETAILS*
────────────────────────────────
${invoiceData.products.map((product, index) =>
            `   ${index + 1}. ${product.description}
      Qty: ${product.qty} × Rate: ₹${Utils.formatCurrency(product.rate)}
      Amount: ₹${Utils.formatCurrency(product.amount)}`
        ).join('\n\n')}

${totalReturns > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*RETURN DETAILS*
────────────────────────────────
${returns.map((returnItem, index) =>
            `   ${index + 1}. ${returnItem.description}
      Qty: ${returnItem.qty} × Rate: ₹${Utils.formatCurrency(returnItem.rate)}
      Amount: -₹${Utils.formatCurrency(returnItem.returnAmount)}${returnItem.reason ? `\n      Reason: ${returnItem.reason}` : ''}`
        ).join('\n\n')}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*ACCOUNT SUMMARY*
────────────────────────────────
💰 Current Bill Amount: ₹${Utils.formatCurrency(invoiceData.subtotal)}
${previousBalance > 0 ? `📊 Previous Balance: ₹${Utils.formatCurrency(previousBalance)}` : ''}
💳 Total Amount: ₹${Utils.formatCurrency(invoiceData.grandTotal)}
✅ Amount Paid: ₹${Utils.formatCurrency(invoiceData.amountPaid)}${paymentBreakdownMessage}
${totalReturns > 0 ? `🔄 Return Amount: -₹${Utils.formatCurrency(totalReturns)}` : ''}

${totalReturns > 0 ?
                `✅ *ADJUSTED BALANCE DUE: ₹${Utils.formatCurrency(adjustedBalanceDue)}*` :
                `✅ *BALANCE DUE: ₹${Utils.formatCurrency(invoiceData.balanceDue)}*`}

${totalReturns > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*RETURN SUMMARY*
────────────────────────────────
📦 Total Return Amount: ₹${Utils.formatCurrency(totalReturns)}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*CONTACT INFORMATION*
────────────────────────────────
🏢 *PR FABRICS*
📍 Tirupur
📞 *Phone: 9952520181*

_This is an automated invoice statement. Please contact us for any queries._`;

        // Open WhatsApp with the message
        openWhatsApp(invoiceData.customerPhone, message);

    } catch (error) {
        console.error('Error sharing invoice:', error);
        alert('Error sharing invoice. Please try again.');
    }
}



// One-click solution with automatic clipboard
function openWhatsApp(phoneNumber, message) {
    // Clean phone number and add country code for India
    let cleanPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : '';

    // Add country code if missing
    if (cleanPhone && !cleanPhone.startsWith('91')) {
        // Remove leading 0 if present and add country code
        cleanPhone = cleanPhone.replace(/^0+/, '');
        if (!cleanPhone.startsWith('91')) {
            cleanPhone = '91' + cleanPhone;
        }
    }

    if (!cleanPhone) {
        alert('Customer phone number not found. Please check customer details.');
        return;
    }

    // Validate phone number length (should be 12 digits: 91 + 10 digit number)
    if (cleanPhone.length !== 12) {
        alert(`Invalid phone number format. Please ensure it's a 10-digit Indian number. Current: ${cleanPhone}`);
        return;
    }

    // Always copy to clipboard first
    copyToClipboard(message);

    // Then open WhatsApp
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    const newWindow = window.open(whatsappUrl, '_blank');

    if (!newWindow) {
        alert('Message copied to clipboard! Popup was blocked - please open WhatsApp manually and paste the message.');
    } else {
        setTimeout(() => {
            alert('Message copied to clipboard! If not auto-pasted in WhatsApp, click in chat and press Ctrl+V (Windows) or Cmd+V (Mac).');
        }, 1000);
    }
}

// Enhanced clipboard function
function copyToClipboard(text) {
    return new Promise((resolve, reject) => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(resolve).catch(reject);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                resolve();
            } catch (err) {
                reject(err);
            }
            document.body.removeChild(textArea);
        }
    });
}

// Clear filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('fromInvoiceNo').value = '';
    document.getElementById('toInvoiceNo').value = '';
    loadInvoices();
}

// Edit invoice
function editInvoice(invoiceNo) {
    window.location.href = `index.html?edit=${invoiceNo}`;
}

// View invoice
function viewInvoice(invoiceNo) {
    // In a real application, you might have a dedicated view page
    // For now, we'll redirect to the main page with edit parameter
    editInvoice(invoiceNo);
}

// Generate PDF for a specific invoice
async function generateInvoicePDF(invoiceNo) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        if (invoiceData) {
            // Temporarily set form data to generate PDF
            const originalData = Utils.getFormData();
            Utils.setFormData(invoiceData);

            // Generate PDF
            await PDFGenerator.generatePDF();

            // Restore original form data
            Utils.setFormData(originalData);
        } else {
            alert('Invoice not found!');
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF.');
    }
}

// Add payment to an invoice with multiple payment methods
async function addPayment(invoiceNo) {
    // Create a custom dialog for payment input with multiple payment methods
    const paymentDialog = document.createElement('div');
    paymentDialog.className = 'payment-dialog-overlay';
    paymentDialog.innerHTML = `
        <div class="payment-dialog">
            <h3>Add Payment - Invoice #${invoiceNo}</h3>
            <div class="payment-form">
                <div style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin: 8px 0; padding: 8px 12px; background: white; border-radius: 6px; border: 1px solid #e9ecef; border-left: 3px solid #28a745;">
                        <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #495057; font-size: 13px; min-width: 100px;">
                            <i class="fas fa-money-bill-wave" style="width: 16px; text-align: center; color: #6c757d;"></i>
                            CASH:
                        </div>
                        <input type="number" id="cashPayment" step="0.01" min="0" placeholder="0.00" value="0" style="width: 120px; padding: 6px 8px; border: 1px solid #ced4da; border-radius: 4px; text-align: right; font-size: 13px;">
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin: 8px 0; padding: 8px 12px; background: white; border-radius: 6px; border: 1px solid #e9ecef; border-left: 3px solid #007bff;">
                        <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #495057; font-size: 13px; min-width: 100px;">
                            <i class="fas fa-mobile-alt" style="width: 16px; text-align: center; color: #6c757d;"></i>
                            UPI:
                        </div>
                        <input type="number" id="upiPayment" step="0.01" min="0" placeholder="0.00" value="0" style="width: 120px; padding: 6px 8px; border: 1px solid #ced4da; border-radius: 4px; text-align: right; font-size: 13px;">
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin: 8px 0; padding: 8px 12px; background: white; border-radius: 6px; border: 1px solid #e9ecef; border-left: 3px solid #6f42c1;">
                        <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #495057; font-size: 13px; min-width: 100px;">
                            <i class="fas fa-university" style="width: 16px; text-align: center; color: #6c757d;"></i>
                            ACCOUNT:
                        </div>
                        <input type="number" id="accountPayment" step="0.01" min="0" placeholder="0.00" value="0" style="width: 120px; padding: 6px 8px; border: 1px solid #ced4da; border-radius: 4px; text-align: right; font-size: 13px;">
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding: 10px 12px; background: #e7f3ff; border-radius: 6px; border: 1px solid #b3d9ff; font-weight: bold; font-size: 14px;">
                        <label style="color: #2c3e50;">Total Payment:</label>
                        <span id="totalPaymentAmount" style="color: #007bff; font-size: 15px;">₹0.00</span>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="paymentDate">Payment Date:</label>
                    <input type="date" id="paymentDate" value="${new Date().toISOString().split('T')[0]}">
                </div>
                
                <div class="payment-dialog-actions">
                    <button id="confirmPayment" class="btn-confirm">Add Payment</button>
                    <button id="cancelPayment" class="btn-cancel">Cancel</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(paymentDialog);

    // Add focus styles to inputs
    const paymentInputs = paymentDialog.querySelectorAll('input[type="number"]');
    paymentInputs.forEach(input => {
        input.addEventListener('focus', function () {
            this.style.borderColor = '#007bff';
            this.style.boxShadow = '0 0 0 2px rgba(0, 123, 255, 0.25)';
        });
        input.addEventListener('blur', function () {
            this.style.borderColor = '#ced4da';
            this.style.boxShadow = 'none';
        });
    });

    // Add event listeners for payment inputs to update total
    const updateTotalPayment = () => {
        const cash = parseFloat(document.getElementById('cashPayment').value) || 0;
        const upi = parseFloat(document.getElementById('upiPayment').value) || 0;
        const account = parseFloat(document.getElementById('accountPayment').value) || 0;
        const total = cash + upi + account;
        document.getElementById('totalPaymentAmount').textContent = `₹${Utils.formatCurrency(total)}`;
    };

    document.getElementById('cashPayment').addEventListener('input', updateTotalPayment);
    document.getElementById('upiPayment').addEventListener('input', updateTotalPayment);
    document.getElementById('accountPayment').addEventListener('input', updateTotalPayment);

    // Focus on first payment input
    setTimeout(() => {
        document.getElementById('cashPayment').focus();
    }, 100);

    // Return a promise to handle the payment
    return new Promise((resolve) => {
        document.getElementById('confirmPayment').addEventListener('click', async function () {
            const cashAmount = parseFloat(document.getElementById('cashPayment').value) || 0;
            const upiAmount = parseFloat(document.getElementById('upiPayment').value) || 0;
            const accountAmount = parseFloat(document.getElementById('accountPayment').value) || 0;
            const paymentDate = document.getElementById('paymentDate').value;

            const totalPayment = cashAmount + upiAmount + accountAmount;

            if (totalPayment <= 0) {
                alert('Please enter a valid payment amount in at least one payment method.');
                return;
            }

            if (!paymentDate) {
                alert('Please select a payment date.');
                return;
            }

            try {
                const invoiceData = await db.getInvoice(invoiceNo);
                if (invoiceData) {
                    // Update invoice payment breakdown
                    const currentPaymentBreakdown = invoiceData.paymentBreakdown || {
                        cash: 0,
                        upi: 0,
                        account: 0
                    };

                    // Add new payments to existing breakdown
                    const updatedPaymentBreakdown = {
                        cash: currentPaymentBreakdown.cash + cashAmount,
                        upi: currentPaymentBreakdown.upi + upiAmount,
                        account: currentPaymentBreakdown.account + accountAmount
                    };

                    // Update invoice totals
                    const newAmountPaid = invoiceData.amountPaid + totalPayment;
                    invoiceData.amountPaid = newAmountPaid;
                    invoiceData.balanceDue = invoiceData.grandTotal - newAmountPaid;
                    invoiceData.paymentBreakdown = updatedPaymentBreakdown;

                    await db.saveInvoice(invoiceData);

                    // Save individual payment records
                    if (cashAmount > 0) {
                        const cashPaymentData = {
                            invoiceNo: invoiceNo,
                            paymentDate: paymentDate,
                            amount: cashAmount,
                            paymentMethod: 'cash',
                            paymentType: 'additional'
                        };
                        await db.savePayment(cashPaymentData);
                    }

                    if (upiAmount > 0) {
                        const upiPaymentData = {
                            invoiceNo: invoiceNo,
                            paymentDate: paymentDate,
                            amount: upiAmount,
                            paymentMethod: 'gpay',
                            paymentType: 'additional'
                        };
                        await db.savePayment(upiPaymentData);
                    }

                    if (accountAmount > 0) {
                        const accountPaymentData = {
                            invoiceNo: invoiceNo,
                            paymentDate: paymentDate,
                            amount: accountAmount,
                            paymentMethod: 'account',
                            paymentType: 'additional'
                        };
                        await db.savePayment(accountPaymentData);
                    }

                    // Update all subsequent invoices
                    await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

                    document.body.removeChild(paymentDialog);

                    // Show success message with payment breakdown
                    let successMessage = `Payment of ₹${Utils.formatCurrency(totalPayment)} added successfully!`;
                    const paymentMethods = [];
                    if (cashAmount > 0) paymentMethods.push(`Cash: ₹${Utils.formatCurrency(cashAmount)}`);
                    if (upiAmount > 0) paymentMethods.push(`UPI: ₹${Utils.formatCurrency(upiAmount)}`);
                    if (accountAmount > 0) paymentMethods.push(`Account: ₹${Utils.formatCurrency(accountAmount)}`);

                    if (paymentMethods.length > 0) {
                        successMessage += `\nBreakdown: ${paymentMethods.join(', ')}`;
                    }

                    alert(successMessage);
                    loadInvoices(); // Refresh the list
                    resolve(true);
                } else {
                    alert('Invoice not found!');
                    resolve(false);
                }
            } catch (error) {
                console.error('Error adding payment:', error);
                alert('Error adding payment.');
                resolve(false);
            }
        });

        document.getElementById('cancelPayment').addEventListener('click', function () {
            document.body.removeChild(paymentDialog);
            resolve(false);
        });

        // Close on overlay click
        paymentDialog.addEventListener('click', function (e) {
            if (e.target === paymentDialog) {
                document.body.removeChild(paymentDialog);
                resolve(false);
            }
        });
    });
}

// Generate statement for an invoice with PDF download
async function generateStatement(invoiceNo) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        const payments = await db.getPaymentsByInvoice(invoiceNo);

        if (invoiceData) {
            await generatePDFStatement(invoiceData, payments);
        } else {
            alert('Invoice not found!');
        }
    } catch (error) {
        console.error('Error generating statement:', error);
        alert('Error generating statement.');
    }
}



// Add these new functions to invoice-history.js

// View payment history with undo option
async function viewPaymentHistory(invoiceNo) {
    try {
        const payments = await db.getPaymentsByInvoice(invoiceNo);
        const invoiceData = await db.getInvoice(invoiceNo);

        if (payments.length === 0) {
            alert('No payment records found for this invoice.');
            return;
        }

        const paymentHistoryHTML = `
            <div class="payment-history-dialog">
                <div class="payment-history-header">
                    <h3>Payment History - Invoice #${invoiceNo}</h3>
                    <button class="close-payment-history">&times;</button>
                </div>
                <div class="payment-history-content">
                    <div class="customer-info">
                        <h4>${invoiceData.customerName}</h4>
                        <p>Total Payments: ${payments.length}</p>
                        <p>Current Balance Due: ₹${Utils.formatCurrency(invoiceData.balanceDue)}</p>
                    </div>
                    
                    <div class="payments-list">
                        ${payments.map((payment, index) => `
                            <div class="payment-record" data-payment-id="${payment.id}">
                                <div class="payment-record-header">
                                    <strong>Payment #${index + 1}</strong>
                                    <span class="payment-date">${new Date(payment.paymentDate).toLocaleDateString('en-IN')}</span>
                                </div>
                                <div class="payment-details">
                                    <p><strong>Amount:</strong> ₹${Utils.formatCurrency(payment.amount)}</p>
                                    <p><strong>Method:</strong> ${payment.paymentMethod ? payment.paymentMethod.toUpperCase() : 'CASH'}</p>
                                    <p><strong>Type:</strong> ${payment.paymentType === 'initial' ? 'Initial Payment' : 'Additional Payment'}</p>
                                    <p><strong>Date:</strong> ${new Date(payment.paymentDate).toLocaleString('en-IN')}</p>
                                </div>
                                <div class="payment-actions">
                                    <button class="btn-undo-payment" onclick="undoPayment(${payment.id}, '${invoiceNo}')">
                                        <i class="fas fa-undo"></i> Undo This Payment
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div class="payment-total">
                        <strong>Total Amount Paid: ₹${Utils.formatCurrency(payments.reduce((sum, payment) => sum + payment.amount, 0))}</strong>
                    </div>
                    
                    <div class="bulk-actions">
                        <button class="btn-undo-all-payments" onclick="undoAllPayments('${invoiceNo}')">
                            <i class="fas fa-trash-restore"></i> Undo All Payments for This Invoice
                        </button>
                    </div>
                </div>
            </div>
        `;

        const paymentHistoryDialog = document.createElement('div');
        paymentHistoryDialog.className = 'payment-history-overlay';
        paymentHistoryDialog.innerHTML = paymentHistoryHTML;

        document.body.appendChild(paymentHistoryDialog);

        paymentHistoryDialog.querySelector('.close-payment-history').addEventListener('click', () => {
            document.body.removeChild(paymentHistoryDialog);
        });

        paymentHistoryDialog.addEventListener('click', (e) => {
            if (e.target === paymentHistoryDialog) {
                document.body.removeChild(paymentHistoryDialog);
            }
        });

    } catch (error) {
        console.error('Error viewing payment history:', error);
        alert('Error loading payment history.');
    }
}

// Undo a specific payment
async function undoPayment(paymentId, invoiceNo) {
    if (!confirm('Are you sure you want to undo this payment? This will add the payment amount back to the balance due.')) {
        return;
    }

    try {
        // Get payment details before deleting
        const payments = await db.getPaymentsByInvoice(invoiceNo);
        const paymentToDelete = payments.find(p => p.id === paymentId);

        if (!paymentToDelete) {
            alert('Payment not found!');
            return;
        }

        // Get invoice data
        const invoiceData = await db.getInvoice(invoiceNo);

        // Delete the payment record
        await db.deletePayment(paymentId);

        // Recalculate invoice totals
        const remainingPayments = await db.getPaymentsByInvoice(invoiceNo);
        const totalPaid = remainingPayments.reduce((sum, payment) => sum + payment.amount, 0);

        // Update payment breakdown
        let updatedPaymentBreakdown = { ...invoiceData.paymentBreakdown };
        if (updatedPaymentBreakdown) {
            const paymentMethod = paymentToDelete.paymentMethod || 'cash';
            updatedPaymentBreakdown[paymentMethod] = Math.max(0, (updatedPaymentBreakdown[paymentMethod] || 0) - paymentToDelete.amount);
        }

        // Update invoice
        invoiceData.amountPaid = totalPaid;
        invoiceData.balanceDue = invoiceData.grandTotal - totalPaid;
        invoiceData.paymentBreakdown = updatedPaymentBreakdown;

        await db.saveInvoice(invoiceData);

        // Update all subsequent invoices
        await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

        alert(`Payment of ₹${Utils.formatCurrency(paymentToDelete.amount)} has been successfully undone!`);

        // Close the dialog and refresh the display
        const paymentHistoryDialog = document.querySelector('.payment-history-overlay');
        if (paymentHistoryDialog) {
            document.body.removeChild(paymentHistoryDialog);
        }

        // Refresh the invoices list
        loadInvoices();

    } catch (error) {
        console.error('Error undoing payment:', error);
        alert('Error undoing payment. Please try again.');
    }
}

// Undo all payments for an invoice
async function undoAllPayments(invoiceNo) {
    if (!confirm('Are you sure you want to undo ALL payments for this invoice? This will set the balance due back to the original invoice amount.')) {
        return;
    }

    try {
        const payments = await db.getPaymentsByInvoice(invoiceNo);

        if (payments.length === 0) {
            alert('No payments found for this invoice.');
            return;
        }

        // Get invoice data
        const invoiceData = await db.getInvoice(invoiceNo);
        const totalPaymentAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);

        // Delete all payment records
        for (const payment of payments) {
            await db.deletePayment(payment.id);
        }

        // Reset invoice payment information
        invoiceData.amountPaid = 0;
        invoiceData.balanceDue = invoiceData.grandTotal;
        invoiceData.paymentBreakdown = {
            cash: 0,
            upi: 0,
            account: 0
        };

        await db.saveInvoice(invoiceData);

        // Update all subsequent invoices
        await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

        alert(`All ${payments.length} payments (total: ₹${Utils.formatCurrency(totalPaymentAmount)}) have been successfully undone!`);

        // Close the dialog and refresh the display
        const paymentHistoryDialog = document.querySelector('.payment-history-overlay');
        if (paymentHistoryDialog) {
            document.body.removeChild(paymentHistoryDialog);
        }

        // Refresh the invoices list
        loadInvoices();

    } catch (error) {
        console.error('Error undoing all payments:', error);
        alert('Error undoing payments. Please try again.');
    }
}

// Delete payment record from database
async function deletePayment(paymentId) {
    return new Promise((resolve, reject) => {
        const transaction = db.db.transaction(['payments'], 'readwrite');
        const store = transaction.objectStore('payments');
        const request = store.delete(paymentId);

        request.onsuccess = () => {
            console.log('Payment deleted successfully');
            resolve();
        };

        request.onerror = () => {
            console.error('Error deleting payment');
            reject(request.error);
        };
    });
}



// Generate PDF statement with organized file naming - SIMPLE & PROFESSIONAL
async function generatePDFStatement(invoiceData, payments) {
    try {
        // Calculate returns for this invoice
        const totalReturns = await Utils.calculateTotalReturns(invoiceData.invoiceNo);
        const adjustedBalanceDue = invoiceData.balanceDue - totalReturns;

        // Create PDF document
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        // Set initial y position
        let yPos = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);

        // Simple color scheme
        const primaryColor = [0, 0, 0]; // Black
        const accentColor = [0, 100, 0]; // Dark Green
        const grayColor = [100, 100, 100]; // Gray

        // HEADER
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('PR FABRICS', pageWidth / 2, yPos, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text('42/65, THIRUNEELAKANDA PURAM, 1ST STREET, TIRUPUR 641-602', pageWidth / 2, yPos + 5, { align: 'center' });
        doc.text('Cell: 9952520181 | GSTIN: 33CLJPG4331G1ZG', pageWidth / 2, yPos + 10, { align: 'center' });

        yPos += 20;

        // TITLE
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('ACCOUNT STATEMENT', pageWidth / 2, yPos, { align: 'center' });

        // Underline
        doc.setDrawColor(...accentColor);
        doc.setLineWidth(0.5);
        doc.line(pageWidth / 2 - 40, yPos + 2, pageWidth / 2 + 40, yPos + 2);

        yPos += 15;

        // STATEMENT INFORMATION
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('STATEMENT INFORMATION', margin, yPos);
        yPos += 7;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);

        doc.text(`Statement Date: ${new Date().toLocaleDateString('en-IN')}`, margin, yPos);
        yPos += 4;
        doc.text(`Statement Period: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')} to ${new Date().toLocaleDateString('en-IN')}`, margin, yPos);
        yPos += 10;

        // CUSTOMER INFORMATION
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('CUSTOMER INFORMATION', margin, yPos);
        yPos += 7;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);

        doc.text(`Name: ${invoiceData.customerName}`, margin, yPos);
        yPos += 4;
        doc.text(`Invoice No: ${invoiceData.invoiceNo}`, margin, yPos);
        yPos += 4;
        doc.text(`Address: ${invoiceData.customerAddress || 'Not specified'}`, margin, yPos);
        yPos += 4;
        doc.text(`Phone: ${invoiceData.customerPhone || 'Not specified'}`, margin, yPos);
        yPos += 4;
        doc.text(`Invoice Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}`, margin, yPos);
        yPos += 10;

        // Check if we need a new page
        if (yPos > 240) {
            doc.addPage();
            yPos = 20;
        }

        // INVOICE DETAILS
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('INVOICE DETAILS', margin, yPos);
        yPos += 6;

        // Simple underline
        doc.setDrawColor(...grayColor);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, margin + 40, yPos);
        yPos += 8;

        // Create invoice details table
        const invoiceTableHeaders = [['S.No.', 'Description', 'Qty', 'Rate', 'Amount']];
        const invoiceTableData = invoiceData.products.map((product, index) => [
            (index + 1).toString(),
            product.description,
            product.qty.toString(),
            Utils.formatCurrency(product.rate),
            Utils.formatCurrency(product.amount)
        ]);

        doc.autoTable({
            startY: yPos,
            head: invoiceTableHeaders,
            body: invoiceTableData,
            theme: 'grid',
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: primaryColor,
                fontStyle: 'bold',
                fontSize: 8,
                cellPadding: 3,
                lineWidth: 0.3
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: 2,
                lineColor: [220, 220, 220],
                lineWidth: 0.1
            },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 'auto', halign: 'left' },
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 20, halign: 'right' },
                4: { cellWidth: 22, halign: 'right' }
            },
            margin: { left: margin, right: margin },
            styles: {
                lineColor: [200, 200, 200],
                lineWidth: 0.2
            }
        });

        yPos = doc.lastAutoTable.finalY + 10;

        // Check if we need a new page
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }

        // INVOICE SUMMARY
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('INVOICE SUMMARY', margin, yPos);
        yPos += 7;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);

        let summaryY = yPos;

        // Current Bill Amount
        doc.text('Current Bill Amount:', margin, summaryY);
        doc.text(`₹${Utils.formatCurrency(invoiceData.subtotal)}`, pageWidth - margin, summaryY, { align: 'right' });
        summaryY += 4;

        // Previous Balance
        const previousBalance = invoiceData.grandTotal - invoiceData.subtotal;
        if (previousBalance > 0) {
            doc.text('Previous Balance:', margin, summaryY);
            doc.text(`₹${Utils.formatCurrency(previousBalance)}`, pageWidth - margin, summaryY, { align: 'right' });
            summaryY += 4;
        }

        // Total Amount
        doc.setFont('helvetica', 'bold');
        doc.text('Total Amount:', margin, summaryY);
        doc.text(`₹${Utils.formatCurrency(invoiceData.grandTotal)}`, pageWidth - margin, summaryY, { align: 'right' });
        summaryY += 4;

        // Amount Paid
        doc.setFont('helvetica', 'normal');
        doc.text('Amount Paid:', margin, summaryY);
        doc.text(`₹${Utils.formatCurrency(invoiceData.amountPaid)}`, pageWidth - margin, summaryY, { align: 'right' });
        summaryY += 4;

        // Returns (if any)
        if (totalReturns > 0) {
            doc.text('Returns:', margin, summaryY);
            doc.text(`-₹${Utils.formatCurrency(totalReturns)}`, pageWidth - margin, summaryY, { align: 'right' });
            summaryY += 4;
        }

        // Balance Due
        doc.setFont('helvetica', 'bold');
        if (totalReturns > 0) {
            doc.text('Adjusted Balance Due:', margin, summaryY);
            doc.text(`₹${Utils.formatCurrency(adjustedBalanceDue)}`, pageWidth - margin, summaryY, { align: 'right' });
        } else {
            doc.text('Balance Due:', margin, summaryY);
            doc.text(`₹${Utils.formatCurrency(invoiceData.balanceDue)}`, pageWidth - margin, summaryY, { align: 'right' });
        }

        yPos = summaryY + 12;

        // Add return information if applicable
        if (totalReturns > 0) {
            // Check if we need a new page
            if (yPos > 220) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text('RETURN INFORMATION', margin, yPos);
            yPos += 7;

            // Get return details
            const returns = await db.getReturnsByInvoice(invoiceData.invoiceNo);

            if (returns.length > 0) {
                const returnTableHeaders = [['Date', 'Product', 'Qty', 'Rate', 'Amount']];
                const returnTableData = returns.map((returnItem, index) => [
                    new Date(returnItem.returnDate).toLocaleDateString('en-IN'),
                    returnItem.description,
                    returnItem.qty.toString(),
                    Utils.formatCurrency(returnItem.rate),
                    Utils.formatCurrency(returnItem.returnAmount)
                ]);

                doc.autoTable({
                    startY: yPos,
                    head: returnTableHeaders,
                    body: returnTableData,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [240, 240, 240],
                        textColor: primaryColor,
                        fontStyle: 'bold',
                        fontSize: 8,
                        cellPadding: 3
                    },
                    bodyStyles: {
                        fontSize: 7,
                        cellPadding: 2,
                        lineColor: [220, 220, 220],
                        lineWidth: 0.1
                    },
                    columnStyles: {
                        0: { cellWidth: 22, halign: 'center' },
                        1: { cellWidth: 'auto', halign: 'left' },
                        2: { cellWidth: 15, halign: 'center' },
                        3: { cellWidth: 20, halign: 'right' },
                        4: { cellWidth: 22, halign: 'right' }
                    },
                    margin: { left: margin, right: margin }
                });

                yPos = doc.lastAutoTable.finalY + 10;
            }
        }

        // Check if we need a new page for payment history
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }

        // PAYMENT HISTORY
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('PAYMENT HISTORY', margin, yPos);
        yPos += 7;

        // Create payment history table
        const paymentTableHeaders = [['Date', 'Description', 'Amount', 'Balance']];
        const paymentTableData = generatePaymentTableData(payments, invoiceData.grandTotal, totalReturns);

        doc.autoTable({
            startY: yPos,
            head: paymentTableHeaders,
            body: paymentTableData,
            theme: 'grid',
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: primaryColor,
                fontStyle: 'bold',
                fontSize: 8,
                cellPadding: 3
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: 2,
                lineColor: [220, 220, 220],
                lineWidth: 0.1
            },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 'auto', halign: 'left' },
                2: { cellWidth: 25, halign: 'right' },
                3: { cellWidth: 25, halign: 'right' }
            },
            margin: { left: margin, right: margin }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Check if we need a new page for account summary
        if (yPos > 180) {
            doc.addPage();
            yPos = 20;
        }

        // ACCOUNT SUMMARY
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('ACCOUNT SUMMARY', pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;

        // Underline for summary title
        doc.setDrawColor(...accentColor);
        doc.setLineWidth(0.5);
        doc.line(pageWidth / 2 - 30, yPos, pageWidth / 2 + 30, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);

        // Invoice Amount
        doc.text('Invoice Amount:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(invoiceData.grandTotal)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 6;

        // Total Paid
        doc.text('Total Paid:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(invoiceData.amountPaid)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 6;

        // Return Amount (if applicable)
        if (totalReturns > 0) {
            doc.text('Return Amount:', margin, yPos);
            doc.text(`-₹${Utils.formatCurrency(totalReturns)}`, pageWidth - margin, yPos, { align: 'right' });
            yPos += 6;
        }

        // Separator line before final balance
        doc.setDrawColor(...grayColor);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 6;

        // Outstanding Balance
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        if (totalReturns > 0) {
            doc.setTextColor(...accentColor);
            doc.text('ADJUSTED BALANCE DUE:', margin, yPos);
            doc.text(`₹${Utils.formatCurrency(adjustedBalanceDue)}`, pageWidth - margin, yPos, { align: 'right' });
        } else {
            doc.setTextColor(...primaryColor);
            doc.text('OUTSTANDING BALANCE:', margin, yPos);
            doc.text(`₹${Utils.formatCurrency(invoiceData.balanceDue)}`, pageWidth - margin, yPos, { align: 'right' });
        }

        // FOOTER
        yPos = pageHeight - 20;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text('This is a computer-generated statement. No signature is required.', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text('For any queries, please contact: 9952520181', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, yPos, { align: 'center' });

        // Generate filename and save
        const today = new Date();
        const dateFolder = today.toISOString().split('T')[0];
        const fileName = `Statement_${invoiceData.invoiceNo}_${invoiceData.customerName}_${dateFolder}.pdf`;

        doc.save(fileName);

        setTimeout(() => {
            alert(`Statement saved as: ${fileName}`);
        }, 500);

    } catch (error) {
        console.error('Error generating PDF statement:', error);
        throw error;
    }
}



// In the payment table data generation, update to include returns
function generatePaymentTableData(payments, grandTotal, totalReturns = 0) {
    const tableData = [];
    let runningBalance = grandTotal;

    // Sort payments by date
    payments.sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate));

    // Add initial invoice row
    tableData.push([
        new Date().toLocaleDateString('en-IN'),
        'Invoice - Goods/Services',
        Utils.formatCurrency(grandTotal),
        Utils.formatCurrency(runningBalance)
    ]);

    // Add payment rows
    payments.forEach(payment => {
        runningBalance -= payment.amount;
        tableData.push([
            new Date(payment.paymentDate).toLocaleDateString('en-IN'),
            `Payment - ${payment.paymentType === 'initial' ? 'Initial' : 'Additional'} (${payment.paymentMethod?.toUpperCase() || 'CASH'})`,
            `-${Utils.formatCurrency(payment.amount)}`,
            Utils.formatCurrency(runningBalance)
        ]);
    });

    // Add return row if applicable
    if (totalReturns > 0) {
        runningBalance -= totalReturns;
        tableData.push([
            'Multiple Dates',
            'Product Returns',
            `-${Utils.formatCurrency(totalReturns)}`,
            Utils.formatCurrency(runningBalance)
        ]);
    }

    return tableData;
}

// Add Return to an invoice - UPDATED to show current adjusted balance
// SIMPLER SOLUTION: Store products in dialog dataset
async function addReturn(invoiceNo) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        if (!invoiceData) {
            alert('Invoice not found!');
            return;
        }

        // Calculate current returns to get adjusted balance
        const totalReturns = await Utils.calculateTotalReturns(invoiceNo);
        const currentAdjustedBalance = invoiceData.balanceDue - totalReturns;

        // Create return dialog
        const returnDialog = document.createElement('div');
        returnDialog.className = 'return-dialog-overlay';
        returnDialog.innerHTML = `
            <div class="return-dialog" data-products='${JSON.stringify(invoiceData.products || [])}'>
                <div class="return-dialog-header">
                    <h3>Process Return - Invoice #${invoiceNo}</h3>
                    <button class="close-return-dialog">&times;</button>
                </div>
                
                <div class="return-customer-info">
                    <h4>Customer: ${invoiceData.customerName}</h4>
                    <p>Invoice Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}</p>
                    ${totalReturns > 0 ? `<p style="color: #dc3545; font-weight: bold;">Previous Returns: ₹${Utils.formatCurrency(totalReturns)}</p>` : ''}
                </div>

                <div class="return-form-section">
                    <div class="form-group">
                        <label for="returnDate">Return Date:</label>
                        <input type="date" id="returnDate" value="${new Date().toISOString().split('T')[0]}">
                    </div>

                    <div class="return-products-section">
                        <h4>Return Products</h4>
                        <div class="return-products-list" id="returnProductsList">
                            <!-- Return items will be added here -->
                        </div>
                        <button type="button" class="btn-add-return-item" onclick="addReturnItemFromDialog()">
                            <i class="fas fa-plus"></i> Add Return Item
                        </button>
                    </div>

                    <div class="return-summary">
                        <div class="summary-item">
                            <span>Original Balance Due:</span>
                            <span>₹${Utils.formatCurrency(invoiceData.balanceDue)}</span>
                        </div>
                        ${totalReturns > 0 ? `
                        <div class="summary-item">
                            <span>Previous Returns:</span>
                            <span style="color: #dc3545;">-₹${Utils.formatCurrency(totalReturns)}</span>
                        </div>
                        <div class="summary-item">
                            <span>Current Balance Before This Return:</span>
                            <span>₹${Utils.formatCurrency(currentAdjustedBalance)}</span>
                        </div>
                        ` : ''}
                        <div class="summary-item">
                            <span>This Return Amount:</span>
                            <span id="totalReturnAmount">₹0.00</span>
                        </div>
                        <div class="summary-item total">
                            <span>New Adjusted Balance Due:</span>
                            <span id="adjustedBalanceDue">₹${Utils.formatCurrency(currentAdjustedBalance)}</span>
                        </div>
                    </div>

                    <div class="return-dialog-actions">
                        <button type="button" class="btn-save-return" onclick="saveReturn('${invoiceNo}')">
                            <i class="fas fa-save"></i> Save Return
                        </button>
                        <button type="button" class="btn-view-return-status" onclick="viewReturnStatus('${invoiceNo}')">
                            <i class="fas fa-history"></i> View Return Status
                        </button>
                        <button type="button" class="btn-cancel-return">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(returnDialog);

        // Store the current adjusted balance in a data attribute for calculations
        returnDialog.querySelector('.return-dialog').dataset.currentBalance = currentAdjustedBalance;

        // Initialize with one return item
        addReturnItemFromDialog();

        // Event listeners
        returnDialog.querySelector('.close-return-dialog').addEventListener('click', () => {
            document.body.removeChild(returnDialog);
        });

        returnDialog.querySelector('.btn-cancel-return').addEventListener('click', () => {
            document.body.removeChild(returnDialog);
        });

        returnDialog.addEventListener('click', (e) => {
            if (e.target === returnDialog) {
                document.body.removeChild(returnDialog);
            }
        });

    } catch (error) {
        console.error('Error opening return dialog:', error);
        alert('Error processing return.');
    }
}

// Simple function to add return item using products from dialog dataset
function addReturnItemFromDialog() {
    const returnDialog = document.querySelector('.return-dialog');
    if (!returnDialog) return;

    const productsData = returnDialog.dataset.products;
    const originalProducts = productsData ? JSON.parse(productsData) : [];

    addReturnItem(originalProducts);
}


// Add return item row
function addReturnItem(originalProducts = []) {
    const returnProductsList = document.getElementById('returnProductsList');
    const itemIndex = returnProductsList.children.length;

    const returnItemHTML = `
        <div class="return-item" data-index="${itemIndex}">
            <div class="return-item-header">
                <span>Return Item ${itemIndex + 1}</span>
                <button type="button" class="btn-remove-return-item" onclick="removeReturnItem(${itemIndex})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="return-item-fields">
                <div class="form-group">
                    <label for="productDescription${itemIndex}">Product Description:</label>
                    <select id="productDescription${itemIndex}" class="product-description-select" onchange="updateReturnProductInfo(${itemIndex})">
                        <option value="">-- Select from invoice or enter custom --</option>
                        ${originalProducts.map(product =>
        `<option value="${product.description}" data-rate="${product.rate}" data-maxqty="${product.qty}">
                                ${product.description} (Available: ${product.qty} @ ₹${Utils.formatCurrency(product.rate)})
                            </option>`
    ).join('')}
                        <option value="custom">-- Enter Custom Product --</option>
                    </select>
                    <input type="text" id="customProduct${itemIndex}" class="custom-product-input" placeholder="Enter custom product description" style="display: none;">
                </div>

                <div class="form-group">
                    <label for="returnQty${itemIndex}">Quantity:</label>
                    <input type="number" id="returnQty${itemIndex}" class="return-qty" min="0" step="1" value="0" onchange="calculateReturnAmount(${itemIndex})">
                </div>

                <div class="form-group">
                    <label for="returnRate${itemIndex}">Rate (₹):</label>
                    <input type="number" id="returnRate${itemIndex}" class="return-rate" min="0" step="0.01" value="0" onchange="calculateReturnAmount(${itemIndex})">
                </div>

                <div class="form-group">
                    <label for="returnAmount${itemIndex}">Return Amount (₹):</label>
                    <input type="number" id="returnAmount${itemIndex}" class="return-amount" readonly value="0">
                </div>

                <div class="form-group">
                    <label for="returnReason${itemIndex}">Reason for Return:</label>
                    <textarea id="returnReason${itemIndex}" class="return-reason" placeholder="Enter reason for return"></textarea>
                </div>
            </div>
        </div>
    `;

    returnProductsList.insertAdjacentHTML('beforeend', returnItemHTML);
}

// Remove return item
function removeReturnItem(index) {
    const returnItem = document.querySelector(`.return-item[data-index="${index}"]`);
    if (returnItem) {
        returnItem.remove();
        updateReturnSummary();
    }
}

// Update product info when selection changes
function updateReturnProductInfo(index) {
    const select = document.getElementById(`productDescription${index}`);
    const customInput = document.getElementById(`customProduct${index}`);
    const rateInput = document.getElementById(`returnRate${index}`);
    const selectedOption = select.options[select.selectedIndex];

    if (selectedOption.value === 'custom') {
        customInput.style.display = 'block';
        customInput.value = '';
        rateInput.value = '0';
    } else {
        customInput.style.display = 'none';
        if (selectedOption.dataset.rate) {
            rateInput.value = selectedOption.dataset.rate;
            calculateReturnAmount(index);
        }
    }
}

// Calculate return amount for an item
function calculateReturnAmount(index) {
    const qty = parseFloat(document.getElementById(`returnQty${index}`).value) || 0;
    const rate = parseFloat(document.getElementById(`returnRate${index}`).value) || 0;
    const amount = qty * rate;

    document.getElementById(`returnAmount${index}`).value = amount.toFixed(2);
    updateReturnSummary();
}

// Update return summary - FIXED to use current adjusted balance
function updateReturnSummary() {
    let totalReturnAmount = 0;
    const returnItems = document.querySelectorAll('.return-item');

    returnItems.forEach(item => {
        const amount = parseFloat(item.querySelector('.return-amount').value) || 0;
        totalReturnAmount += amount;
    });

    document.getElementById('totalReturnAmount').textContent = `₹${Utils.formatCurrency(totalReturnAmount)}`;

    // Get current balance from data attribute instead of original balance
    const returnDialog = document.querySelector('.return-dialog');
    const currentBalance = parseFloat(returnDialog.dataset.currentBalance) || 0;
    const newAdjustedBalance = currentBalance - totalReturnAmount;

    document.getElementById('adjustedBalanceDue').textContent = `₹${Utils.formatCurrency(newAdjustedBalance)}`;
}


// Save return - UPDATED to handle multiple returns correctly
async function saveReturn(invoiceNo) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        const returnDate = document.getElementById('returnDate').value;
        const returnItems = document.querySelectorAll('.return-item');

        if (!returnDate) {
            alert('Please select a return date.');
            return;
        }

        if (returnItems.length === 0) {
            alert('Please add at least one return item.');
            return;
        }

        const returns = [];
        let totalReturnAmount = 0;

        // Collect return items
        for (const item of returnItems) {
            const index = item.dataset.index;
            const descriptionSelect = document.getElementById(`productDescription${index}`);
            const customInput = document.getElementById(`customProduct${index}`);
            const description = descriptionSelect.value === 'custom' ? customInput.value : descriptionSelect.value;
            const qty = parseFloat(document.getElementById(`returnQty${index}`).value) || 0;
            const rate = parseFloat(document.getElementById(`returnRate${index}`).value) || 0;
            const amount = parseFloat(document.getElementById(`returnAmount${index}`).value) || 0;
            const reason = document.getElementById(`returnReason${index}`).value;

            if (!description || qty <= 0 || rate <= 0) {
                alert('Please fill all required fields for return item ' + (parseInt(index) + 1));
                return;
            }

            // Check if returning more than available quantity for invoice products
            if (descriptionSelect.value !== 'custom' && descriptionSelect.value !== '') {
                const selectedOption = descriptionSelect.options[descriptionSelect.selectedIndex];
                const maxQty = parseFloat(selectedOption.dataset.maxqty) || 0;
                const alreadyReturnedQty = await getAlreadyReturnedQty(invoiceNo, description);

                if ((qty + alreadyReturnedQty) > maxQty) {
                    alert(`Cannot return ${qty} items. Only ${maxQty - alreadyReturnedQty} items available for return for "${description}".`);
                    return;
                }
            }

            returns.push({
                description,
                qty,
                rate,
                returnAmount: amount,
                reason,
                returnDate
            });

            totalReturnAmount += amount;
        }

        // Validate that return amount doesn't exceed current balance
        const currentReturns = await Utils.calculateTotalReturns(invoiceNo);
        const currentBalance = invoiceData.balanceDue - currentReturns;

        if (totalReturnAmount > currentBalance) {
            alert(`Return amount (₹${Utils.formatCurrency(totalReturnAmount)}) cannot exceed current balance (₹${Utils.formatCurrency(currentBalance)})`);
            return;
        }

        // Save return records
        for (const returnItem of returns) {
            const returnData = {
                invoiceNo: invoiceNo,
                customerName: invoiceData.customerName,
                ...returnItem,
                createdAt: new Date().toISOString()
            };
            await db.saveReturn(returnData);
        }

        // Update invoice with return information
        await Utils.updateInvoiceWithReturns(invoiceNo);

        // Update all subsequent invoices
        await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

        alert(`Return processed successfully! Total return amount: ₹${Utils.formatCurrency(totalReturnAmount)}`);

        // Close dialog and refresh
        document.querySelector('.return-dialog-overlay').remove();
        loadInvoices();

    } catch (error) {
        console.error('Error saving return:', error);
        alert('Error processing return.');
    }
}


// Helper function to get already returned quantity for a product
async function getAlreadyReturnedQty(invoiceNo, productDescription) {
    try {
        const returns = await db.getReturnsByInvoice(invoiceNo);
        const productReturns = returns.filter(returnItem =>
            returnItem.description === productDescription
        );

        return productReturns.reduce((total, returnItem) => total + returnItem.qty, 0);
    } catch (error) {
        console.error('Error getting already returned quantity:', error);
        return 0;
    }
}

// View return status with undo option
async function viewReturnStatus(invoiceNo) {
    try {
        const returns = await db.getReturnsByInvoice(invoiceNo);
        const invoiceData = await db.getInvoice(invoiceNo);

        if (returns.length === 0) {
            alert('No return records found for this invoice.');
            return;
        }

        const returnStatusHTML = `
            <div class="return-status-dialog">
                <div class="return-status-header">
                    <h3>Return Status - Invoice #${invoiceNo}</h3>
                    <button class="close-return-status">&times;</button>
                </div>
                <div class="return-status-content">
                    <div class="customer-info">
                        <h4>${invoiceData.customerName}</h4>
                        <p>Total Returns: ${returns.length}</p>
                    </div>
                    
                    <div class="returns-list">
                        ${returns.map((returnItem, index) => `
                            <div class="return-record" data-return-id="${returnItem.id}">
                                <div class="return-record-header">
                                    <strong>Return #${index + 1}</strong>
                                    <span class="return-date">${new Date(returnItem.returnDate).toLocaleDateString('en-IN')}</span>
                                </div>
                                <div class="return-details">
                                    <p><strong>Product:</strong> ${returnItem.description}</p>
                                    <p><strong>Quantity:</strong> ${returnItem.qty}</p>
                                    <p><strong>Rate:</strong> ₹${Utils.formatCurrency(returnItem.rate)}</p>
                                    <p><strong>Amount:</strong> ₹${Utils.formatCurrency(returnItem.returnAmount)}</p>
                                    <p><strong>Reason:</strong> ${returnItem.reason}</p>
                                </div>
                                <div class="return-actions">
                                    <button class="btn-undo-return" onclick="undoReturn(${returnItem.id}, '${invoiceNo}')">
                                        <i class="fas fa-undo"></i> Undo This Return
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div class="return-total">
                        <strong>Total Return Amount: ₹${Utils.formatCurrency(returns.reduce((sum, item) => sum + item.returnAmount, 0))}</strong>
                    </div>
                    
                    <div class="bulk-actions">
                        <button class="btn-undo-all-returns" onclick="undoAllReturns('${invoiceNo}')">
                            <i class="fas fa-trash-restore"></i> Undo All Returns for This Invoice
                        </button>
                    </div>
                </div>
            </div>
        `;

        const returnStatusDialog = document.createElement('div');
        returnStatusDialog.className = 'return-status-overlay';
        returnStatusDialog.innerHTML = returnStatusHTML;

        document.body.appendChild(returnStatusDialog);

        returnStatusDialog.querySelector('.close-return-status').addEventListener('click', () => {
            document.body.removeChild(returnStatusDialog);
        });

        returnStatusDialog.addEventListener('click', (e) => {
            if (e.target === returnStatusDialog) {
                document.body.removeChild(returnStatusDialog);
            }
        });

    } catch (error) {
        console.error('Error viewing return status:', error);
        alert('Error loading return status.');
    }
}



// Undo a specific return
async function undoReturn(returnId, invoiceNo) {
    if (!confirm('Are you sure you want to undo this return? This action cannot be reversed.')) {
        return;
    }

    try {
        // Delete the return record
        await db.deleteReturn(returnId);

        // Update invoice with recalculated returns
        await Utils.updateInvoiceWithReturns(invoiceNo);

        // Get invoice data for customer name
        const invoiceData = await db.getInvoice(invoiceNo);

        // Update all subsequent invoices
        await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

        alert('Return has been successfully undone!');

        // Close the dialog and refresh the display
        const returnStatusDialog = document.querySelector('.return-status-overlay');
        if (returnStatusDialog) {
            document.body.removeChild(returnStatusDialog);
        }

        // Refresh the invoices list
        loadInvoices();

    } catch (error) {
        console.error('Error undoing return:', error);
        alert('Error undoing return. Please try again.');
    }
}

// Undo all returns for an invoice
async function undoAllReturns(invoiceNo) {
    if (!confirm('Are you sure you want to undo ALL returns for this invoice? This action cannot be reversed.')) {
        return;
    }

    try {
        const returns = await db.getReturnsByInvoice(invoiceNo);

        if (returns.length === 0) {
            alert('No returns found for this invoice.');
            return;
        }

        // Delete all return records
        for (const returnItem of returns) {
            await db.deleteReturn(returnItem.id);
        }

        // Update invoice with recalculated returns (should be 0 now)
        await Utils.updateInvoiceWithReturns(invoiceNo);

        // Get invoice data for customer name
        const invoiceData = await db.getInvoice(invoiceNo);

        // Update all subsequent invoices
        await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

        alert(`All ${returns.length} returns have been successfully undone!`);

        // Close the dialog and refresh the display
        const returnStatusDialog = document.querySelector('.return-status-overlay');
        if (returnStatusDialog) {
            document.body.removeChild(returnStatusDialog);
        }

        // Refresh the invoices list
        loadInvoices();

    } catch (error) {
        console.error('Error undoing all returns:', error);
        alert('Error undoing returns. Please try again.');
    }
}

// Delete invoice
async function deleteInvoice(invoiceNo) {
    if (confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
        try {
            await db.deleteInvoice(invoiceNo);
            alert('Invoice deleted successfully!');
            loadInvoices(); // Refresh the list
        } catch (error) {
            console.error('Error deleting invoice:', error);
            alert('Error deleting invoice.');
        }
    }
}


// Clear customer statement search and results
function clearCustomerStatement() {
    document.getElementById('customerSearch').value = '';
    document.getElementById('customerStatementResults').innerHTML = '';
}


// // Logout function
// function logout() {
//     if (confirm('Are you sure you want to logout?')) {
//         window.location.href = 'login.html';
//     }
// }