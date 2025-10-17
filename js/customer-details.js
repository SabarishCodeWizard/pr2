// Customer Details Page Functionality
document.addEventListener('DOMContentLoaded', async function () {
    // Initialize database
    await db.init();

    // Load customer data
    loadCustomerData();

    // Add event listeners
    document.getElementById('searchCustomerBtn').addEventListener('click', loadCustomerData);
    document.getElementById('clearSearch').addEventListener('click', clearSearch); // ADDED THIS LINE
    document.getElementById('filterStatus').addEventListener('change', loadCustomerData);
    document.getElementById('exportCustomers').addEventListener('click', exportCustomersToPDF);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Search on enter key
    document.getElementById('searchCustomer').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            loadCustomerData();
        }
    });
});

// Clear search and filters
function clearSearch() {
    document.getElementById('searchCustomer').value = '';
    document.getElementById('filterStatus').value = 'all';
    loadCustomerData();
    
    // Show confirmation message
    showNotification('Search cleared successfully!', 'success');
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notification if any
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Add styles for notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        padding: 15px 20px;
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 15px;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    `;
    
    // Add close button styles
    notification.querySelector('button').style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}

// Add CSS animation for notification
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Load and display customer data
async function loadCustomerData() {
    try {
        const invoices = await db.getAllInvoices();
        const customers = groupInvoicesByCustomer(invoices);

        displaySummaryCards(customers);
        displayCustomersList(customers);
    } catch (error) {
        console.error('Error loading customer data:', error);
        alert('Error loading customer data.');
    }
}

// ... rest of your existing functions remain the same ...
// Group invoices by customer
function groupInvoicesByCustomer(invoices) {
    const customersMap = new Map();

    invoices.forEach(invoice => {
        const customerKey = invoice.customerName.toLowerCase().trim();
        
        if (!customersMap.has(customerKey)) {
            customersMap.set(customerKey, {
                name: invoice.customerName,
                phone: invoice.customerPhone,
                address: invoice.customerAddress,
                totalInvoices: 0,
                totalAmount: 0,
                totalPaid: 0,
                totalDue: 0,
                invoices: [],
                lastInvoiceDate: ''
            });
        }

        const customer = customersMap.get(customerKey);
        customer.totalInvoices++;
        customer.totalAmount += invoice.grandTotal;
        customer.totalPaid += invoice.amountPaid;
        customer.totalDue += invoice.balanceDue;
        customer.invoices.push(invoice);
        
        // Update last invoice date
        const invoiceDate = new Date(invoice.invoiceDate);
        if (!customer.lastInvoiceDate || invoiceDate > new Date(customer.lastInvoiceDate)) {
            customer.lastInvoiceDate = invoice.invoiceDate;
        }
    });

    // Convert map to array and sort by total due (highest first)
    return Array.from(customersMap.values()).sort((a, b) => b.totalDue - a.totalDue);
}

// Display summary cards
function displaySummaryCards(customers) {
    const totalCustomers = customers.length;
    const totalAmount = customers.reduce((sum, customer) => sum + customer.totalAmount, 0);
    const totalPaid = customers.reduce((sum, customer) => sum + customer.totalPaid, 0);
    const totalDue = customers.reduce((sum, customer) => sum + customer.totalDue, 0);

    document.getElementById('summaryCards').innerHTML = `
        <div class="summary-card total-customers">
            <h3>Total Customers</h3>
            <div class="summary-value">${totalCustomers}</div>
            <div class="summary-label">Registered Customers</div>
        </div>
        <div class="summary-card total-amount">
            <h3>Total Business</h3>
            <div class="summary-value">₹${Utils.formatCurrency(totalAmount)}</div>
            <div class="summary-label">Overall Amount</div>
        </div>
        <div class="summary-card paid-amount">
            <h3>Amount Received</h3>
            <div class="summary-value">₹${Utils.formatCurrency(totalPaid)}</div>
            <div class="summary-label">Total Paid</div>
        </div>
        <div class="summary-card pending-amount">
            <h3>Pending Amount</h3>
            <div class="summary-value">₹${Utils.formatCurrency(totalDue)}</div>
            <div class="summary-label">Balance Due</div>
        </div>
    `;
}

// Display customers list
// Display customers list
function displayCustomersList(customers) {
    const searchTerm = document.getElementById('searchCustomer').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;

    let filteredCustomers = customers;

    // Apply search filter
    if (searchTerm) {
        filteredCustomers = filteredCustomers.filter(customer =>
            customer.name.toLowerCase().includes(searchTerm)
        );
    }

    // Apply status filter
    if (filterStatus === 'pending') {
        filteredCustomers = filteredCustomers.filter(customer => customer.totalDue > 0);
    } else if (filterStatus === 'paid') {
        filteredCustomers = filteredCustomers.filter(customer => customer.totalDue === 0);
    } else if (filterStatus === 'overdue') {
        // You can implement overdue logic based on invoice dates
        filteredCustomers = filteredCustomers.filter(customer => customer.totalDue > 0);
    }

    const customersList = document.getElementById('customersList');

    if (filteredCustomers.length === 0) {
        customersList.innerHTML = `
            <div class="no-customers">
                <i class="fas fa-users fa-3x" style="margin-bottom: 20px; color: #bdc3c7;"></i>
                <h3>No Customers Found</h3>
                <p>No customers match your search criteria.</p>
            </div>
        `;
        return;
    }

    customersList.innerHTML = filteredCustomers.map(customer => {
        const status = customer.totalDue === 0 ? 'paid' : (customer.totalPaid > 0 ? 'partial' : 'pending');
        const statusText = customer.totalDue === 0 ? 'Paid' : (customer.totalPaid > 0 ? 'Partial' : 'Pending');
        
        return `
            <div class="customer-item ${status}">
                <div class="customer-header">
                    <div>
                        <h3 class="customer-name">
                            ${customer.name}
                            <span class="status-badge status-${status}">${statusText}</span>
                        </h3>
                        <p class="customer-contact">
                            <i class="fas fa-phone"></i> ${customer.phone || 'Not provided'} 
                            | <i class="fas fa-map-marker-alt"></i> ${customer.address || 'Address not provided'}
                        </p>
                        <p class="customer-contact">
                            <i class="fas fa-file-invoice"></i> Last Invoice: ${new Date(customer.lastInvoiceDate).toLocaleDateString('en-IN')}
                        </p>
                    </div>
                </div>
                
                <div class="customer-stats">
                    <div class="stat">
                        <div class="stat-value">${customer.totalInvoices}</div>
                        <div class="stat-label">Total Invoices</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">₹${Utils.formatCurrency(customer.totalAmount)}</div>
                        <div class="stat-label">Total Amount</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">₹${Utils.formatCurrency(customer.totalPaid)}</div>
                        <div class="stat-label">Amount Paid</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">₹${Utils.formatCurrency(customer.totalDue)}</div>
                        <div class="stat-label">Balance Due</div>
                    </div>
                </div>
                
                <div class="customer-actions">
                    <button class="btn-view-invoices" onclick="viewCustomerInvoices('${customer.name}')">
                        <i class="fas fa-list"></i> View Invoices (${customer.totalInvoices})
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// View customer invoices
function viewCustomerInvoices(customerName) {
    // Redirect to invoice history with customer filter
    window.location.href = `invoice-history.html?customer=${encodeURIComponent(customerName)}`;
}

// Generate customer statement
async function generateCustomerStatement(customerName) {
    try {
        const invoices = await db.getAllInvoices();
        const customerInvoices = invoices.filter(invoice =>
            invoice.customerName.toLowerCase().includes(customerName.toLowerCase())
        );

        if (customerInvoices.length === 0) {
            alert('No invoices found for this customer.');
            return;
        }

        // Use the existing function from invoice-history.js
        if (typeof generateCombinedPDFStatement === 'function') {
            await generateCombinedPDFStatement(customerName, customerInvoices);
        } else {
            alert('Statement generation function not available.');
        }
    } catch (error) {
        console.error('Error generating customer statement:', error);
        alert('Error generating statement.');
    }
}

// Export customers to PDF
async function exportCustomersToPDF() {
    try {
        const invoices = await db.getAllInvoices();
        const customers = groupInvoicesByCustomer(invoices);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        let yPos = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;

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
        doc.text('CUSTOMER DATABASE REPORT', pageWidth / 2, yPos, { align: 'center' });
        yPos += 15;

        // Add report info
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Report Date: ${new Date().toLocaleDateString('en-IN')}`, margin, yPos);
        doc.text(`Total Customers: ${customers.length}`, margin, yPos + 5);
        yPos += 15;

        // Create customer table
        const tableHeaders = [['Customer Name', 'Invoices', 'Total Amount', 'Amount Paid', 'Balance Due', 'Status']];
        const tableData = customers.map(customer => [
            customer.name.length > 20 ? customer.name.substring(0, 20) + '...' : customer.name,
            customer.totalInvoices.toString(),
            Utils.formatCurrency(customer.totalAmount),
            Utils.formatCurrency(customer.totalPaid),
            Utils.formatCurrency(customer.totalDue),
            customer.totalDue === 0 ? 'Paid' : 'Pending'
        ]);

        doc.autoTable({
            startY: yPos,
            head: tableHeaders,
            body: tableData,
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
                0: { cellWidth: 40 },
                1: { cellWidth: 20 },
                2: { cellWidth: 25 },
                3: { cellWidth: 25 },
                4: { cellWidth: 25 },
                5: { cellWidth: 20 }
            },
            margin: { left: margin, right: margin },
            didDrawCell: function (data) {
                // Color balance due in red if pending
                if (data.column.index === 4 && data.cell.raw !== '' && parseFloat(data.cell.raw) > 0) {
                    doc.setTextColor(255, 0, 0);
                } else {
                    doc.setTextColor(0, 0, 0);
                }
            }
        });

        // Add footer
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('This is a computer-generated customer database report.', pageWidth / 2, finalY, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, finalY + 4, { align: 'center' });

        // Save the PDF
        doc.save(`Customer_Database_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (error) {
        console.error('Error exporting customers to PDF:', error);
        alert('Error exporting customer data.');
    }
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = 'login.html';
    }
}