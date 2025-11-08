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


// Customer Details Page Functionality
document.addEventListener('DOMContentLoaded', async function () {

    if (!checkAuthentication()) {
        return;
    }

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
        const customers = await processCustomerData(invoices); // Made async

        updateStatistics(customers);
        displayCustomers(customers);
    } catch (error) {
        console.error('Error loading customers:', error);
        alert('Error loading customer data.');
    }
}

// Process invoice data to get customer summaries - Updated for returns
async function processCustomerData(invoices) {
    const customerMap = new Map();

    // First, process all invoices
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
                totalReturns: 0, // Added for returns
                adjustedBalanceDue: 0, // Added for returns
                allInvoiceNumbers: [],
                invoices: []
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

    // After processing all invoices, calculate returns and adjusted balances
    const customers = Array.from(customerMap.values());

    // Calculate returns for each customer
    for (let customer of customers) {
        // Sort invoices by invoice number (newest first)
        customer.invoices.sort((a, b) => {
            const numA = parseInt(a.invoiceNo) || 0;
            const numB = parseInt(b.invoiceNo) || 0;
            return numB - numA;
        });

        // Calculate total returns for this customer
        customer.totalReturns = 0;
        try {
            for (let invoice of customer.invoices) {
                const returns = await db.getReturnsByInvoice(invoice.invoiceNo);
                const invoiceReturns = returns.reduce((sum, returnItem) => sum + returnItem.returnAmount, 0);
                customer.totalReturns += invoiceReturns;
            }
        } catch (error) {
            console.error('Error calculating returns for customer:', customer.name, error);
            // If there's an error (like returns store doesn't exist), set returns to 0
            customer.totalReturns = 0;
        }

        // Set balance due to the most recent invoice's balance due
        if (customer.invoices.length > 0) {
            customer.balanceDue = customer.invoices[0].balanceDue;
            customer.adjustedBalanceDue = customer.balanceDue - customer.totalReturns;
        }

        // Sort invoice numbers in descending order (newest first)
        customer.allInvoiceNumbers.sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            return numB - numA;
        });

        // Remove the invoices array as we don't need it anymore
        delete customer.invoices;
    }

    return customers;
}

// Update statistics cards with color coding - Updated for returns
function updateStatistics(customers) {
    const totalCustomers = customers.length;
    const totalInvoices = customers.reduce((sum, customer) => sum + customer.totalInvoices, 0);
    const totalCurrentBillAmount = customers.reduce((sum, customer) => sum + customer.totalCurrentBillAmount, 0);
    const totalPaid = customers.reduce((sum, customer) => sum + customer.amountPaid, 0);
    const totalReturns = customers.reduce((sum, customer) => sum + customer.totalReturns, 0);

    // CORRECTED: Calculate pending balance as (Total Amount - Total Paid - Total Returns)
    const pendingBalance = totalCurrentBillAmount - totalPaid - totalReturns;

    // Update the values
    document.getElementById('totalCustomers').textContent = totalCustomers.toLocaleString();
    document.getElementById('totalInvoices').textContent = totalInvoices.toLocaleString();
    document.getElementById('totalRevenue').textContent = `₹${Utils.formatCurrency(totalCurrentBillAmount)}`;
    document.getElementById('totalPaid').textContent = `₹${Utils.formatCurrency(totalPaid)}`;

    // Add returns statistics if there are returns
    if (totalReturns > 0) {
        // Create or update returns statistics card
        let returnsCard = document.getElementById('totalReturns');
        if (!returnsCard) {
            const statsCards = document.querySelector('.stats-cards');
            const returnsHTML = `
                <div class="stat-card" id="totalReturns">
                    <div class="stat-icon">
                        <i class="fas fa-undo"></i>
                    </div>
                    <div class="stat-info">
                        <h3 id="totalReturnsValue">-₹${Utils.formatCurrency(totalReturns)}</h3>
                        <p>Total Returns</p>
                    </div>
                </div>
            `;
            // Insert before pending balance card
            const pendingBalanceCard = document.querySelector('.stat-card:last-child');
            pendingBalanceCard.insertAdjacentHTML('beforebegin', returnsHTML);
            returnsCard = document.getElementById('totalReturns');
            returnsCard.classList.add('negative-value');
        } else {
            document.getElementById('totalReturnsValue').textContent = `-₹${Utils.formatCurrency(totalReturns)}`;
        }
    } else {
        // Remove returns card if no returns
        const returnsCard = document.getElementById('totalReturns');
        if (returnsCard) {
            returnsCard.remove();
        }
    }

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

    // Total Returns - always negative (red)
    const returnsCard = document.getElementById('totalReturns');
    if (returnsCard) {
        returnsCard.classList.add('negative-value');
    }

    // Pending Balance - color based on value
    const pendingBalanceCard = document.querySelector('.stat-card:last-child');
    if (pendingBalance > 0) {
        pendingBalanceCard.classList.add('negative-value');
    } else if (pendingBalance < 0) {
        pendingBalanceCard.classList.add('positive-value');
    } else {
        pendingBalanceCard.classList.add('neutral-value');
    }
}

// Update the displayCustomers function to hide phone numbers
function displayCustomers(customers) {
    const tableBody = document.getElementById('customerTableBody');
    const noCustomers = document.getElementById('noCustomers');

    if (customers.length === 0) {
        tableBody.innerHTML = '';
        noCustomers.style.display = 'block';
        return;
    }

    noCustomers.style.display = 'none';

    tableBody.innerHTML = customers.map(customer => {
        const customerBalance = customer.totalCurrentBillAmount - customer.amountPaid - customer.totalReturns;

        // Only show WhatsApp button if customer has balance and phone number
        const showWhatsApp = customerBalance > 0 && customer.phone;

        // Format phone number to show only last 3 digits
        const formattedPhone = customer.phone ? formatPhoneNumber(customer.phone) : 'N/A';

        return `
        <tr>
            <td>
                <div class="customer-name">
                    <i class="fas fa-user"></i>
                    ${customer.name}
                    ${customer.totalReturns > 0 ? `<span class="customer-return-badge" title="This customer has returns">🔄</span>` : ''}
                </div>
            </td>
            <td class="phone-number" title="Click to reveal full number" onclick="togglePhoneNumber(this, '${customer.phone || ''}')">
                ${formattedPhone}
            </td>
            <td title="${customer.address || 'N/A'}">
                ${customer.address ? (customer.address.length > 30 ? customer.address.substring(0, 30) + '...' : customer.address) : 'N/A'}
            </td>
            <td>${customer.totalInvoices}</td>
            <td>
                <div class="invoice-numbers" title="Click to view all invoice numbers">
                    <span class="invoice-count">${customer.totalInvoices} invoices</span>
                    <div class="invoice-numbers-list">
                        ${customer.allInvoiceNumbers.map(invoiceNo =>
            `<span class="invoice-number-badge" 
                                  onclick="viewInvoice('${invoiceNo}')"
                                  onmouseenter="showInvoicePopup('${invoiceNo}', this)"
                                  onmouseleave="setTimeout(() => closeInvoicePopup(), 100)">
                                #${invoiceNo}
                            </span>`
        ).join('')}
                    </div>
                </div>
            </td>
            <td class="amount-positive">₹${Utils.formatCurrency(customer.totalCurrentBillAmount)}</td>
            <td class="amount-positive">₹${Utils.formatCurrency(customer.amountPaid)}</td>
            <td class="${customer.totalReturns > 0 ? 'amount-negative' : 'amount-neutral'}">
                ${customer.totalReturns > 0 ? `-₹${Utils.formatCurrency(customer.totalReturns)}` : '₹0.00'}
            </td>
            <td class="${customerBalance > 0 ? 'amount-negative' : (customerBalance < 0 ? 'amount-positive' : 'amount-neutral')}">
                ₹${Utils.formatCurrency(customerBalance)}
            </td>
            <td>
                ${showWhatsApp ? `
                <button class="whatsapp-reminder-btn" onclick="openReminderModal(${JSON.stringify(customer).replace(/"/g, '&quot;')})">
                    <i class="fab fa-whatsapp"></i> Send Reminder
                </button>
                ` : '<span class="no-reminder">No balance/phone</span>'}
            </td>
        </tr>
    `}).join('');
}

// Add this utility function to format phone numbers
function formatPhoneNumber(phone) {
    if (!phone) return 'N/A';

    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');

    if (cleanPhone.length <= 3) {
        return cleanPhone;
    }

    // Show last 3 digits, mask the rest with asterisks
    const visibleDigits = 3;
    const maskedPart = '*'.repeat(cleanPhone.length - visibleDigits);
    const visiblePart = cleanPhone.slice(-visibleDigits);

    return maskedPart + visiblePart;
}

// Add function to toggle phone number visibility
function togglePhoneNumber(element, fullPhoneNumber) {
    if (!fullPhoneNumber || fullPhoneNumber === 'N/A') return;

    const currentText = element.textContent;
    const cleanFullPhone = fullPhoneNumber.replace(/\D/g, '');

    // If currently showing masked version, show full number
    if (currentText.includes('*')) {
        element.textContent = cleanFullPhone;
        element.classList.add('phone-revealed');

        // Auto hide after 5 seconds
        setTimeout(() => {
            if (element.classList.contains('phone-revealed')) {
                element.textContent = formatPhoneNumber(fullPhoneNumber);
                element.classList.remove('phone-revealed');
            }
        }, 5000);
    } else {
        // If showing full number, mask it
        element.textContent = formatPhoneNumber(fullPhoneNumber);
        element.classList.remove('phone-revealed');
    }
}


// View specific invoice - redirect to invoice-history page with search filter
function viewInvoice(invoiceNo) {
    // Redirect to invoice-history page with the invoice number as search parameter
    window.location.href = `invoice-history.html?search=${invoiceNo}`;
}

// Show invoice details popup on hover - Updated with returns information
async function showInvoicePopup(invoiceNo, element) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        if (!invoiceData) return;

        // Calculate previous balance and returns
        const previousBalance = invoiceData.grandTotal - invoiceData.subtotal;
        const totalReturns = await Utils.calculateTotalReturns(invoiceNo);
        const adjustedBalanceDue = invoiceData.balanceDue - totalReturns;


        // Format phone number for display
        const formattedPhone = invoiceData.customerPhone ? formatPhoneNumber(invoiceData.customerPhone) : 'N/A';


        // Create popup element
        const popup = document.createElement('div');
        popup.className = 'invoice-popup';
        popup.innerHTML = `
            <div class="invoice-popup-content">
                <div class="popup-header">
                    <h4>Invoice #${invoiceData.invoiceNo}</h4>
                    <button class="popup-close" onclick="closeInvoicePopup()">&times;</button>
                </div>
                <div class="popup-body">
                    <div class="customer-info">
                        <strong>${invoiceData.customerName}</strong>
                        <div class="customer-details">
                            ${invoiceData.customerPhone ? `
                                <div class="phone-display" onclick="togglePopupPhone(this, '${invoiceData.customerPhone}')">
                                    📞 ${formattedPhone}
                                </div>
                            ` : ''}
                            ${invoiceData.customerAddress ? `<div>📍 ${invoiceData.customerAddress}</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="invoice-details">
                        <div class="detail-row">
                            <span>Date:</span>
                            <span>${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div class="detail-row">
                            <span>Current Bill:</span>
                            <span>₹${Utils.formatCurrency(invoiceData.subtotal)}</span>
                        </div>
                        <div class="detail-row">
                            <span>Previous Balance:</span>
                            <span>₹${Utils.formatCurrency(previousBalance)}</span>
                        </div>
                        <div class="detail-row">
                            <span>Total Amount:</span>
                            <span>₹${Utils.formatCurrency(invoiceData.grandTotal)}</span>
                        </div>
                        <div class="detail-row">
                            <span>Amount Paid:</span>
                            <span class="amount-paid">₹${Utils.formatCurrency(invoiceData.amountPaid)}</span>
                        </div>
                        ${totalReturns > 0 ? `
                        <div class="detail-row">
                            <span>Return Amount:</span>
                            <span class="amount-return">-₹${Utils.formatCurrency(totalReturns)}</span>
                        </div>
                        ` : ''}
                        <div class="detail-row">
                            <span>${totalReturns > 0 ? 'Adjusted Balance Due:' : 'Balance Due:'}</span>
                            <span class="${adjustedBalanceDue > 0 ? 'amount-due' : 'amount-paid'}">
                                ₹${Utils.formatCurrency(totalReturns > 0 ? adjustedBalanceDue : invoiceData.balanceDue)}
                            </span>
                        </div>
                        ${invoiceData.paymentMethod ? `
                        <div class="detail-row">
                            <span>Payment Method:</span>
                            <span class="payment-method ${invoiceData.paymentMethod}">
                                ${invoiceData.paymentMethod.toUpperCase()}
                            </span>
                        </div>
                        ` : ''}
                    </div>

                    ${invoiceData.products && invoiceData.products.length > 0 ? `
                    <div class="products-preview">
                        <strong>Products (${invoiceData.products.length}):</strong>
                        <div class="products-list">
                            ${invoiceData.products.slice(0, 3).map(product => `
                                <div class="product-item">
                                    <span class="product-desc">${product.description}</span>
                                    <span class="product-qty">${product.qty} × ₹${Utils.formatCurrency(product.rate)}</span>
                                </div>
                            `).join('')}
                            ${invoiceData.products.length > 3 ?
                    `<div class="more-products">+ ${invoiceData.products.length - 3} more items</div>` : ''}
                        </div>
                    </div>
                    ` : ''}

                    ${totalReturns > 0 ? `
                    <div class="returns-preview">
                        <strong>Returns Processed: ₹${Utils.formatCurrency(totalReturns)}</strong>
                        <button class="btn-view-returns" onclick="viewReturnStatus('${invoiceNo}')">
                            <i class="fas fa-history"></i> View Return Details
                        </button>
                    </div>
                    ` : ''}
                </div>
                <div class="popup-actions">
                    <button class="btn-view-full" onclick="viewInvoice('${invoiceData.invoiceNo}')">
                        <i class="fas fa-external-link-alt"></i> View on Invoice Page
                    </button>
                    <button class="btn-share" onclick="shareInvoiceViaWhatsApp('${invoiceData.invoiceNo}')">
                        <i class="fab fa-whatsapp"></i> Share
                    </button>
                    ${totalReturns === 0 ? `
                    <button class="btn-return" onclick="addReturn('${invoiceData.invoiceNo}')">
                        <i class="fas fa-undo"></i> Process Return
                    </button>
                    ` : ''}
                </div>
            </div>
        `;

        // Position the popup in top-left corner of the screen
        popup.style.position = 'fixed';
        popup.style.left = '20px';
        popup.style.top = '20px';
        popup.style.zIndex = '1000';

        document.body.appendChild(popup);

        // Close popup when clicking outside
        const closeOnClickOutside = (e) => {
            if (!popup.contains(e.target) && e.target !== element) {
                closeInvoicePopup();
                document.removeEventListener('click', closeOnClickOutside);
            }
        };

        // Add slight delay to prevent immediate close
        setTimeout(() => {
            document.addEventListener('click', closeOnClickOutside);
        }, 100);

    } catch (error) {
        console.error('Error loading invoice details:', error);
    }
}


// Add function for toggling phone in popup
function togglePopupPhone(element, fullPhoneNumber) {
    const currentText = element.textContent.replace('📞 ', '');
    const cleanFullPhone = fullPhoneNumber.replace(/\D/g, '');
    
    if (currentText.includes('*')) {
        element.textContent = '📞 ' + cleanFullPhone;
        element.classList.add('phone-revealed');
    } else {
        element.textContent = '📞 ' + formatPhoneNumber(fullPhoneNumber);
        element.classList.remove('phone-revealed');
    }
}

// Close invoice popup
function closeInvoicePopup() {
    const popup = document.querySelector('.invoice-popup');
    if (popup) {
        popup.remove();
    }
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
        let customers = await processCustomerData(invoices); // Made async

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

// Export customers function (placeholder - implement as needed)
async function exportCustomers() {
    try {
        const invoices = await db.getAllInvoices();
        const customers = await processCustomerData(invoices);

        // Convert to CSV or implement your export logic here
        console.log('Exporting customers:', customers);
        alert('Export feature to be implemented');

    } catch (error) {
        console.error('Error exporting customers:', error);
        alert('Error exporting customer data.');
    }
}

// // Logout function
// function logout() {
//     if (confirm('Are you sure you want to logout?')) {
//         window.location.href = 'login.html';
//     }
// }

// Add these CSS styles for the new elements
const returnStyles = `
    .customer-return-badge {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 50%;
        padding: 2px 5px;
        font-size: 10px;
        margin-left: 5px;
        cursor: help;
    }

    .amount-return {
        color: #dc3545 !important;
        font-weight: 600;
    }

    .returns-preview {
        margin-top: 15px;
        padding: 10px;
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 6px;
    }

    .btn-view-returns {
        background: #17a2b8;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .btn-view-returns:hover {
        background: #138496;
    }

    .btn-return {
        background: #ffc107;
        color: #212529;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
    }

    .btn-return:hover {
        background: #e0a800;
    }

    .stat-card.returns-value .stat-icon {
        background: linear-gradient(135deg, #dc3545, #e74c3c) !important;
    }
`;

// Add the styles to the document
const style = document.createElement('style');
style.textContent = returnStyles;
document.head.appendChild(style);


// WhatsApp Reminder Functions
function createWhatsAppReminderButton(customer) {
    const button = document.createElement('button');
    button.className = 'whatsapp-reminder-btn';
    button.innerHTML = '<i class="fab fa-whatsapp"></i> Send Reminder';
    button.onclick = () => openReminderModal(customer);
    return button;
}

function openReminderModal(customer) {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.id = 'reminderModal';

    // Calculate customer balance
    const customerBalance = customer.totalCurrentBillAmount - customer.amountPaid - customer.totalReturns;

    modalOverlay.innerHTML = `
        <div class="reminder-modal">
            <div class="modal-header">
                <h3><i class="fab fa-whatsapp"></i> Send WhatsApp Reminder</h3>
                <button class="close-modal">&times;</button>
            </div>
            
            <div class="modal-body">
                <div class="customer-info">
                    <h4>Customer: ${customer.name}</h4>
                    <p>Phone: ${customer.phone || 'Not provided'}</p>
                    <p>Balance Due: <strong>₹${Utils.formatCurrency(customerBalance)}</strong></p>
                </div>
                
                <div class="template-selection">
                    <label>Select Reminder Template:</label>
                    <select id="reminderTemplate" class="template-select">
                        <option value="standard">Standard Payment Reminder</option>
                        <option value="urgent">Urgent Payment Required</option>
                        <option value="friendly">Friendly Follow-up</option>
                        <option value="custom">Custom Message</option>
                    </select>
                </div>
                
                <div class="message-preview">
                    <label>Message Preview:</label>
                    <div class="preview-box" id="messagePreview">
                        ${generateReminderMessage(customer, 'standard')}
                    </div>
                </div>
                
                <div class="custom-message" id="customMessageSection" style="display: none;">
                    <label>Custom Message:</label>
                    <textarea id="customMessage" placeholder="Type your custom message here..." rows="4"></textarea>
                </div>
                
                <div class="message-stats">
                    <div class="stat-item">
                        <span>Characters:</span>
                        <span id="charCount">0</span>
                    </div>
                    <div class="stat-item">
                        <span>Messages:</span>
                        <span id="messageCount">0</span>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button class="btn-secondary" id="testMessage">
                    <i class="fas fa-eye"></i> Test Preview
                </button>
                <button class="btn-primary" id="sendWhatsApp">
                    <i class="fab fa-whatsapp"></i> Open in WhatsApp
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    // Add event listeners
    setupReminderModalEvents(customer);
}

function setupReminderModalEvents(customer) {
    const modal = document.getElementById('reminderModal');
    const templateSelect = document.getElementById('reminderTemplate');
    const customMessageSection = document.getElementById('customMessageSection');
    const customMessage = document.getElementById('customMessage');
    const messagePreview = document.getElementById('messagePreview');
    const charCount = document.getElementById('charCount');
    const messageCount = document.getElementById('messageCount');
    const testMessageBtn = document.getElementById('testMessage');
    const sendWhatsAppBtn = document.getElementById('sendWhatsApp');
    const closeBtn = modal.querySelector('.close-modal');

    // Template selection handler
    templateSelect.addEventListener('change', function () {
        if (this.value === 'custom') {
            customMessageSection.style.display = 'block';
            updateMessageStats(customMessage.value);
        } else {
            customMessageSection.style.display = 'none';
            messagePreview.innerHTML = generateReminderMessage(customer, this.value);
            updateMessageStats(messagePreview.textContent);
        }
    });

    // Custom message handler
    customMessage.addEventListener('input', function () {
        if (templateSelect.value === 'custom') {
            messagePreview.textContent = this.value;
            updateMessageStats(this.value);
        }
    });

    // Test message handler
    testMessageBtn.addEventListener('click', function () {
        const message = templateSelect.value === 'custom'
            ? customMessage.value
            : generateReminderMessage(customer, templateSelect.value);

        // Show message in alert for testing
        alert('Message Preview:\n\n' + message);
    });

    // Send WhatsApp handler
    sendWhatsAppBtn.addEventListener('click', function () {
        const message = templateSelect.value === 'custom'
            ? customMessage.value
            : generateReminderMessage(customer, templateSelect.value);

        sendWhatsAppReminder(customer.phone, message);
    });

    // Close modal handlers
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Initialize stats
    updateMessageStats(messagePreview.textContent);
}

function generateReminderMessage(customer, templateType) {
    const customerBalance = customer.totalCurrentBillAmount - customer.amountPaid - customer.totalReturns;
    const hasReturns = customer.totalReturns > 0;

    let message = '';
    let subject = '';

    switch (templateType) {
        case 'standard':
            subject = 'Payment Reminder';
            message = `PR FABRICS - ${subject}

Dear ${customer.name},

Your outstanding balance is: ₹${Utils.formatCurrency(customerBalance)}

Payment Summary:
• Total Invoices: ${customer.totalInvoices}
• Total Amount: ₹${Utils.formatCurrency(customer.totalCurrentBillAmount)}
• Amount Paid: ₹${Utils.formatCurrency(customer.amountPaid)}${hasReturns ? `
• Returns: -₹${Utils.formatCurrency(customer.totalReturns)}` : ''}
• Balance Due: ₹${Utils.formatCurrency(customerBalance)}

Please make the payment at your earliest convenience.

PR FABRICS
42/65, THIRUNEELAKANDA PURAM, 1ST STREET
TIRUPUR 641-602
Phone: 9952520181

This is an automated reminder`;
            break;

        case 'urgent':
            subject = 'URGENT: Payment Required';
            message = `PR FABRICS - ${subject}

Dear ${customer.name},

URGENT: Your payment of ₹${Utils.formatCurrency(customerBalance)} is overdue.

Payment Summary:
• Total Invoices: ${customer.totalInvoices}
• Total Amount: ₹${Utils.formatCurrency(customer.totalCurrentBillAmount)}
• Amount Paid: ₹${Utils.formatCurrency(customer.amountPaid)}${hasReturns ? `
• Returns: -₹${Utils.formatCurrency(customer.totalReturns)}` : ''}
• Balance Due: ₹${Utils.formatCurrency(customerBalance)}

Please clear the outstanding amount immediately to avoid any inconvenience.

PR FABRICS
42/65, THIRUNEELAKANDA PURAM, 1ST STREET
TIRUPUR 641-602
Phone: 9952520181

*Urgent - Please respond immediately*`;
            break;

        case 'friendly':
            subject = 'Friendly Payment Follow-up';
            message = `PR FABRICS - ${subject}

Hi ${customer.name},

Hope you're doing well! This is a friendly reminder about your outstanding balance of ₹${Utils.formatCurrency(customerBalance)}.

Quick Summary:
• Invoices: ${customer.totalInvoices}
• Total: ₹${Utils.formatCurrency(customer.totalCurrentBillAmount)}
• Paid: ₹${Utils.formatCurrency(customer.amountPaid)}${hasReturns ? `
• Returns: -₹${Utils.formatCurrency(customer.totalReturns)}` : ''}
• Due: ₹${Utils.formatCurrency(customerBalance)}

Please let us know if you have any questions or need more time.

Best regards,
PR FABRICS Team
9952520181`;
            break;

        default:
            message = `PR FABRICS - Payment Reminder

Dear ${customer.name},

Your outstanding balance is ₹${Utils.formatCurrency(customerBalance)}.

Please make the payment at your earliest convenience.

PR FABRICS
9952520181`;
    }

    return message;
}

function updateMessageStats(message) {
    const charCount = document.getElementById('charCount');
    const messageCount = document.getElementById('messageCount');

    charCount.textContent = message.length;
    messageCount.textContent = Math.ceil(message.length / 160); // WhatsApp message segments
}

function sendWhatsAppReminder(phoneNumber, message) {
    if (!phoneNumber) {
        alert('Phone number not available for this customer.');
        return;
    }

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    // Add country code if not present (assuming India +91)
    let formattedPhone = cleanPhone;
    if (!formattedPhone.startsWith('91') && formattedPhone.length === 10) {
        formattedPhone = '91' + formattedPhone;
    }

    // URL encode the message
    const encodedMessage = encodeURIComponent(message);

    // Create WhatsApp URL
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    // Open in new tab
    window.open(whatsappUrl, '_blank');

    // Close modal
    const modal = document.getElementById('reminderModal');
    if (modal) modal.remove();

    // Log the action (you can save this to your database)
    console.log(`WhatsApp reminder sent to ${customer.name}: ${phoneNumber}`);
}

// Export customers to CSV
async function exportCustomers() {
    try {
        const invoices = await db.getAllInvoices();
        const customers = await processCustomerData(invoices);

        if (customers.length === 0) {
            alert('No customer data to export.');
            return;
        }

        // Create CSV content
        let csvContent = 'Customer Name,Phone,Address,Total Invoices,Total Amount,Amount Paid,Returns,Balance Due,Last Invoice,Last Invoice Date\n';

        customers.forEach(customer => {
            const customerBalance = customer.totalCurrentBillAmount - customer.amountPaid - customer.totalReturns;
            
            const row = [
                `"${customer.name.replace(/"/g, '""')}"`,
                `"${customer.phone || 'N/A'}"`,
                `"${(customer.address || 'N/A').replace(/"/g, '""')}"`,
                customer.totalInvoices,
                customer.totalCurrentBillAmount,
                customer.amountPaid,
                customer.totalReturns,
                customerBalance,
                customer.lastInvoiceNo || 'N/A',
                customer.lastInvoiceDate ? new Date(customer.lastInvoiceDate).toLocaleDateString('en-IN') : 'N/A'
            ].join(',');

            csvContent += row + '\n';
        });

        // Create and download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `PR_Fabrics_Customers_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Show success message
        showExportSuccess(customers.length);

    } catch (error) {
        console.error('Error exporting customers:', error);
        alert('Error exporting customer data. Please try again.');
    }
}

// Show export success message
function showExportSuccess(customerCount) {
    // Create success notification
    const notification = document.createElement('div');
    notification.className = 'export-notification success';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-check-circle"></i>
            <div class="notification-text">
                <strong>Export Successful!</strong>
                <p>Exported ${customerCount} customers to CSV file</p>
            </div>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Enhanced Export with Options (Alternative Version)
async function exportCustomersWithOptions() {
    try {
        const invoices = await db.getAllInvoices();
        const customers = await processCustomerData(invoices);

        if (customers.length === 0) {
            alert('No customer data to export.');
            return;
        }

        // Show export options modal
        showExportOptionsModal(customers);

    } catch (error) {
        console.error('Error exporting customers:', error);
        alert('Error exporting customer data. Please try again.');
    }
}

// Show export options modal
function showExportOptionsModal(customers) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="export-modal">
            <div class="modal-header">
                <h3><i class="fas fa-download"></i> Export Customer Data</h3>
                <button class="close-modal">&times;</button>
            </div>
            
            <div class="modal-body">
                <div class="export-options">
                    <div class="option-group">
                        <label>Export Format:</label>
                        <select id="exportFormat" class="export-select">
                            <option value="csv">CSV (Excel)</option>
                            <option value="json">JSON</option>
                        </select>
                    </div>
                    
                    <div class="option-group">
                        <label>Include Columns:</label>
                        <div class="checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" name="exportColumns" value="phone" checked> Phone Numbers
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="exportColumns" value="address" checked> Address
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="exportColumns" value="invoices" checked> Invoice Details
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="exportColumns" value="returns" checked> Return Information
                            </label>
                        </div>
                    </div>
                    
                    <div class="export-preview">
                        <label>Data Summary:</label>
                        <div class="preview-stats">
                            <div class="stat"><strong>${customers.length}</strong> Customers</div>
                            <div class="stat"><strong>${customers.reduce((sum, c) => sum + c.totalInvoices, 0)}</strong> Total Invoices</div>
                            <div class="stat"><strong>₹${Utils.formatCurrency(customers.reduce((sum, c) => sum + c.totalCurrentBillAmount, 0))}</strong> Total Amount</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button class="btn-secondary" id="cancelExport">Cancel</button>
                <button class="btn-primary" id="confirmExport">
                    <i class="fas fa-download"></i> Export Data
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners for export modal
    const closeBtn = modal.querySelector('.close-modal');
    const cancelBtn = modal.querySelector('#cancelExport');
    const confirmBtn = modal.querySelector('#confirmExport');

    closeBtn.addEventListener('click', () => modal.remove());
    cancelBtn.addEventListener('click', () => modal.remove());
    
    confirmBtn.addEventListener('click', () => {
        const format = modal.querySelector('#exportFormat').value;
        const selectedColumns = Array.from(modal.querySelectorAll('input[name="exportColumns"]:checked'))
            .map(input => input.value);
        
        modal.remove();
        performExport(customers, format, selectedColumns);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Perform the actual export based on options
function performExport(customers, format, columns) {
    let content, mimeType, fileExtension;

    if (format === 'csv') {
        // Generate CSV based on selected columns
        let csvContent = 'Customer Name';
        
        if (columns.includes('phone')) csvContent += ',Phone';
        if (columns.includes('address')) csvContent += ',Address';
        csvContent += ',Total Invoices,Total Amount,Amount Paid';
        if (columns.includes('returns')) csvContent += ',Returns';
        csvContent += ',Balance Due,Last Invoice,Last Invoice Date\n';

        customers.forEach(customer => {
            const customerBalance = customer.totalCurrentBillAmount - customer.amountPaid - customer.totalReturns;
            
            let row = [`"${customer.name.replace(/"/g, '""')}"`];
            
            if (columns.includes('phone')) row.push(`"${customer.phone || 'N/A'}"`);
            if (columns.includes('address')) row.push(`"${(customer.address || 'N/A').replace(/"/g, '""')}"`);
            
            row.push(
                customer.totalInvoices,
                customer.totalCurrentBillAmount,
                customer.amountPaid
            );
            
            if (columns.includes('returns')) row.push(customer.totalReturns);
            
            row.push(
                customerBalance,
                customer.lastInvoiceNo || 'N/A',
                customer.lastInvoiceDate ? new Date(customer.lastInvoiceDate).toLocaleDateString('en-IN') : 'N/A'
            );

            csvContent += row.join(',') + '\n';
        });

        content = csvContent;
        mimeType = 'text/csv;charset=utf-8;';
        fileExtension = 'csv';
    } else {
        // JSON export
        const exportData = customers.map(customer => {
            const data = {
                name: customer.name,
                totalInvoices: customer.totalInvoices,
                totalAmount: customer.totalCurrentBillAmount,
                amountPaid: customer.amountPaid,
                balanceDue: customer.totalCurrentBillAmount - customer.amountPaid - customer.totalReturns,
                lastInvoiceNo: customer.lastInvoiceNo,
                lastInvoiceDate: customer.lastInvoiceDate
            };

            if (columns.includes('phone')) data.phone = customer.phone;
            if (columns.includes('address')) data.address = customer.address;
            if (columns.includes('returns')) data.returns = customer.totalReturns;
            if (columns.includes('invoices')) data.invoiceNumbers = customer.allInvoiceNumbers;

            return data;
        });

        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json;charset=utf-8;';
        fileExtension = 'json';
    }

    // Download file
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `PR_Fabrics_Customers_${timestamp}.${fileExtension}`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showExportSuccess(customers.length);
}