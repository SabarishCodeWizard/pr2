// Invoice history page functionality
document.addEventListener('DOMContentLoaded', async function () {
    // Initialize database
    await db.init();

    // Load recent invoices
    loadRecentInvoices();

    // Load all invoices
    loadInvoices();

    // Add event listeners
    document.getElementById('searchBtn').addEventListener('click', loadInvoices);
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('generateCustomerStatement').addEventListener('click', searchCustomerInvoices);
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
function displayCustomerStatementResults(customerName, invoices) {
    // Sort invoices by invoice number (newest first)
    invoices.sort((a, b) => {
        const numA = parseInt(a.invoiceNo) || 0;
        const numB = parseInt(b.invoiceNo) || 0;
        return numB - numA; // Descending order (newest first)
    });

    // Calculate summary statistics
    const totalInvoices = invoices.length;
    const totalCurrentBillAmount = invoices.reduce((sum, invoice) => sum + invoice.subtotal, 0);

    // Get balance due from the most recent invoice only
    const mostRecentInvoice = invoices[0];
    const balanceDue = mostRecentInvoice.balanceDue;

    // Calculate total paid as sum of all amountPaid values
    const totalPaid = invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);

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
                <div class="stat-item">
                    <div class="stat-value">₹${Utils.formatCurrency(balanceDue)}</div>
                    <div class="stat-label">Balance Due</div>
                </div>
            </div>
            
            <div class="customer-invoices-list">
                ${invoices.map(invoice => `
                    <div class="customer-invoice-item">
                        <div class="customer-invoice-info">
                            <strong>Invoice #${invoice.invoiceNo}</strong> - 
                            ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')} - 
                            Current: ₹${Utils.formatCurrency(invoice.subtotal)} - 
                            Paid: ₹${Utils.formatCurrency(invoice.amountPaid)} - 
                            Due: ₹${Utils.formatCurrency(invoice.balanceDue)}
                        </div>
                    </div>
                `).join('')}
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


// Generate combined PDF statement for all customer invoices
async function generateCombinedPDFStatement(customerName, invoices) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        let yPos = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);

        // Add header
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('PR FABRICS', pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('42/65, THIRUNEELAKANDA PURAM, 1ST STREET, TIRUPUR 641-602', pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;
        doc.text('Cell: 9952520181 | Email: info@prfabrics.com', pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('COMBINED ACCOUNT STATEMENT', pageWidth / 2, yPos, { align: 'center' });
        yPos += 15;

        // Add statement info
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Statement Date: ${new Date().toLocaleDateString('en-IN')}`, margin, yPos);
        doc.text(`Customer: ${customerName}`, margin, yPos + 5);
        doc.text(`Total Invoices: ${invoices.length}`, margin, yPos + 10);
        yPos += 20;

        // Sort invoices by invoice number (newest first)
        invoices.sort((a, b) => {
            const numA = parseInt(a.invoiceNo) || 0;
            const numB = parseInt(b.invoiceNo) || 0;
            return numB - numA;
        });

        // Calculate totals correctly
        const totalCurrentBillAmount = invoices.reduce((sum, invoice) => sum + invoice.subtotal, 0);
        const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0);
        const balanceDue = invoices[0].balanceDue; // Most recent invoice balance
        const totalPaid = totalCurrentBillAmount - balanceDue; // Calculated correctly

        // Add summary
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Account Summary', margin, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Total Current Bill Amount:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(totalCurrentBillAmount)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 6;

        // doc.text('Total Amount (with Previous Balance):', margin, yPos);
        // doc.text(`₹${Utils.formatCurrency(totalAmount)}`, pageWidth - margin, yPos, { align: 'right' });
        // yPos += 6;

        doc.text('Total Amount Paid:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(totalPaid)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 6;

        doc.setFont('helvetica', 'bold');
        doc.text('Outstanding Balance:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(balanceDue)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 15;

        // Add invoice list header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Invoice Details', margin, yPos);
        yPos += 10;

        // Create invoice summary table
        const invoiceTableHeaders = [['Invoice No', 'Date', 'Current Bill', 'Total Balance Amount', 'Amount Paid', 'Balance Due', 'Status']];
        const invoiceTableData = invoices.map(invoice => [
            invoice.invoiceNo,
            new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
            Utils.formatCurrency(invoice.subtotal),
            Utils.formatCurrency(invoice.grandTotal),
            Utils.formatCurrency(invoice.amountPaid),
            Utils.formatCurrency(invoice.balanceDue),
            invoice.balanceDue === 0 ? 'Paid' : 'Pending'
        ]);

        // Add total row
        invoiceTableData.push([
            'TOTAL',
            '',
            Utils.formatCurrency(totalCurrentBillAmount),
            Utils.formatCurrency(totalAmount),
            Utils.formatCurrency(totalPaid),
            Utils.formatCurrency(balanceDue),
            ''
        ]);

        doc.autoTable({
            startY: yPos,
            head: invoiceTableHeaders,
            body: invoiceTableData,
            theme: 'grid',
            headStyles: {
                fillColor: [44, 62, 80],
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 8,
                cellPadding: 3,
            },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 20 },
                2: { cellWidth: 20 },
                3: { cellWidth: 20 },
                4: { cellWidth: 20 },
                5: { cellWidth: 20 },
                6: { cellWidth: 15 }
            },
            margin: { left: margin, right: margin },
            didDrawCell: function (data) {
                // Highlight total row
                if (data.row.index === invoiceTableData.length - 1) {
                    doc.setFillColor(240, 240, 240);
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                    doc.setFont('helvetica', 'bold');
                }

                // Color balance due in red if pending
                if (data.column.index === 5 && data.cell.raw !== '' && parseFloat(data.cell.raw) > 0) {
                    doc.setTextColor(255, 0, 0);
                } else {
                    doc.setTextColor(0, 0, 0);
                }
            }
        });

        yPos = doc.lastAutoTable.finalY + 10;

        // Add footer
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('This is a computer-generated combined statement. No signature is required.', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text('For any queries, please contact: 9952520181 | info@prfabrics.com', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, yPos, { align: 'center' });

        // Save the PDF
        doc.save(`Combined_Statement_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

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

// Load invoices with optional filters
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

        // Sort by invoice number (descending order - highest first)
        filteredInvoices.sort((a, b) => {
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


// Display invoices in the list
function displayInvoices(invoices) {
    const invoicesList = document.getElementById('invoicesList');

    if (invoices.length === 0) {
        invoicesList.innerHTML = '<p class="no-invoices">No invoices found.</p>';
        return;
    }

    invoicesList.innerHTML = invoices.map(invoice => {
        // Calculate previous bill amount (grandTotal - subtotal)
        const previousBillAmount = invoice.grandTotal - invoice.subtotal;

        return `
        <div class="invoice-item">
            <div class="invoice-info">
                <h3>Invoice #${invoice.invoiceNo}</h3>
                <p><strong>Customer:</strong> ${invoice.customerName}</p>
                <p><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</p>
                <p><strong>Current Bill Amount:</strong> ₹${Utils.formatCurrency(invoice.subtotal)}</p>
                <p><strong>Previous Balance:</strong> ₹${Utils.formatCurrency(previousBillAmount)}</p>
                <p><strong>Total Amount:</strong> ₹${Utils.formatCurrency(invoice.grandTotal)}</p>
                <p><strong>Amount Paid:</strong> ₹${Utils.formatCurrency(invoice.amountPaid)} 
                    ${invoice.paymentMethod ? `<span class="payment-method-badge payment-method-${invoice.paymentMethod}">${invoice.paymentMethod.toUpperCase()}</span>` : ''}
                </p>
                <p><strong>Balance Due:</strong> ₹${Utils.formatCurrency(invoice.balanceDue)}</p>
            </div>
            <div class="invoice-actions">
                <button class="btn-edit" onclick="editInvoice('${invoice.invoiceNo}')">Edit</button>
                <button class="btn-payment" onclick="addPayment('${invoice.invoiceNo}')">Add Payment</button>
                <button class="btn-statement" onclick="generateStatement('${invoice.invoiceNo}')">Statement</button>
                <button class="btn-share" onclick="shareInvoiceViaWhatsApp('${invoice.invoiceNo}')">
        <i class="fab fa-whatsapp"></i> Share
    </button>
                <button class="btn-delete" onclick="deleteInvoice('${invoice.invoiceNo}')">Delete</button>
            </div>
        </div>
        `;
    }).join('');
}

//  <button class="btn-view" onclick="viewInvoice('${invoice.invoiceNo}')">View</button>
// <button class="btn-pdf" onclick="generateInvoicePDF('${invoice.invoiceNo}')">PDF</button>

// Share combined statement via WhatsApp
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

        // Calculate totals
        const totalInvoices = customerInvoices.length;
        const totalCurrentBillAmount = customerInvoices.reduce((sum, invoice) => sum + invoice.subtotal, 0);
        const balanceDue = customerInvoices[0].balanceDue;
        const totalPaid = customerInvoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);

        // Get customer details from the most recent invoice
        const mostRecentInvoice = customerInvoices[0];
        const customerPhone = mostRecentInvoice.customerPhone;
        const customerAddress = mostRecentInvoice.customerAddress;

        // Create WhatsApp message
        const message = `*PR FABRICS - ACCOUNT STATEMENT*

*Customer:* ${customerName}
*Address:* ${customerAddress || 'Not specified'}
*Total Invoices:* ${totalInvoices}
*Total Current Bill Amount:* ₹${Utils.formatCurrency(totalCurrentBillAmount)}
*Total Amount Paid:* ₹${Utils.formatCurrency(totalPaid)}
*Outstanding Balance:* ₹${Utils.formatCurrency(balanceDue)}

*Invoice Summary:*
${customerInvoices.map(invoice =>
            `• Invoice #${invoice.invoiceNo} (${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}): Current: ₹${Utils.formatCurrency(invoice.subtotal)} | Paid: ₹${Utils.formatCurrency(invoice.amountPaid)} | Due: ₹${Utils.formatCurrency(invoice.balanceDue)}`
        ).join('\n')}

*Contact Information:*
PR Fabrics, Tirupur
Phone: 9952520181

_This is an automated statement. Please contact us for any queries._`;

        // Generate PDF first
        await generateCombinedPDFStatement(customerName, customerInvoices);

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

        // Calculate previous balance
        const previousBalance = invoiceData.grandTotal - invoiceData.subtotal;

        // Create WhatsApp message
        const message = `*PR FABRICS - INVOICE STATEMENT*

*Invoice Details:*
Invoice #: ${invoiceData.invoiceNo}
Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}
Customer: ${invoiceData.customerName}
Address: ${invoiceData.customerAddress || 'Not specified'}
Phone: ${invoiceData.customerPhone || 'Not specified'}

*Amount Summary:*
Current Bill Amount: ₹${Utils.formatCurrency(invoiceData.subtotal)}
Previous Balance: ₹${Utils.formatCurrency(previousBalance)}
Total Amount: ₹${Utils.formatCurrency(invoiceData.grandTotal)}
Amount Paid: ₹${Utils.formatCurrency(invoiceData.amountPaid)}
Balance Due: ₹${Utils.formatCurrency(invoiceData.balanceDue)}
Payment Method: ${invoiceData.paymentMethod?.toUpperCase() || 'CASH'}

*Product Details:*
${invoiceData.products.map((product, index) =>
            `${index + 1}. ${product.description} - Qty: ${product.qty} × Rate: ₹${Utils.formatCurrency(product.rate)} = ₹${Utils.formatCurrency(product.amount)}`
        ).join('\n')}

*Contact Information:*
PR Fabrics, Tirupur
Phone: 9952520181

_This is an automated invoice statement. Please contact us for any queries._`;

        // Generate PDF first
        const payments = await db.getPaymentsByInvoice(invoiceNo);
        await generatePDFStatement(invoiceData, payments);

        // Open WhatsApp with the message
        openWhatsApp(invoiceData.customerPhone, message);

    } catch (error) {
        console.error('Error sharing invoice:', error);
        alert('Error sharing invoice. Please try again.');
    }
}

// Open WhatsApp with formatted message
function openWhatsApp(phoneNumber, message) {
    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : '';

    if (!cleanPhone) {
        alert('Customer phone number not found. Please check customer details.');
        return;
    }

    // Format message for URL
    const encodedMessage = encodeURIComponent(message);

    // Create WhatsApp URL
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    // Open in new tab
    window.open(whatsappUrl, '_blank');
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

// Add payment to an invoice with payment method
async function addPayment(invoiceNo) {
    // Create a custom dialog for payment input
    const paymentDialog = document.createElement('div');
    paymentDialog.className = 'payment-dialog-overlay';
    paymentDialog.innerHTML = `
        <div class="payment-dialog">
            <h3>Add Payment - Invoice #${invoiceNo}</h3>
            <div class="payment-form">
                <div class="form-group">
                    <label for="paymentAmount">Payment Amount:</label>
                    <input type="number" id="paymentAmount" step="0.01" min="0.01" placeholder="Enter amount">
                </div>
                <div class="form-group">
                    <label for="paymentMethodSelect">Payment Method:</label>
                    <select id="paymentMethodSelect" class="payment-select">
                        <option value="cash">Cash</option>
                        <option value="gpay">GPay</option>
                    </select>
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

    // Focus on amount input
    setTimeout(() => {
        document.getElementById('paymentAmount').focus();
    }, 100);

    // Return a promise to handle the payment
    return new Promise((resolve) => {
        document.getElementById('confirmPayment').addEventListener('click', async function () {
            const amount = parseFloat(document.getElementById('paymentAmount').value);
            const paymentMethod = document.getElementById('paymentMethodSelect').value;
            const paymentDate = document.getElementById('paymentDate').value;

            if (!amount || isNaN(amount) || amount <= 0) {
                alert('Please enter a valid payment amount.');
                return;
            }

            if (!paymentDate) {
                alert('Please select a payment date.');
                return;
            }

            try {
                const invoiceData = await db.getInvoice(invoiceNo);
                if (invoiceData) {
                    const paymentAmount = parseFloat(amount);
                    const newAmountPaid = invoiceData.amountPaid + paymentAmount;

                    // Update invoice with new payment
                    invoiceData.amountPaid = newAmountPaid;
                    invoiceData.balanceDue = invoiceData.grandTotal - newAmountPaid;

                    await db.saveInvoice(invoiceData);


                    // Update all subsequent invoices
                    await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

                    // Save payment record with method
                    const paymentData = {
                        invoiceNo: invoiceNo,
                        paymentDate: paymentDate,
                        amount: paymentAmount,
                        paymentMethod: paymentMethod,
                        paymentType: 'additional'
                    };
                    await db.savePayment(paymentData);

                    document.body.removeChild(paymentDialog);
                    alert(`Payment of ₹${Utils.formatCurrency(paymentAmount)} via ${paymentMethod.toUpperCase()} added successfully!`);
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

// Generate PDF statement
async function generatePDFStatement(invoiceData, payments) {
    try {
        // Create PDF document
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        // Set initial y position
        let yPos = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);

        // Add header
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('PR FABRICS', pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('42/65, THIRUNEELAKANDA PURAM, 1ST STREET, TIRUPUR 641-602', pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;
        doc.text('Cell: 9952520181 | Email: info@prfabrics.com', pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('ACCOUNT STATEMENT', pageWidth / 2, yPos, { align: 'center' });
        yPos += 15;

        // Add statement info
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Statement Date: ${new Date().toLocaleDateString('en-IN')}`, margin, yPos);
        doc.text(`Statement Period: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')} to ${new Date().toLocaleDateString('en-IN')}`, margin, yPos + 5);
        yPos += 15;

        // Add customer information
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Customer Information', margin, yPos);
        yPos += 7;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Name: ${invoiceData.customerName}`, margin, yPos);
        yPos += 5;
        doc.text(`Address: ${invoiceData.customerAddress}`, margin, yPos);
        yPos += 5;
        doc.text(`Phone: ${invoiceData.customerPhone}`, margin, yPos);
        yPos += 5;
        doc.text(`Invoice No: ${invoiceData.invoiceNo}`, margin, yPos);
        yPos += 5;
        doc.text(`Invoice Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}`, margin, yPos);
        yPos += 10;

        // Check if we need a new page
        if (yPos > 240) {
            doc.addPage();
            yPos = 20;
        }

        // Add invoice details header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Invoice Details', margin, yPos);
        yPos += 10;

        // Create invoice details table
        const invoiceTableHeaders = [['S.No.', 'Description', 'Qty', 'Rate (₹)', 'Amount (₹)']];
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
                fillColor: [44, 62, 80],
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 8,
                cellPadding: 3,
            },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 20 },
                3: { cellWidth: 30 },
                4: { cellWidth: 30 }
            },
            margin: { left: margin, right: margin }
        });

        yPos = doc.lastAutoTable.finalY + 10;

        // Check if we need a new page
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }

        // Add invoice summary
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Invoice Summary', margin, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');


        // Total Amount
        doc.setFont('helvetica', 'bold');
        doc.text('Total Amount:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(invoiceData.grandTotal)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 10;

        // Check if we need a new page
        if (yPos > 220) {
            doc.addPage();
            yPos = 20;
        }

        // Add payment history header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Payment History', margin, yPos);
        yPos += 10;

        // Create payment history table
        const paymentTableHeaders = [['Date', 'Description', 'Amount (₹)', 'Balance (₹)']];
        const paymentTableData = generatePaymentTableData(payments, invoiceData.grandTotal);

        doc.autoTable({
            startY: yPos,
            head: paymentTableHeaders,
            body: paymentTableData,
            theme: 'grid',
            headStyles: {
                fillColor: [44, 62, 80],
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 8,
                cellPadding: 3,
            },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 30 },
                3: { cellWidth: 30 }
            },
            margin: { left: margin, right: margin },
            didDrawCell: function (data) {
                // Color negative amounts (payments) in green
                if (data.column.index === 2 && data.cell.raw.includes('-')) {
                    doc.setTextColor(0, 128, 0); // Green color for payments
                } else {
                    doc.setTextColor(0, 0, 0); // Black color for other text
                }
            }
        });

        yPos = doc.lastAutoTable.finalY + 10;

        // Check if we need a new page
        if (yPos > 180) {
            doc.addPage();
            yPos = 20;
        }

        // Add account summary
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Account Summary', margin, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        // Invoice Amount
        doc.text('Invoice Amount:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(invoiceData.grandTotal)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 6;

        // Total Paid
        doc.text('Total Paid:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(invoiceData.amountPaid)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 6;

        // Outstanding Balance
        doc.setFont('helvetica', 'bold');
        doc.text('Outstanding Balance:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(invoiceData.balanceDue)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 15;

        // Add footer
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('This is a computer-generated statement. No signature is required.', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text('For any queries, please contact: 9952520181 | info@prfabrics.com', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, yPos, { align: 'center' });

        // Save the PDF
        doc.save(`Statement_${invoiceData.invoiceNo}_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (error) {
        console.error('Error generating PDF statement:', error);
        throw error;
    }
}

// In the payment table data generation, update to include payment method
function generatePaymentTableData(payments, grandTotal) {
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

    return tableData;
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

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = 'login.html';
    }
}

