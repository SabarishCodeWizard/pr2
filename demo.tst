// Update deleteInvoice function with professional UI
async function deleteInvoice(invoiceNo) {
    // Create professional confirmation dialog
    const deleteDialog = document.createElement('div');
    deleteDialog.className = 'delete-dialog-overlay';
    deleteDialog.innerHTML = `
        <div class="delete-dialog">
            <div class="delete-dialog-header">
                <div class="delete-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Confirm Deletion</h3>
            </div>
            
            <div class="delete-dialog-content">
                <p class="delete-warning-text">
                    You are about to delete Invoice <strong>#${invoiceNo}</strong>. 
                    This action will permanently remove:
                </p>
                
                <ul class="delete-consequences">
                    <li><i class="fas fa-file-invoice"></i> The invoice record</li>
                    <li><i class="fas fa-money-bill-wave"></i> All payment history</li>
                    <li><i class="fas fa-undo"></i> All return records</li>
                    <li><i class="fas fa-chart-line"></i> Customer balance calculations</li>
                </ul>
                
                <div class="delete-final-warning">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>This action cannot be undone!</span>
                </div>
                
                <div class="confirmation-input">
                    <label for="confirmInvoiceNo">
                        Type the invoice number <strong>${invoiceNo}</strong> to confirm:
                    </label>
                    <input type="text" id="confirmInvoiceNo" placeholder="Enter invoice number" autocomplete="off">
                </div>
            </div>
            
            <div class="delete-dialog-actions">
                <button class="btn-cancel-delete" onclick="closeDeleteDialog()">
                    <i class="fas fa-times"></i> Cancel
                </button>
                <button class="btn-confirm-delete" id="confirmDeleteBtn" disabled onclick="proceedWithDelete('${invoiceNo}')">
                    <i class="fas fa-trash"></i> Delete Permanently
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(deleteDialog);

    // Add input validation
    const confirmInput = document.getElementById('confirmInvoiceNo');
    const confirmBtn = document.getElementById('confirmDeleteBtn');

    confirmInput.addEventListener('input', function() {
        const isConfirmed = this.value.trim() === invoiceNo;
        confirmBtn.disabled = !isConfirmed;
        
        if (isConfirmed) {
            this.style.borderColor = '#28a745';
            this.style.boxShadow = '0 0 0 2px rgba(40, 167, 69, 0.25)';
        } else {
            this.style.borderColor = '#dc3545';
            this.style.boxShadow = '0 0 0 2px rgba(220, 53, 69, 0.25)';
        }
    });

    // Enter key support
    confirmInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !confirmBtn.disabled) {
            proceedWithDelete(invoiceNo);
        }
    });

    // Focus on input
    setTimeout(() => {
        confirmInput.focus();
    }, 100);
}

// Close delete dialog
function closeDeleteDialog() {
    const deleteDialog = document.querySelector('.delete-dialog-overlay');
    if (deleteDialog) {
        deleteDialog.remove();
    }
}

// Proceed with deletion after confirmation
async function proceedWithDelete(invoiceNo) {
    try {
        closeDeleteDialog();
        
        showLoading('Deleting Invoice', 'Please wait while we securely remove the invoice and all related data...');

        await db.deleteInvoice(invoiceNo);

        hideLoading();
        
        // Show success message
        showSuccessMessage(`Invoice #${invoiceNo} and all related data have been permanently deleted.`);
        
        await loadInvoices();

    } catch (error) {
        hideLoading();
        console.error('Error deleting invoice:', error);
        showErrorMessage('Error deleting invoice: ' + error.message);
        await loadInvoices();
    }
}

// Show success message
function showSuccessMessage(message) {
    const successToast = document.createElement('div');
    successToast.className = 'operation-toast toast-success';
    successToast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(successToast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (successToast.parentElement) {
            successToast.remove();
        }
    }, 5000);
}

// Show error message
function showErrorMessage(message) {
    const errorToast = document.createElement('div');
    errorToast.className = 'operation-toast toast-error';
    errorToast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(errorToast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (errorToast.parentElement) {
            errorToast.remove();
        }
    }, 5000);
}

// Add this CSS to your styles
const deleteDialogStyles = `
<style>
.delete-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    animation: fadeIn 0.3s ease;
}

.delete-dialog {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    width: 90%;
    max-width: 500px;
    animation: slideUp 0.3s ease;
    overflow: hidden;
}

.delete-dialog-header {
    background: linear-gradient(135deg, #dc3545, #c82333);
    color: white;
    padding: 24px;
    text-align: center;
    position: relative;
}

.delete-dialog-header .delete-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.9;
}

.delete-dialog-header h3 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
}

.delete-dialog-content {
    padding: 24px;
    background: #f8f9fa;
}

.delete-warning-text {
    color: #495057;
    font-size: 16px;
    line-height: 1.5;
    margin-bottom: 20px;
    text-align: center;
}

.delete-consequences {
    list-style: none;
    padding: 0;
    margin: 0 0 24px 0;
    background: white;
    border-radius: 8px;
    border: 1px solid #e9ecef;
    overflow: hidden;
}

.delete-consequences li {
    padding: 12px 16px;
    border-bottom: 1px solid #f1f3f4;
    display: flex;
    align-items: center;
    gap: 12px;
    color: #495057;
    font-size: 14px;
}

.delete-consequences li:last-child {
    border-bottom: none;
}

.delete-consequences li i {
    color: #6c757d;
    width: 16px;
    text-align: center;
}

.delete-final-warning {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    color: #856404;
    font-weight: 600;
}

.delete-final-warning i {
    color: #f39c12;
}

.confirmation-input {
    margin-top: 20px;
}

.confirmation-input label {
    display: block;
    margin-bottom: 8px;
    color: #495057;
    font-weight: 500;
    font-size: 14px;
}

.confirmation-input input {
    width: 100%;
    padding: 12px;
    border: 2px solid #e9ecef;
    border-radius: 6px;
    font-size: 16px;
    text-align: center;
    font-weight: 600;
    transition: all 0.3s ease;
}

.confirmation-input input:focus {
    outline: none;
    border-color: #dc3545;
    box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1);
}

.delete-dialog-actions {
    padding: 20px 24px;
    background: white;
    border-top: 1px solid #e9ecef;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.btn-cancel-delete {
    padding: 12px 24px;
    border: 2px solid #6c757d;
    background: white;
    color: #6c757d;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
}

.btn-cancel-delete:hover {
    background: #6c757d;
    color: white;
}

.btn-confirm-delete {
    padding: 12px 24px;
    border: 2px solid #dc3545;
    background: #dc3545;
    color: white;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
}

.btn-confirm-delete:hover:not(:disabled) {
    background: #c82333;
    border-color: #c82333;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
}

.btn-confirm-delete:disabled {
    background: #6c757d;
    border-color: #6c757d;
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
    box-shadow: none;
}

.operation-toast {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
    z-index: 10001;
    animation: slideInRight 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 300px;
    max-width: 500px;
}

.toast-success {
    background: #d4edda;
    border: 1px solid #c3e6cb;
    color: #155724;
}

.toast-error {
    background: #f8d7da;
    border: 1px solid #f1b0b7;
    color: #721c24;
}

.toast-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
}

.toast-content i {
    font-size: 18px;
}

.toast-close {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
    padding: 4px;
    border-radius: 4px;
    transition: opacity 0.3s ease;
}

.toast-close:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.1);
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideUp {
    from { 
        opacity: 0;
        transform: translateY(30px);
    }
    to { 
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@media (max-width: 768px) {
    .delete-dialog {
        width: 95%;
        margin: 20px;
    }
    
    .delete-dialog-actions {
        flex-direction: column;
    }
    
    .operation-toast {
        left: 20px;
        right: 20px;
        min-width: auto;
    }
}
</style>
`;

// Add styles to document
document.head.insertAdjacentHTML('beforeend', deleteDialogStyles);