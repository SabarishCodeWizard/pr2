// Recycle Bin Functionality
class RecycleBinManager {
    constructor() {
        this.currentRestoreItem = null;
        this.currentDeleteItem = null;
        this.init();
    }

    async init() {
        await this.setupEventListeners();
        await this.loadRecycleBinItems();
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadRecycleBinItems();
        });

        // Empty bin button
        document.getElementById('emptyBinBtn').addEventListener('click', () => {
            this.showEmptyBinModal();
        });

        // Filter
        document.getElementById('filterType').addEventListener('change', () => {
            this.filterItems();
        });

        // Search
        document.getElementById('searchBin').addEventListener('input', () => {
            this.filterItems();
        });

        // Modal event listeners
        this.setupModalEventListeners();
    }

    setupModalEventListeners() {
        // Restore modal
        document.getElementById('cancelRestore').addEventListener('click', () => {
            this.hideRestoreModal();
        });

        document.getElementById('confirmRestore').addEventListener('click', () => {
            this.confirmRestore();
        });

        // Delete modal
        document.getElementById('cancelDelete').addEventListener('click', () => {
            this.hideDeleteModal();
        });

        document.getElementById('confirmDelete').addEventListener('click', () => {
            this.confirmPermanentDelete();
        });

        // Empty bin modal
        document.getElementById('cancelEmptyBin').addEventListener('click', () => {
            this.hideEmptyBinModal();
        });

        document.getElementById('confirmEmptyBin').addEventListener('click', () => {
            this.confirmEmptyBin();
        });

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Close modals on X button
        document.querySelectorAll('.close-modal').forEach(button => {
            button.addEventListener('click', () => {
                button.closest('.modal-overlay').style.display = 'none';
            });
        });
    }

    async loadRecycleBinItems() {
        try {
            this.showBinSkeletonLoading();
            showLoading('Loading Recycle Bin', 'Retrieving deleted items...');

            const items = await db.getRecycleBinItems();
            this.loadedItems = items;
            this.displayItems(items);
            this.updateStatistics(items);

            hideLoading();
            this.hideBinSkeletonLoading();

        } catch (error) {
            hideLoading();
            this.hideBinSkeletonLoading();
            console.error('Error loading recycle bin items:', error);
            this.showError('Failed to load recycle bin items');
            
            // Show error state
            this.showErrorState('Failed to load recycle bin items. Please try again.');
        }
    }

    displayItems(items) {
        const itemsList = document.getElementById('itemsList');
        const emptyState = document.getElementById('emptyState');
        const emptyBinBtn = document.getElementById('emptyBinBtn');

        if (items.length === 0) {
            itemsList.innerHTML = '';
            emptyState.style.display = 'block';
            emptyBinBtn.disabled = true;
            return;
        }

        emptyState.style.display = 'none';
        emptyBinBtn.disabled = false;

        itemsList.innerHTML = items.map(item => this.createItemHTML(item)).join('');
        
        // Add event listeners to the newly created buttons
        this.attachItemEventListeners();
    }

    createItemHTML(item) {
        const deletedDate = new Date(item.deletedAt?.toDate?.() || item.deletedAt);
        const daysAgo = Math.floor((new Date() - deletedDate) / (1000 * 60 * 60 * 24));
        const formattedDate = deletedDate.toLocaleDateString('en-IN');

        return `
        <div class="bin-item" data-item-id="${item.id}" data-type="${item.type}">
            <div class="bin-item-header">
                <div class="item-info">
                    <h4>
                        ${item.type === 'invoice' ? '<i class="fas fa-file-invoice"></i> Invoice' : ''}
                        ${item.originalId}
                    </h4>
                    <div class="item-meta">
                        <span><i class="fas fa-calendar"></i> ${formattedDate} (${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago)</span>
                        <span><i class="fas fa-user"></i> ${this.escapeHtml(item.customerName)}</span>
                        <span><i class="fas fa-indian-rupee-sign"></i> ₹${Utils.formatCurrency(item.grandTotal)}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-restore" data-id="${item.id}">
                        <i class="fas fa-trash-restore"></i> Restore
                    </button>
                    <button class="btn-permanent-delete" data-id="${item.id}">
                        <i class="fas fa-trash"></i> Delete Permanently
                    </button>
                </div>
            </div>
        </div>
    `;
    }

    attachItemEventListeners() {
        // Restore buttons
        document.querySelectorAll('.btn-restore').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.currentTarget.getAttribute('data-id');
                this.showRestoreModal(itemId);
            });
        });

        // Delete buttons
        document.querySelectorAll('.btn-permanent-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.currentTarget.getAttribute('data-id');
                this.showDeleteModal(itemId);
            });
        });
    }

    updateStatistics(items) {
        const totalItems = items.length;
        const invoiceItems = items.filter(item => item.type === 'invoice').length;

        // Find oldest item
        let oldestDate = null;
        if (items.length > 0) {
            const dates = items.map(item => new Date(item.deletedAt?.toDate?.() || item.deletedAt));
            oldestDate = new Date(Math.min(...dates));
        }

        document.getElementById('totalItems').textContent = totalItems;
        document.getElementById('totalInvoices').textContent = invoiceItems;
        document.getElementById('oldestItem').textContent = oldestDate ?
            `${Math.floor((new Date() - oldestDate) / (1000 * 60 * 60 * 24))} days` : '-';
    }

    filterItems() {
        const filterType = document.getElementById('filterType').value;
        const searchTerm = document.getElementById('searchBin').value.toLowerCase();

        const items = document.querySelectorAll('.bin-item');

        items.forEach(item => {
            const type = item.dataset.type;
            const text = item.textContent.toLowerCase();

            const typeMatch = filterType === 'all' || type === filterType;
            const searchMatch = text.includes(searchTerm);

            item.style.display = typeMatch && searchMatch ? 'block' : 'none';
        });
    }

    // Restore functionality
    showRestoreModal(itemId) {
        this.currentRestoreItem = itemId;
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        const itemName = itemElement?.querySelector('h4')?.textContent || 'Item';

        document.getElementById('restorePreview').innerHTML = `
            <strong>${itemName}</strong> will be restored to its original location.
        `;

        document.getElementById('restoreModal').style.display = 'flex';
    }

    hideRestoreModal() {
        document.getElementById('restoreModal').style.display = 'none';
        this.currentRestoreItem = null;
    }

    async confirmRestore() {
        if (!this.currentRestoreItem) return;

        try {
            showLoading('Restoring Item', 'Please wait while we restore the item...');
            
            const restoreButton = document.querySelector(`[data-id="${this.currentRestoreItem}"]`);
            await db.restoreFromRecycleBin(this.currentRestoreItem);
            
            await this.loadRecycleBinItems();
            this.hideRestoreModal();
            
            showButtonSuccess(restoreButton);
            showToast('Item restored successfully!', 'success');
            
        } catch (error) {
            console.error('Error restoring item:', error);
            showToast('Failed to restore item', 'error');
        } finally {
            hideLoading();
        }
    }

    // Delete functionality
    showDeleteModal(itemId) {
        this.currentDeleteItem = itemId;
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        const itemName = itemElement?.querySelector('h4')?.textContent || 'Item';

        document.getElementById('deletePreview').innerHTML = `
            <strong>${itemName}</strong> will be permanently deleted.
        `;

        document.getElementById('deleteModal').style.display = 'flex';
    }

    hideDeleteModal() {
        document.getElementById('deleteModal').style.display = 'none';
        this.currentDeleteItem = null;
    }

    async confirmPermanentDelete() {
        if (!this.currentDeleteItem) return;

        try {
            showLoading('Deleting Item', 'Permanently removing item from database...');
            
            await db.permanentDeleteFromRecycleBin(this.currentDeleteItem);
            await this.loadRecycleBinItems();
            this.hideDeleteModal();
            
            showToast('Item permanently deleted!', 'success');
            
        } catch (error) {
            console.error('Error deleting item:', error);
            showToast('Failed to delete item', 'error');
        } finally {
            hideLoading();
        }
    }

    // Empty bin functionality
    showEmptyBinModal() {
        document.getElementById('emptyBinModal').style.display = 'flex';
    }

    hideEmptyBinModal() {
        document.getElementById('emptyBinModal').style.display = 'none';
    }

    async confirmEmptyBin() {
        try {
            showLoading('Emptying Recycle Bin', 'Permanently deleting all items...');
            
            const emptyBinBtn = document.getElementById('emptyBinBtn');
            const deletedCount = await db.emptyRecycleBin();
            await this.loadRecycleBinItems();
            this.hideEmptyBinModal();
            
            showButtonSuccess(emptyBinBtn);
            showToast(`Recycle bin emptied! ${deletedCount} items deleted.`, 'success');
            
        } catch (error) {
            console.error('Error emptying recycle bin:', error);
            showToast('Failed to empty recycle bin', 'error');
        } finally {
            hideLoading();
        }
    }

    // Show error state
    showErrorState(message) {
        const itemsList = document.getElementById('itemsList');
        if (itemsList) {
            itemsList.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #dc3545; margin-bottom: 16px;"></i>
                    <h3>Error Loading Items</h3>
                    <p>${message}</p>
                    <button onclick="window.recycleBinManager.loadRecycleBinItems()" class="btn-retry">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            `;
        }
    }

    // Utility methods
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showBinSkeletonLoading() {
        showBinSkeletonLoading();
    }

    hideBinSkeletonLoading() {
        hideBinSkeletonLoading();
    }

    showSuccess(message) {
        showToast(message, 'success');
    }

    showError(message) {
        showToast(message, 'error');
    }
}


// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuthentication()) {
        return;
    }

    try {
        showLoading('Initializing Recycle Bin', 'Setting up the recycle bin system...');
        
        await db.init();
        window.recycleBinManager = new RecycleBinManager();
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Failed to initialize recycle bin:', error);
        
        // Show error state
        const mainContainer = document.querySelector('.main');
        if (mainContainer) {
            mainContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #dc3545; margin-bottom: 16px;"></i>
                    <h3>Error Initializing Recycle Bin</h3>
                    <p>There was an error loading the recycle bin. Please refresh the page.</p>
                    <button onclick="location.reload()" class="btn-retry">
                        <i class="fas fa-redo"></i> Refresh Page
                    </button>
                </div>
            `;
        }
    }
});

// Authentication check (reuse from your existing code)
function checkAuthentication() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated || isAuthenticated !== 'true') {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

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

// Show skeleton loading for recycle bin
function showBinSkeletonLoading() {
    const itemsList = document.getElementById('itemsList');
    const binStats = document.querySelector('.bin-stats');
    
    if (itemsList) {
        // Skeleton for items list
        let skeletonHTML = '';
        for (let i = 0; i < 3; i++) {
            skeletonHTML += `<div class="skeleton-loader skeleton-item"></div>`;
        }
        itemsList.innerHTML = skeletonHTML;
    }
    
    if (binStats) {
        // Skeleton for statistics
        const statItems = binStats.querySelectorAll('.stat-item');
        statItems.forEach(stat => {
            const statInfo = stat.querySelector('.stat-info h3');
            if (statInfo) {
                statInfo.innerHTML = '<div class="skeleton-loader" style="height: 20px; width: 60px;"></div>';
            }
        });
    }
    
    // Add loading class to container
    const binContainer = document.querySelector('.recycle-bin-container');
    if (binContainer) {
        binContainer.classList.add('bin-loading');
    }
}

function hideBinSkeletonLoading() {
    const binContainer = document.querySelector('.recycle-bin-container');
    if (binContainer) {
        binContainer.classList.remove('bin-loading');
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

// Toast notification system
function showToast(message, type = 'success', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'exclamation-triangle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 500);
    }, duration);
}

// Show success state for buttons
function showButtonSuccess(button, duration = 2000) {
    if (!button) return;
    
    const originalHTML = button.innerHTML;
    const originalBackground = button.style.background;
    
    button.innerHTML = '<i class="fas fa-check"></i> Success!';
    button.classList.add('btn-success');
    button.disabled = true;
    
    setTimeout(() => {
        button.innerHTML = originalHTML;
        button.classList.remove('btn-success');
        button.disabled = false;
        if (originalBackground) {
            button.style.background = originalBackground;
        }
    }, duration);
}