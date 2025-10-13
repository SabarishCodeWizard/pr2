// Main application logic
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize database
    await db.init();
    
    // Set current date as default for invoice date
    document.getElementById('invoiceDate').valueAsDate = new Date();
    
    // Add event listeners
    document.getElementById('addRow').addEventListener('click', addProductRow);
    document.getElementById('generatePDF').addEventListener('click', PDFGenerator.generatePDF);
    document.getElementById('saveBill').addEventListener('click', saveBill);
    document.getElementById('resetForm').addEventListener('click', resetForm);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Add event listeners for dynamic calculations
    document.getElementById('productTableBody').addEventListener('input', function(e) {
        if (e.target.classList.contains('qty') || e.target.classList.contains('rate')) {
            updateRowAmount(e.target.closest('tr'));
            Utils.updateCalculations();
        }
    });
    
    document.getElementById('amountPaid').addEventListener('input', Utils.updateCalculations);
    
    // Check if we're editing an existing invoice
    const urlParams = new URLSearchParams(window.location.search);
    const editInvoiceNo = urlParams.get('edit');
    if (editInvoiceNo) {
        loadInvoiceForEditing(editInvoiceNo);
    }
    
    // Initial calculations
    Utils.updateCalculations();
});

// Add a new product row
function addProductRow() {
    const tableBody = document.getElementById('productTableBody');
    const rowCount = tableBody.rows.length;
    const newRow = tableBody.insertRow();
    
    newRow.innerHTML = `
        <td>${rowCount + 1}</td>
        <td><input type="text" class="product-description"></td>
        <td><input type="number" class="qty" value="0"></td>
        <td><input type="number" class="rate" value="0.00"></td>
        <td class="amount">0.00</td>
        <td><button class="remove-row">X</button></td>
    `;
    
    // Add event listener to the remove button
    newRow.querySelector('.remove-row').addEventListener('click', function() {
        this.closest('tr').remove();
        updateRowNumbers();
        Utils.updateCalculations();
    });
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

// Save bill to database
async function saveBill() {
    if (!Utils.validateForm()) {
        return;
    }
    
    const invoiceData = Utils.getFormData();
    
    try {
        await db.saveInvoice(invoiceData);
        alert('Bill saved successfully!');
        
        // If this is a new payment, save it
        if (invoiceData.amountPaid > 0) {
            const paymentData = {
                invoiceNo: invoiceData.invoiceNo,
                paymentDate: new Date().toISOString().split('T')[0],
                amount: invoiceData.amountPaid,
                paymentType: 'initial',
                paymentMethod: invoiceData.paymentMethod
            };
            await db.savePayment(paymentData);
        }
    } catch (error) {
        console.error('Error saving bill:', error);
        alert('Error saving bill. Please try again.');
    }
}

// Reset form
function resetForm() {
    if (confirm('Are you sure you want to reset the form? All unsaved data will be lost.')) {
        Utils.resetForm();
    }
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // In a real application, you would clear session/tokens here
        window.location.href = 'login.html'; // Redirect to login page
    }
}

// Load invoice for editing
async function loadInvoiceForEditing(invoiceNo) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        if (invoiceData) {
            Utils.setFormData(invoiceData);
            document.getElementById('invoiceNo').readOnly = true; // Prevent editing invoice number
        } else {
            alert('Invoice not found!');
        }
    } catch (error) {
        console.error('Error loading invoice:', error);
        alert('Error loading invoice for editing.');
    }
}

// Add event delegation for remove buttons (for dynamically added rows)
document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('remove-row')) {
        e.target.closest('tr').remove();
        updateRowNumbers();
        Utils.updateCalculations();
    }
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', function () {
    sessionStorage.removeItem('isLoggedIn');
    window.location.href = 'https://prfabrics.vercel.app/login.html';
});