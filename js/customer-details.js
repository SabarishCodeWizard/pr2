// Customer Details Page Functionality
document.addEventListener('DOMContentLoaded', async function () {
    // Initialize database
    await db.init();

    // Load all customers
    loadAllCustomers();

    // Add event listeners
    document.getElementById('searchBtn').addEventListener('click', searchCustomers);
    document.getElementById('clearSearch').addEventListener('click', clearSearch);
    document.getElementById('refreshBtn').addEventListener('click', loadAllCustomers);
    document.getElementById('exportBtn').addEventListener('click', exportCustomers);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Search on Enter key
    document.getElementById('customerSearch').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            searchCustomers();
        }
    });
});

// Load all customers with statistics
async function loadAllCustomers() {
    try {
        const invoices = await db.getAllInvoices();
        const customers = processCustomerData(invoices);
        
        updateStatistics(customers);
        displayCustomers(customers);
    } catch (error) {
        console.error('Error loading customers:', error);
        alert('Error loading customer data.');
    }
}

// Process invoice data to get customer summaries
function processCustomerData(invoices) {
    const customerMap = new Map();

    invoices.forEach(invoice => {
        const customerName = invoice.customerName;
        
        if (!customerMap.has(customerName)) {
            customerMap.set(customerName, {
                name: customerName,
                phone: invoice.customerPhone,
                address: invoice.customerAddress,
                totalInvoices: 0,
                totalCurrentBillAmount: 0,
                totalAmount: 0,
                amountPaid: 0,
                balanceDue: 0,
                allInvoiceNumbers: [], // Store all invoice numbers
                invoices: [] // Store all invoices for this customer
            });
        }

        const customer = customerMap.get(customerName);
        customer.totalInvoices++;
        customer.totalCurrentBillAmount += invoice.subtotal;
        customer.totalAmount += invoice.grandTotal;
        customer.amountPaid += invoice.amountPaid;
        
        // Store invoice number and invoice data
        customer.allInvoiceNumbers.push(invoice.invoiceNo);
        customer.invoices.push(invoice);

        // Update last invoice info
        const invoiceDate = new Date(invoice.invoiceDate);
        if (!customer.lastInvoiceDate || invoiceDate > new Date(customer.lastInvoiceDate)) {
            customer.lastInvoiceDate = invoice.invoiceDate;
            customer.lastInvoiceNo = invoice.invoiceNo;
        }
    });

    // After processing all invoices, calculate the correct balance due and sort invoice numbers
    const customers = Array.from(customerMap.values());
    
    customers.forEach(customer => {
        // Sort invoices by invoice number (newest first) to get the most recent balance
        customer.invoices.sort((a, b) => {
            const numA = parseInt(a.invoiceNo) || 0;
            const numB = parseInt(b.invoiceNo) || 0;
            return numB - numA; // Descending order (newest first)
        });
        
        // Set balance due to the most recent invoice's balance due only
        if (customer.invoices.length > 0) {
            customer.balanceDue = customer.invoices[0].balanceDue;
        }
        
        // Sort invoice numbers in descending order (newest first)
        customer.allInvoiceNumbers.sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            return numB - numA;
        });
        
        // Remove the invoices array as we don't need it anymore
        delete customer.invoices;
    });

    return customers;
}


// Update statistics cards with color coding
function updateStatistics(customers) {
    const totalCustomers = customers.length;
    const totalInvoices = customers.reduce((sum, customer) => sum + customer.totalInvoices, 0);
    const totalCurrentBillAmount = customers.reduce((sum, customer) => sum + customer.totalCurrentBillAmount, 0);
    const totalPaid = customers.reduce((sum, customer) => sum + customer.amountPaid, 0);
    const pendingBalance = customers.reduce((sum, customer) => sum + customer.balanceDue, 0);

    // Update the values
    document.getElementById('totalCustomers').textContent = totalCustomers.toLocaleString();
    document.getElementById('totalInvoices').textContent = totalInvoices.toLocaleString();
    document.getElementById('totalRevenue').textContent = `₹${Utils.formatCurrency(totalCurrentBillAmount)}`;
    document.getElementById('totalPaid').textContent = `₹${Utils.formatCurrency(totalPaid)}`;
    document.getElementById('pendingBalance').textContent = `₹${Utils.formatCurrency(pendingBalance)}`;

    // Apply color coding to statistics cards
    const statsCards = document.querySelectorAll('.stat-card');
    
    // Total Customers - always positive
    statsCards[0].classList.add('positive-value');
    
    // Total Invoices - always positive
    statsCards[1].classList.add('positive-value');
    
    // Total Revenue - always positive
    statsCards[2].classList.add('positive-value');
    
    // Total Paid - always positive
    statsCards[3].classList.add('positive-value');
    
    // Pending Balance - color based on value
    if (pendingBalance > 0) {
        statsCards[4].classList.add('negative-value');
    } else if (pendingBalance < 0) {
        statsCards[4].classList.add('positive-value');
    } else {
        statsCards[4].classList.add('neutral-value');
    }
}

// Display customers in table
function displayCustomers(customers) {
    const tableBody = document.getElementById('customerTableBody');
    const noCustomers = document.getElementById('noCustomers');

    if (customers.length === 0) {
        tableBody.innerHTML = '';
        noCustomers.style.display = 'block';
        return;
    }

    noCustomers.style.display = 'none';

    tableBody.innerHTML = customers.map(customer => `
        <tr>
            <td>
                <div class="customer-name">
                    <i class="fas fa-user"></i>
                    ${customer.name}
                </div>
            </td>
            <td>${customer.phone || 'N/A'}</td>
            <td title="${customer.address || 'N/A'}">
                ${customer.address ? (customer.address.length > 30 ? customer.address.substring(0, 30) + '...' : customer.address) : 'N/A'}
            </td>
            <td>${customer.totalInvoices}</td>
            <td>
                <div class="invoice-numbers" title="Click to view all invoice numbers">
                    <span class="invoice-count">${customer.totalInvoices} invoices</span>
                    <div class="invoice-numbers-list">
                        ${customer.allInvoiceNumbers.map(invoiceNo => 
                            `<span class="invoice-number-badge" onclick="viewInvoice('${invoiceNo}')">#${invoiceNo}</span>`
                        ).join('')}
                    </div>
                </div>
            </td>
            <td class="amount-positive">₹${Utils.formatCurrency(customer.totalCurrentBillAmount)}</td>
            <td class="amount-positive">₹${Utils.formatCurrency(customer.amountPaid)}</td>
            <td class="${customer.balanceDue > 0 ? 'amount-negative' : (customer.balanceDue < 0 ? 'amount-positive' : 'amount-neutral')}">
                ₹${Utils.formatCurrency(customer.balanceDue)}
            </td>
            
    `).join('');
}

// View specific invoice
function viewInvoice(invoiceNo) {
    window.location.href = `invoice-history.html?search=${invoiceNo}`;
}

// Search customers
async function searchCustomers() {
    const searchTerm = document.getElementById('customerSearch').value.trim().toLowerCase();

    if (!searchTerm) {
        loadAllCustomers();
        return;
    }

    try {
        const invoices = await db.getAllInvoices();
        let customers = processCustomerData(invoices);

        // Filter customers based on search term
        customers = customers.filter(customer =>
            customer.name.toLowerCase().includes(searchTerm) ||
            (customer.phone && customer.phone.includes(searchTerm)) ||
            (customer.address && customer.address.toLowerCase().includes(searchTerm)) ||
            customer.allInvoiceNumbers.some(invoiceNo => invoiceNo.toLowerCase().includes(searchTerm))
        );

        updateStatistics(customers);
        displayCustomers(customers);
    } catch (error) {
        console.error('Error searching customers:', error);
        alert('Error searching customers.');
    }
}

// Clear search
function clearSearch() {
    document.getElementById('customerSearch').value = '';
    loadAllCustomers();
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = 'login.html';
    }
}