// Invoice history page functionality
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize database
    await db.init();
    
    // Load invoices
    loadInvoices();
    
    // Add event listeners
    document.getElementById('searchBtn').addEventListener('click', loadInvoices);
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
    document.getElementById('logoutBtn').addEventListener('click', logout);
});

// Load invoices with optional filters
async function loadInvoices() {
    try {
        const invoices = await db.getAllInvoices();
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const fromDate = document.getElementById('fromDate').value;
        const toDate = document.getElementById('toDate').value;
        
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
        
        // Sort by date (newest first)
        filteredInvoices.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
        
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
    
    invoicesList.innerHTML = invoices.map(invoice => `
        <div class="invoice-item">
            <div class="invoice-info">
                <h3>Invoice #${invoice.invoiceNo}</h3>
                <p><strong>Customer:</strong> ${invoice.customerName}</p>
                <p><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</p>
                <p><strong>Total Amount:</strong> ₹${Utils.formatCurrency(invoice.grandTotal)}</p>
                <p><strong>Amount Paid:</strong> ₹${Utils.formatCurrency(invoice.amountPaid)}</p>
                <p><strong>Balance Due:</strong> ₹${Utils.formatCurrency(invoice.balanceDue)}</p>
            </div>
            <div class="invoice-actions">
                <button class="btn-edit" onclick="editInvoice('${invoice.invoiceNo}')">Edit</button>
                <button class="btn-view" onclick="viewInvoice('${invoice.invoiceNo}')">View</button>
                <button class="btn-pdf" onclick="generateInvoicePDF('${invoice.invoiceNo}')">PDF</button>
                <button class="btn-payment" onclick="addPayment('${invoice.invoiceNo}')">Add Payment</button>
                <button class="btn-statement" onclick="generateStatement('${invoice.invoiceNo}')">Statement</button>
                <button class="btn-delete" onclick="deleteInvoice('${invoice.invoiceNo}')">Delete</button>
            </div>
        </div>
    `).join('');
}

// Clear filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
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

// Add payment to an invoice
async function addPayment(invoiceNo) {
    const amount = prompt('Enter payment amount:');
    if (amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0) {
        try {
            const invoiceData = await db.getInvoice(invoiceNo);
            if (invoiceData) {
                const paymentAmount = parseFloat(amount);
                const newAmountPaid = invoiceData.amountPaid + paymentAmount;
                
                // Update invoice with new payment
                invoiceData.amountPaid = newAmountPaid;
                invoiceData.balanceDue = invoiceData.grandTotal - newAmountPaid;
                
                await db.saveInvoice(invoiceData);
                
                // Save payment record
                const paymentData = {
                    invoiceNo: invoiceNo,
                    paymentDate: new Date().toISOString().split('T')[0],
                    amount: paymentAmount,
                    paymentType: 'additional'
                };
                await db.savePayment(paymentData);
                
                alert('Payment added successfully!');
                loadInvoices(); // Refresh the list
            } else {
                alert('Invoice not found!');
            }
        } catch (error) {
            console.error('Error adding payment:', error);
            alert('Error adding payment.');
        }
    } else if (amount !== null) {
        alert('Please enter a valid payment amount.');
    }
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
        
        // Subtotal
        doc.text('Subtotal:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(invoiceData.subtotal)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 6;
        
        // Discount
        doc.text(`Discount (${invoiceData.discount}%):`, margin, yPos);
        doc.text(`₹${Utils.formatCurrency(invoiceData.discountAmount)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 6;
        
        // Round Off
        doc.text('Round Off:', margin, yPos);
        doc.text(`₹${Utils.formatCurrency(invoiceData.roundOff)}`, pageWidth - margin, yPos, { align: 'right' });
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
            didDrawCell: function(data) {
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

// Generate payment table data with running balance
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
            `Payment - ${payment.paymentType === 'initial' ? 'Initial' : 'Additional'}`,
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