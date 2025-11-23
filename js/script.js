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

// Add a new product row
function addProductRow() {
    const tableBody = document.getElementById('productTableBody');
    const rowCount = tableBody.rows.length;
    const newRow = tableBody.insertRow();

    newRow.innerHTML = `
        <td>${rowCount + 1}</td>
        <td>
            <div class="product-description-container">
                <input type="text" class="product-description">
                <div class="autocomplete-dropdown"></div>
            </div>
        </td>
        <td><input type="number" class="qty" value="0" min="0" step="1"></td>
        <td><input type="number" class="rate" value="0.00" min="0" step="0.01"></td>
        <td class="amount">0.00</td>
        <td><button class="remove-row">X</button></td>
    `;

    // Add event listener to the remove button
    newRow.querySelector('.remove-row').addEventListener('click', function () {
        this.closest('tr').remove();
        updateRowNumbers();
        Utils.updateCalculations();
    });

    // Setup auto-completion for the new row
    setupAutoCompletionForRow(newRow);
}


// Update row amount based on quantity and rate
function updateRowAmount(row) {
    const qty = parseFloat(row.querySelector('.qty').value) || 0;
    const rate = parseFloat(row.querySelector('.rate').value) || 0;
    const amountCell = row.querySelector('.amount');
    amountCell.textContent = Utils.formatCurrency(qty * rate);
}

// Update row numbers after deletion
function updateRowNumbers() {
    const rows = document.querySelectorAll('#productTableBody tr');
    rows.forEach((row, index) => {
        row.cells[0].textContent = index + 1;
    });
}


// Auto-completion for product descriptions
function setupAutoCompletion() {
    const productInputs = document.querySelectorAll('.product-description');

    productInputs.forEach(input => {
        // Check if dropdown already exists
        let dropdown = input.parentNode.querySelector('.autocomplete-dropdown');

        if (!dropdown) {
            // Create dropdown container
            dropdown = document.createElement('div');
            dropdown.className = 'autocomplete-dropdown';

            // Wrap input in container for proper positioning
            const container = document.createElement('div');
            container.className = 'product-description-container';
            container.style.position = 'relative';

            input.parentNode.insertBefore(container, input);
            container.appendChild(input);
            container.appendChild(dropdown);
        }

        // Event listeners for auto-completion
        input.addEventListener('input', async (e) => {
            const value = e.target.value.trim();
            if (value.length >= 1) {
                await showAutoCompleteSuggestions(value, dropdown, input);
            } else {
                dropdown.style.display = 'none';
            }
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                dropdown.style.display = 'none';
            }, 200);
        });

        input.addEventListener('focus', async (e) => {
            const value = e.target.value.trim();
            if (value.length >= 1) {
                await showAutoCompleteSuggestions(value, dropdown, input);
            }
        });

        // Handle keyboard navigation
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                handleKeyboardNavigation(e.key, dropdown, input);
            } else if (e.key === 'Enter' && dropdown.style.display === 'block') {
                e.preventDefault();
                const selectedItem = dropdown.querySelector('.autocomplete-item.highlighted');
                if (selectedItem) {
                    input.value = selectedItem.dataset.full;
                    dropdown.style.display = 'none';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } else if (e.key === 'Escape') {
                dropdown.style.display = 'none';
            }
        });
    });
}

// Setup auto-completion for a specific row
function setupAutoCompletionForRow(row) {
    const input = row.querySelector('.product-description');
    const dropdown = row.querySelector('.autocomplete-dropdown');

    if (input && dropdown) {
        // Event listeners for auto-completion
        input.addEventListener('input', async (e) => {
            const value = e.target.value.trim();
            if (value.length >= 1) {
                await showAutoCompleteSuggestions(value, dropdown, input);
            } else {
                dropdown.style.display = 'none';
            }
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                dropdown.style.display = 'none';
            }, 200);
        });

        input.addEventListener('focus', async (e) => {
            const value = e.target.value.trim();
            if (value.length >= 1) {
                await showAutoCompleteSuggestions(value, dropdown, input);
            }
        });

        // Handle keyboard navigation
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                handleKeyboardNavigation(e.key, dropdown, input);
            } else if (e.key === 'Enter' && dropdown.style.display === 'block') {
                e.preventDefault();
                const selectedItem = dropdown.querySelector('.autocomplete-item.highlighted');
                if (selectedItem) {
                    input.value = selectedItem.dataset.full;
                    dropdown.style.display = 'none';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } else if (e.key === 'Escape') {
                dropdown.style.display = 'none';
            }
        });
    }
}

// Handle keyboard navigation in auto-complete dropdown
function handleKeyboardNavigation(key, dropdown, input) {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;

    let currentIndex = -1;
    items.forEach((item, index) => {
        if (item.classList.contains('highlighted')) {
            currentIndex = index;
            item.classList.remove('highlighted');
        }
    });

    if (key === 'ArrowDown') {
        currentIndex = (currentIndex + 1) % items.length;
    } else if (key === 'ArrowUp') {
        currentIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    }

    items[currentIndex].classList.add('highlighted');
    items[currentIndex].scrollIntoView({ block: 'nearest' });
}


// Update auto-completion with loading
async function showAutoCompleteSuggestions(query, dropdown, input) {
    try {
        // Show mini loading for auto-complete
        dropdown.innerHTML = '<div class="autocomplete-loading">Searching...</div>';
        dropdown.style.display = 'block';

        const shortcuts = await getAllShortcuts();

        if (shortcuts.length === 0) {
            console.log('No shortcuts found in database');
            dropdown.style.display = 'none';
            return;
        }

        const matches = shortcuts.filter(shortcut =>
            shortcut.shortcutKey.toLowerCase().includes(query.toLowerCase()) ||
            shortcut.fullDescription.toLowerCase().includes(query.toLowerCase())
        );

        console.log(`Found ${matches.length} matches for query: ${query}`);

        if (matches.length > 0) {
            dropdown.innerHTML = matches.map(shortcut => `
                <div class="autocomplete-item" data-shortcut="${shortcut.shortcutKey}" data-full="${shortcut.fullDescription}">
                    <strong>${shortcut.shortcutKey}</strong> → ${shortcut.fullDescription}
                </div>
            `).join('');

            dropdown.style.display = 'block';

            // Add click handlers for suggestions
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    input.value = item.dataset.full;
                    dropdown.style.display = 'none';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                });

                item.addEventListener('mouseenter', () => {
                    dropdown.querySelectorAll('.autocomplete-item').forEach(i => {
                        i.classList.remove('highlighted');
                    });
                    item.classList.add('highlighted');
                });
            });
        } else {
            dropdown.innerHTML = '<div class="autocomplete-no-results">No matching products found</div>';
            dropdown.style.display = 'block';

            // Hide after 1.5 seconds if no results
            setTimeout(() => {
                if (dropdown.style.display === 'block') {
                    dropdown.style.display = 'none';
                }
            }, 1500);
        }
    } catch (error) {
        console.error('Error loading auto-complete suggestions:', error);
        dropdown.innerHTML = '<div class="autocomplete-error">Error loading suggestions</div>';
        dropdown.style.display = 'block';

        setTimeout(() => {
            dropdown.style.display = 'none';
        }, 2000);
    }
}



// Update getAllShortcuts to use Firebase
async function getAllShortcuts() {
    try {
        // Ensure Firebase is initialized
        await db.ensureInitialized();

        // Get shortcuts from Firebase
        const querySnapshot = await db.firestore.collection('shortcuts').get();
        const shortcuts = [];

        querySnapshot.forEach((doc) => {
            shortcuts.push(doc.data());
        });

        // Sort shortcuts alphabetically by shortcut key
        return shortcuts.sort((a, b) => a.shortcutKey.localeCompare(b.shortcutKey));

    } catch (error) {
        console.error('Error getting shortcuts from Firebase:', error);
        return []; // Return empty array on error
    }
}


// Update saveBill function with loading
async function saveBill() {
    if (!Utils.validateForm()) {
        return;
    }

    try {
        showLoading('Saving Bill', 'Please wait while we save your invoice...');

        const invoiceData = await Utils.getFormData();
        const isEditing = !!invoiceData.invoiceNo;

        await db.saveInvoice(invoiceData);

        // Save/update customer details
        const phone = document.getElementById('customerPhone').value.trim();
        const name = document.getElementById('customerName').value.trim();
        const address = document.getElementById('customerAddress').value.trim();

        if (phone && phone.length >= 10) {
            await Utils.saveCustomerDetails(name, address, phone);
        }

        // Save individual payments
        const paymentBreakdown = invoiceData.paymentBreakdown;
        const totalPaid = invoiceData.amountPaid;

        if (totalPaid > 0) {
            // Save cash payment
            if (paymentBreakdown.cash > 0) {
                const cashPaymentData = {
                    invoiceNo: invoiceData.invoiceNo,
                    paymentDate: new Date().toISOString().split('T')[0],
                    amount: paymentBreakdown.cash,
                    paymentMethod: 'cash',
                    paymentType: 'initial'
                };
                await db.savePayment(cashPaymentData);
            }

            // Save UPI payment
            if (paymentBreakdown.upi > 0) {
                const upiPaymentData = {
                    invoiceNo: invoiceData.invoiceNo,
                    paymentDate: new Date().toISOString().split('T')[0],
                    amount: paymentBreakdown.upi,
                    paymentMethod: 'gpay',
                    paymentType: 'initial'
                };
                await db.savePayment(upiPaymentData);
            }

            // Save account payment
            if (paymentBreakdown.account > 0) {
                const accountPaymentData = {
                    invoiceNo: invoiceData.invoiceNo,
                    paymentDate: new Date().toISOString().split('T')[0],
                    amount: paymentBreakdown.account,
                    paymentMethod: 'account',
                    paymentType: 'initial'
                };
                await db.savePayment(accountPaymentData);
            }
        }

        // Refresh invoice number suggestions after saving
        await Utils.updateInvoiceNumberSuggestions();

        if (isEditing) {
            await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceData.invoiceNo);
        }

        hideLoading();
        showButtonSuccess('saveBill');

        // Show success message with details
        setTimeout(() => {
            alert(`Bill ${isEditing ? 'updated' : 'saved'} successfully!\nInvoice #: ${invoiceData.invoiceNo}\nCustomer: ${invoiceData.customerName}\nTotal Amount: ₹${Utils.formatCurrency(invoiceData.grandTotal)}`);
        }, 100);

    } catch (error) {
        hideLoading();
        console.error('Error saving bill:', error);
        alert('Error saving bill. Please try again.');
    }
}



// Update resetForm with loading
function resetForm() {
    if (confirm('Are you sure you want to reset the form? All unsaved data will be lost.')) {
        showLoading('Resetting Form', 'Clearing all fields...');

        setTimeout(() => {
            Utils.resetForm();
            hideLoading();

            // Refresh suggestions after reset
            setTimeout(() => {
                Utils.updateInvoiceNumberSuggestions();
            }, 100);
        }, 500);
    }
}



// Apply suggested invoice number
function applySuggestedInvoiceNumber() {
    const suggestedNumber = document.getElementById('nextInvoiceNo').dataset.suggestedNumber;
    if (suggestedNumber && suggestedNumber !== '-') {
        document.getElementById('invoiceNo').value = suggestedNumber;

        // Show confirmation feedback
        const applyBtn = document.getElementById('applySuggestion');
        const originalText = applyBtn.innerHTML;
        applyBtn.innerHTML = '<i class="fas fa-check"></i> Applied!';
        applyBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';

        setTimeout(() => {
            applyBtn.innerHTML = originalText;
            applyBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
        }, 2000);
    }
}



// Update loadInvoiceForEditing with loading
async function loadInvoiceForEditing(invoiceNo) {
    try {
        showLoading('Loading Invoice', `Loading invoice #${invoiceNo} for editing...`);

        const invoiceData = await db.getInvoice(invoiceNo);
        if (invoiceData) {
            Utils.setFormData(invoiceData);
            document.getElementById('invoiceNo').readOnly = true;

            hideLoading();
            showButtonSuccess('saveBill');
        } else {
            hideLoading();
            alert('Invoice not found!');
        }
    } catch (error) {
        hideLoading();
        console.error('Error loading invoice:', error);
        alert('Error loading invoice for editing.');
    }
}

// Main application logic
document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuthentication()) {
        return;
    }

    try {
        showLoading('Loading Billing System', 'Initializing database and loading form...');

        // Initialize database
        await db.init();

        // Load invoice number suggestions
        await Utils.updateInvoiceNumberSuggestions();

        // Set current date as default for invoice date
        document.getElementById('invoiceDate').valueAsDate = new Date();

        // Setup auto-completion
        setupAutoCompletion();

        // Re-setup auto-completion when new rows are added
        const originalAddProductRow = addProductRow;
        window.addProductRow = function () {
            originalAddProductRow();
            setupAutoCompletion();
        };

        // Add event listener for apply suggestion button
        document.getElementById('applySuggestion').addEventListener('click', applySuggestedInvoiceNumber);

        // Add event listeners
        document.getElementById('addRow').addEventListener('click', addProductRow);
        document.getElementById('saveBill').addEventListener('click', saveBill);
        document.getElementById('resetForm').addEventListener('click', resetForm);
        document.getElementById('logoutBtn').addEventListener('click', logout);
        // Update PDF generation with loading
        document.getElementById('generatePDF').addEventListener('click', async function () {
            try {
                showLoading('Generating PDF', 'Creating your invoice document...');
                await PDFGenerator.generatePDF();
                hideLoading();
                showButtonSuccess('generatePDF');
            } catch (error) {
                hideLoading();
                console.error('Error generating PDF:', error);
                alert('Error generating PDF. Please try again.');
            }
        });
        // Add event listeners for payment inputs
        document.getElementById('cashPaid').addEventListener('input', Utils.updateCalculations);
        document.getElementById('upiPaid').addEventListener('input', Utils.updateCalculations);
        document.getElementById('accountPaid').addEventListener('input', Utils.updateCalculations);

        // Add event listeners for dynamic calculations
        document.getElementById('productTableBody').addEventListener('input', function (e) {
            if (e.target.classList.contains('qty') || e.target.classList.contains('rate')) {
                updateRowAmount(e.target.closest('tr'));
                Utils.updateCalculations();
            }
        });

        // Update customer balance check with loading
        document.getElementById('customerPhone').addEventListener('input', function (e) {
            const phone = e.target.value.trim();

            // Debounce the auto-fill check
            clearTimeout(this.autoFillTimeout);
            this.autoFillTimeout = setTimeout(async () => {
                if (phone.length >= 10) {
                    showLoading('Checking Customer', 'Looking up customer details...');
                    await Utils.checkCustomerByPhone(phone);
                    hideLoading();
                }
            }, 800);
        });

        // Save customer details when form is saved or when leaving phone field
        document.getElementById('customerPhone').addEventListener('blur', function () {
            const phone = this.value.trim();
            const name = document.getElementById('customerName').value.trim();
            const address = document.getElementById('customerAddress').value.trim();

            if (phone && phone.length >= 10 && (name || address)) {
                Utils.saveCustomerDetails(name, address, phone);
            }
        });

        // Add event delegation for remove buttons
        document.addEventListener('click', function (e) {
            if (e.target && e.target.classList.contains('remove-row')) {
                e.target.closest('tr').remove();
                updateRowNumbers();
                Utils.updateCalculations();
            }
        });

        // Logout functionality
        document.getElementById('logoutBtn').addEventListener('click', function () {
            sessionStorage.removeItem('isLoggedIn');
            window.location.href = 'login.html';
        });

        // Update customer name balance calculation with loading
        document.getElementById('customerName').addEventListener('input', function () {
            clearTimeout(this.debounce);
            this.debounce = setTimeout(async () => {
                showLoading('Calculating Balance', 'Checking previous balance...');
                await Utils.calculateAndSetPreviousBalance();
                hideLoading();
            }, 500);
        });

        // Check if we're editing an existing invoice
        const urlParams = new URLSearchParams(window.location.search);
        const editInvoiceNo = urlParams.get('edit');
        if (editInvoiceNo) {
            await loadInvoiceForEditing(editInvoiceNo);
        }

        // Initial calculations
        Utils.updateCalculations();

        hideLoading();

    } catch (error) {
        hideLoading();
        console.error('Error during page initialization:', error);

        // Show error state
        const mainContainer = document.querySelector('.main');
        if (mainContainer) {
            mainContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #dc3545; margin-bottom: 16px;"></i>
                    <h3>Error Loading Billing System</h3>
                    <p>There was an error initializing the application. Please refresh the page.</p>
                    <button onclick="location.reload()" class="btn-retry">
                        <i class="fas fa-redo"></i> Refresh Page
                    </button>
                </div>
            `;
        }
    }
});






// Professional loading spinner functions
function showLoading(message = 'Loading...', subtext = '') {
    // Remove existing loading overlay if any
    hideLoading();

    const loadingHTML = `
        <div class="loading-overlay" id="globalLoading">
            <div class="professional-spinner"></div>
            <div class="spinner-text">${message}</div>
            ${subtext ? `<div class="spinner-subtext">${subtext}</div>` : ''}
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', loadingHTML);
}

function hideLoading() {
    const existingLoader = document.getElementById('globalLoading');
    if (existingLoader) {
        existingLoader.remove();
    }
}

// Show form skeleton loading
function showFormSkeletonLoading() {
    const formContainer = document.querySelector('.invoice-container');
    if (!formContainer) return;

    formContainer.classList.add('form-loading');

    // Create skeleton for form fields
    const skeletonHTML = `
        <div class="skeleton-loader skeleton-input" style="width: 100%; height: 40px;"></div>
        <div class="skeleton-loader skeleton-input" style="width: 80%; height: 40px;"></div>
        <div class="skeleton-loader skeleton-input" style="width: 90%; height: 40px;"></div>
    `;

    // You can add more specific skeleton elements as needed
}

function hideFormSkeletonLoading() {
    const formContainer = document.querySelector('.invoice-container');
    if (formContainer) {
        formContainer.classList.remove('form-loading');
    }
}

// Enhanced loading with timeout
function showLoadingWithTimeout(message, subtext = '', timeout = 30000) {
    showLoading(message, subtext);

    // Auto-hide after timeout to prevent stuck loading
    setTimeout(() => {
        hideLoading();
    }, timeout);
}

// Show success state for buttons
function showButtonSuccess(buttonId, duration = 2000) {
    const button = document.getElementById(buttonId);
    if (button) {
        const originalHTML = button.innerHTML;
        const originalBackground = button.style.background;

        button.innerHTML = '<i class="fas fa-check"></i> Success!';
        button.classList.add('btn-success');

        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('btn-success');
            if (originalBackground) {
                button.style.background = originalBackground;
            }
        }, duration);
    }
}