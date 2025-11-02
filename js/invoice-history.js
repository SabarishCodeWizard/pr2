// Invoice history page functionality
document.addEventListener('DOMContentLoaded', async function () {
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

        // Calculate totals correctly with returns
        const totalCurrentBillAmount = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.subtotal, 0);
        const totalAmount = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.grandTotal, 0);
        const totalPaid = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
        const totalReturns = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.totalReturns, 0);
        
        // Get adjusted balance from the most recent invoice
        const mostRecentInvoice = invoicesWithReturns[0];
        const adjustedBalanceDue = mostRecentInvoice.adjustedBalanceDue;

        // Add summary
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Account Summary', margin, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
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
            doc.setTextColor(139, 0, 0); // Dark red for returns
            doc.text(`-₹${Utils.formatCurrency(totalReturns)}`, pageWidth - margin, yPos, { align: 'right' });
            doc.setTextColor(0, 0, 0); // Reset to black
            yPos += 6;
        }

        // Outstanding Balance
        doc.setFont('helvetica', 'bold');
        if (totalReturns > 0) {
            doc.text('Adjusted Outstanding Balance:', margin, yPos);
        } else {
            doc.text('Outstanding Balance:', margin, yPos);
        }
        doc.text(`₹${Utils.formatCurrency(adjustedBalanceDue)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 15;

        // Add invoice list header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Invoice Details', margin, yPos);
        yPos += 10;

        // Create invoice summary table with returns
        const invoiceTableHeaders = totalReturns > 0 
            ? [['Invoice No', 'Date', 'Current Bill', 'Amount Paid', 'Returns', 'Balance Due', 'Status']]
            : [['Invoice No', 'Date', 'Current Bill', 'Amount Paid', 'Balance Due', 'Status']];

        const invoiceTableData = invoicesWithReturns.map(invoice => {
            const baseData = [
                invoice.invoiceNo,
                new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
                Utils.formatCurrency(invoice.subtotal),
                Utils.formatCurrency(invoice.amountPaid)
            ];
            
            if (totalReturns > 0) {
                baseData.push(
                    Utils.formatCurrency(invoice.totalReturns),
                    Utils.formatCurrency(invoice.adjustedBalanceDue),
                    invoice.adjustedBalanceDue === 0 ? 'Paid' : 'Pending'
                );
            } else {
                baseData.push(
                    Utils.formatCurrency(invoice.balanceDue),
                    invoice.balanceDue === 0 ? 'Paid' : 'Pending'
                );
            }
            
            return baseData;
        });

        // Add total row
        if (totalReturns > 0) {
            invoiceTableData.push([
                'TOTAL',
                '',
                Utils.formatCurrency(totalCurrentBillAmount),
                Utils.formatCurrency(totalPaid),
                Utils.formatCurrency(totalReturns),
                Utils.formatCurrency(adjustedBalanceDue),
                ''
            ]);
        } else {
            invoiceTableData.push([
                'TOTAL',
                '',
                Utils.formatCurrency(totalCurrentBillAmount),
                Utils.formatCurrency(totalPaid),
                Utils.formatCurrency(adjustedBalanceDue),
                ''
            ]);
        }

        const columnStyles = totalReturns > 0 
            ? {
                0: { cellWidth: 18 },
                1: { cellWidth: 18 },
                2: { cellWidth: 18 },
                3: { cellWidth: 18 },
                4: { cellWidth: 18 },
                5: { cellWidth: 18 },
                6: { cellWidth: 12 }
            }
            : {
                0: { cellWidth: 20 },
                1: { cellWidth: 20 },
                2: { cellWidth: 20 },
                3: { cellWidth: 20 },
                4: { cellWidth: 20 },
                5: { cellWidth: 15 }
            };

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
            columnStyles: columnStyles,
            margin: { left: margin, right: margin },
            didDrawCell: function (data) {
                // Highlight total row
                if (data.row.index === invoiceTableData.length - 1) {
                    doc.setFillColor(240, 240, 240);
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                    doc.setFont('helvetica', 'bold');
                }

                // Color returns column in dark red
                if (totalReturns > 0 && data.column.index === 4 && data.cell.raw !== '') {
                    doc.setTextColor(139, 0, 0);
                }
                // Color balance due in red if pending
                else if ((totalReturns > 0 && data.column.index === 5 && data.cell.raw !== '' && parseFloat(data.cell.raw) > 0) ||
                         (!totalReturns && data.column.index === 4 && data.cell.raw !== '' && parseFloat(data.cell.raw) > 0)) {
                    doc.setTextColor(255, 0, 0);
                } else {
                    doc.setTextColor(0, 0, 0);
                }
            }
        });

        yPos = doc.lastAutoTable.finalY + 10;

        // Add return details section if there are returns
        if (totalReturns > 0) {
            // Check if we need a new page
            if (yPos > 180) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Return Details', margin, yPos);
            yPos += 10;

            // Get all returns for this customer
            const allReturns = await db.getAllReturns();
            const customerReturns = allReturns.filter(returnItem => 
                returnItem.customerName.toLowerCase().includes(customerName.toLowerCase())
            );

            if (customerReturns.length > 0) {
                const returnTableHeaders = [['Invoice No', 'Date', 'Product', 'Qty', 'Rate (₹)', 'Amount (₹)', 'Reason']];
                const returnTableData = customerReturns.map(returnItem => [
                    returnItem.invoiceNo,
                    new Date(returnItem.returnDate).toLocaleDateString('en-IN'),
                    returnItem.description,
                    returnItem.qty.toString(),
                    Utils.formatCurrency(returnItem.rate),
                    Utils.formatCurrency(returnItem.returnAmount),
                    returnItem.reason || 'N/A'
                ]);

                // Add total return row
                returnTableData.push([
                    'TOTAL',
                    '',
                    '',
                    '',
                    '',
                    Utils.formatCurrency(totalReturns),
                    ''
                ]);

                doc.autoTable({
                    startY: yPos,
                    head: returnTableHeaders,
                    body: returnTableData,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [139, 0, 0], // Dark red for returns
                        textColor: 255,
                        fontStyle: 'bold'
                    },
                    styles: {
                        fontSize: 7,
                        cellPadding: 2,
                    },
                    columnStyles: {
                        0: { cellWidth: 18 },
                        1: { cellWidth: 18 },
                        2: { cellWidth: 'auto' },
                        3: { cellWidth: 12 },
                        4: { cellWidth: 15 },
                        5: { cellWidth: 15 },
                        6: { cellWidth: 25 }
                    },
                    margin: { left: margin, right: margin },
                    didDrawCell: function (data) {
                        // Highlight total row
                        if (data.row.index === returnTableData.length - 1) {
                            doc.setFillColor(255, 230, 230);
                            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                            doc.setFont('helvetica', 'bold');
                        }
                        
                        // Color return amounts in dark red
                        if (data.column.index === 5 && data.cell.raw !== '') {
                            doc.setTextColor(139, 0, 0);
                        } else {
                            doc.setTextColor(0, 0, 0);
                        }
                    }
                });

                yPos = doc.lastAutoTable.finalY + 10;
            }
        }

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
async function displayInvoices(invoices) {
    const invoicesList = document.getElementById('invoicesList');

    if (invoices.length === 0) {
        invoicesList.innerHTML = '<p class="no-invoices">No invoices found.</p>';
        return;
    }

    // Calculate returns for all invoices first
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

    invoicesList.innerHTML = invoicesWithReturns.map(invoice => {
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
                ${invoice.totalReturns > 0 ? `
                    <p><strong>Return Amount:</strong> ₹${Utils.formatCurrency(invoice.totalReturns)}</p>
                    <p><strong>Adjusted Balance Due:</strong> ₹${Utils.formatCurrency(invoice.adjustedBalanceDue)}</p>
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
                ${invoice.totalReturns > 0 ? `
                    <button class="btn-return-status" onclick="viewReturnStatus('${invoice.invoiceNo}')">
                        <i class="fas fa-history"></i> Return Status
                    </button>
                ` : ''}
                <button class="btn-delete" onclick="deleteInvoice('${invoice.invoiceNo}')">Delete</button>
            </div>
        </div>
        `;
    }).join('');
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
                return {
                    ...invoice,
                    totalReturns,
                    adjustedBalanceDue: invoice.balanceDue - totalReturns
                };
            })
        );

        // Calculate totals with returns
        const totalInvoices = invoicesWithReturns.length;
        const totalCurrentBillAmount = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.subtotal, 0);
        const totalPaid = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
        const totalReturns = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.totalReturns, 0);
        
        // Get adjusted balance from the most recent invoice
        const mostRecentInvoice = invoicesWithReturns[0];
        const adjustedBalanceDue = mostRecentInvoice.adjustedBalanceDue;

        // Get customer details from the most recent invoice
        const customerPhone = mostRecentInvoice.customerPhone;
        const customerAddress = mostRecentInvoice.customerAddress;

        // Create WhatsApp message with returns information
        const message = `*PR FABRICS - ACCOUNT STATEMENT*
*GSTIN: 33CLJPG4331G1ZG*

*Customer Details:*
Customer: ${customerName}
Address: ${customerAddress || 'Not specified'}
Total Invoices: ${totalInvoices}

*Invoice Summary:*
${invoicesWithReturns.map(invoice => {
            const previousBalance = invoice.grandTotal - invoice.subtotal;
            return `📋 *Invoice #${invoice.invoiceNo}*
   Date: ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}
   Current Bill: ₹${Utils.formatCurrency(invoice.subtotal)}
   ${previousBalance > 0 ? `Previous Balance: ₹${Utils.formatCurrency(previousBalance)}` : ''}
   Amount Paid: ₹${Utils.formatCurrency(invoice.amountPaid)}
   ${invoice.totalReturns > 0 ? `Returns: -₹${Utils.formatCurrency(invoice.totalReturns)}` : ''}
   ${invoice.totalReturns > 0 ? `*Adjusted Due: ₹${Utils.formatCurrency(invoice.adjustedBalanceDue)}*` : `*Balance Due: ₹${Utils.formatCurrency(invoice.balanceDue)}*`}`;
        }).join('\n\n')}

*Account Summary:*
Total Current Bill Amount: ₹${Utils.formatCurrency(totalCurrentBillAmount)}
Total Amount Paid: ₹${Utils.formatCurrency(totalPaid)}
${totalReturns > 0 ? `Total Returns: -₹${Utils.formatCurrency(totalReturns)}` : ''}
${totalReturns > 0 ? `*Adjusted Outstanding Balance: ₹${Utils.formatCurrency(adjustedBalanceDue)}*` : `*Outstanding Balance: ₹${Utils.formatCurrency(mostRecentInvoice.balanceDue)}*`}

${totalReturns > 0 ? `
*Return Summary:*
Total Return Amount: ₹${Utils.formatCurrency(totalReturns)}
` : ''}

*CONTACT INFORMATION:*
*PR FABRICS*
*Tirupur*
*Phone: 9952520181*

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

        // Create WhatsApp message with returns information
        const message = `*PR FABRICS - INVOICE STATEMENT*
*GSTIN: 33CLJPG4331G1ZG*

*Invoice Details:*
Invoice #: ${invoiceData.invoiceNo}
Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}
Customer: ${invoiceData.customerName}
Address: ${invoiceData.customerAddress || 'Not specified'}
Phone: ${invoiceData.customerPhone || 'Not specified'}

*Product Details:*
${invoiceData.products.map((product, index) =>
            `${index + 1}. ${product.description} - Qty: ${product.qty} × Rate: ₹${Utils.formatCurrency(product.rate)} = ₹${Utils.formatCurrency(product.amount)}`
        ).join('\n')}

${totalReturns > 0 ? `
*Return Details:*
${returns.map((returnItem, index) =>
            `${index + 1}. ${returnItem.description} - Qty: ${returnItem.qty} × Rate: ₹${Utils.formatCurrency(returnItem.rate)} = -₹${Utils.formatCurrency(returnItem.returnAmount)}${returnItem.reason ? ` (Reason: ${returnItem.reason})` : ''}`
        ).join('\n')}
` : ''}

*Account Summary:*
Current Bill Amount: ₹${Utils.formatCurrency(invoiceData.subtotal)}
Previous Balance: ₹${Utils.formatCurrency(previousBalance)}
Total Amount: ₹${Utils.formatCurrency(invoiceData.grandTotal)}
Amount Paid: ₹${Utils.formatCurrency(invoiceData.amountPaid)}
${totalReturns > 0 ? `Return Amount: -₹${Utils.formatCurrency(totalReturns)}` : ''}
${totalReturns > 0 ? `Adjusted Balance Due: ₹${Utils.formatCurrency(adjustedBalanceDue)}` : `Balance Due: ₹${Utils.formatCurrency(invoiceData.balanceDue)}`}
Payment Method: ${invoiceData.paymentMethod?.toUpperCase() || 'CASH'}

${totalReturns > 0 ? `
*Return Summary:*
Total Return Amount: ₹${Utils.formatCurrency(totalReturns)}
` : ''}

*CONTACT INFORMATION:*
*PR FABRICS*
*Tirupur*
*Phone: 9952520181*

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

// Generate PDF statement with organized file naming
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

        // Current Bill Amount
        doc.text('Current Bill Amount:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(invoiceData.subtotal)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 6;

        // Previous Balance
        const previousBalance = invoiceData.grandTotal - invoiceData.subtotal;
        doc.text('Previous Balance:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(previousBalance)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 6;

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

        // Add return information if applicable
        if (totalReturns > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Return Information', margin, yPos);
            yPos += 10;

            // Get return details
            const returns = await db.getReturnsByInvoice(invoiceData.invoiceNo);
            
            if (returns.length > 0) {
                const returnTableHeaders = [['Date', 'Product', 'Qty', 'Rate (₹)', 'Amount (₹)', 'Reason']];
                const returnTableData = returns.map((returnItem, index) => [
                    new Date(returnItem.returnDate).toLocaleDateString('en-IN'),
                    returnItem.description,
                    returnItem.qty.toString(),
                    Utils.formatCurrency(returnItem.rate),
                    Utils.formatCurrency(returnItem.returnAmount),
                    returnItem.reason || 'N/A'
                ]);

                // Add total return row
                returnTableData.push([
                    'TOTAL',
                    '',
                    '',
                    '',
                    Utils.formatCurrency(totalReturns),
                    ''
                ]);

                doc.autoTable({
                    startY: yPos,
                    head: returnTableHeaders,
                    body: returnTableData,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [139, 0, 0], // Dark red for returns
                        textColor: 255,
                        fontStyle: 'bold'
                    },
                    styles: {
                        fontSize: 7,
                        cellPadding: 2,
                    },
                    columnStyles: {
                        0: { cellWidth: 20 },
                        1: { cellWidth: 'auto' },
                        2: { cellWidth: 15 },
                        3: { cellWidth: 20 },
                        4: { cellWidth: 20 },
                        5: { cellWidth: 30 }
                    },
                    margin: { left: margin, right: margin },
                    didDrawCell: function (data) {
                        // Highlight total row
                        if (data.row.index === returnTableData.length - 1) {
                            doc.setFillColor(255, 230, 230);
                            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                            doc.setFont('helvetica', 'bold');
                        }
                        
                        // Color return amounts in red
                        if (data.column.index === 4 && data.cell.raw !== '') {
                            doc.setTextColor(139, 0, 0); // Dark red for return amounts
                        } else {
                            doc.setTextColor(0, 0, 0);
                        }
                    }
                });

                yPos = doc.lastAutoTable.finalY + 10;
            }

            // Check if we need a new page after returns
            if (yPos > 200) {
                doc.addPage();
                yPos = 20;
            }
        }

        // Add payment history header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Payment History', margin, yPos);
        yPos += 10;

        // Create payment history table
        const paymentTableHeaders = [['Date', 'Description', 'Amount (₹)', 'Balance (₹)']];
        const paymentTableData = generatePaymentTableData(payments, invoiceData.grandTotal, totalReturns);

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

        // Return Amount (if applicable)
        if (totalReturns > 0) {
            doc.text('Return Amount:', margin, yPos);
            doc.text(`-₹${Utils.formatCurrency(totalReturns)}`, pageWidth - margin, yPos, { align: 'right' });
            yPos += 6;
        }

        // Outstanding Balance
        doc.setFont('helvetica', 'bold');
        if (totalReturns > 0) {
            doc.text('Adjusted Balance Due:', margin, yPos);
            doc.text(`₹${Utils.formatCurrency(adjustedBalanceDue)}`, pageWidth - margin, yPos, { align: 'right' });
        } else {
            doc.text('Outstanding Balance:', margin, yPos);
            doc.text(`₹${Utils.formatCurrency(invoiceData.balanceDue)}`, pageWidth - margin, yPos, { align: 'right' });
        }
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

        // Generate organized filename
        const today = new Date();
        const dateFolder = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        const fileName = `Statement_${invoiceData.invoiceNo}_${invoiceData.customerName}_${dateFolder}.pdf`;
        
        // Save the PDF with organized filename
        doc.save(fileName);
        
        // Show organization instructions
        setTimeout(() => {
            alert(`PDF saved as: ${fileName}\n\n💡 Organization Tip:\n1. Create a folder named: ${dateFolder}\n2. Move this file into that folder\n3. All statements from today will go in the same folder`);
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

// Add Return to an invoice
async function addReturn(invoiceNo) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        if (!invoiceData) {
            alert('Invoice not found!');
            return;
        }

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
                        <div class="summary-item">
                            <span>Total Return Amount:</span>
                            <span id="totalReturnAmount">₹0.00</span>
                        </div>
                        <div class="summary-item total">
                            <span>Adjusted Balance Due:</span>
                            <span id="adjustedBalanceDue">₹${Utils.formatCurrency(invoiceData.balanceDue)}</span>
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

// Update return summary
function updateReturnSummary() {
    let totalReturnAmount = 0;
    const returnItems = document.querySelectorAll('.return-item');

    returnItems.forEach(item => {
        const amount = parseFloat(item.querySelector('.return-amount').value) || 0;
        totalReturnAmount += amount;
    });

    document.getElementById('totalReturnAmount').textContent = `₹${Utils.formatCurrency(totalReturnAmount)}`;

    // Get original balance due from the first summary item
    const originalBalanceText = document.querySelector('.summary-item:first-child span:last-child').textContent;
    const originalBalance = parseFloat(originalBalanceText.replace(/[^\d.]/g, '')) || 0;
    const adjustedBalance = originalBalance - totalReturnAmount;

    document.getElementById('adjustedBalanceDue').textContent = `₹${Utils.formatCurrency(adjustedBalance)}`;
}

// Save return
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

// View return status
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
                            <div class="return-record">
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
                            </div>
                        `).join('')}
                    </div>

                    <div class="return-total">
                        <strong>Total Return Amount: ₹${Utils.formatCurrency(returns.reduce((sum, item) => sum + item.returnAmount, 0))}</strong>
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

