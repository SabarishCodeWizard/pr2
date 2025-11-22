// Product Shortcuts Management
class ShortcutManager {
    constructor() {
        this.currentEditId = null;
        this.init();
    }

    async init() {
        // Wait for database to be ready
        if (!db.db) {
            await db.init();
        }
        await this.loadShortcuts();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add shortcut
        document.getElementById('addShortcut').addEventListener('click', () => this.addShortcut());
        
        // Search functionality
        document.getElementById('searchShortcuts').addEventListener('input', (e) => this.searchShortcuts(e.target.value));
        
        // Modal functionality
        document.querySelector('.close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelEdit').addEventListener('click', () => this.closeModal());
        document.getElementById('saveEdit').addEventListener('click', () => this.saveEdit());
        
        // Close modal when clicking outside
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal') {
                this.closeModal();
            }
        });

        // Allow adding shortcut with Enter key
        document.getElementById('shortcutKey').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addShortcut();
            }
        });

        document.getElementById('fullDescription').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addShortcut();
            }
        });
    }

    async addShortcut() {
        const shortcutKey = document.getElementById('shortcutKey').value.trim();
        const fullDescription = document.getElementById('fullDescription').value.trim();

        if (!shortcutKey || !fullDescription) {
            alert('Please enter both shortcut key and full description');
            return;
        }

        try {
            const shortcutData = {
                shortcutKey: shortcutKey.toUpperCase(),
                fullDescription: fullDescription,
                createdAt: new Date().toISOString()
            };

            await this.saveShortcut(shortcutData);
            
            // Clear form
            document.getElementById('shortcutKey').value = '';
            document.getElementById('fullDescription').value = '';
            
            // Reload shortcuts
            await this.loadShortcuts();
            
            // Show success message
            this.showMessage('Shortcut added successfully!', 'success');
            
        } catch (error) {
            console.error('Error adding shortcut:', error);
            this.showMessage('Error adding shortcut. Please try again.', 'error');
        }
    }

    async saveShortcut(shortcutData) {
        return new Promise((resolve, reject) => {
            // Ensure database is ready
            if (!db.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = db.db.transaction(['shortcuts'], 'readwrite');
            const store = transaction.objectStore('shortcuts');
            const request = store.put(shortcutData);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async loadShortcuts() {
        try {
            const shortcuts = await this.getAllShortcuts();
            this.renderShortcuts(shortcuts);
        } catch (error) {
            console.error('Error loading shortcuts:', error);
            this.renderShortcuts([]); // Render empty state on error
        }
    }

    async getAllShortcuts() {
        return new Promise((resolve, reject) => {
            // Ensure database is ready
            if (!db.db) {
                resolve([]); // Return empty array if db not ready
                return;
            }

            // Check if shortcuts store exists
            if (!db.db.objectStoreNames.contains('shortcuts')) {
                resolve([]); // Return empty array if store doesn't exist
                return;
            }

            const transaction = db.db.transaction(['shortcuts'], 'readonly');
            const store = transaction.objectStore('shortcuts');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    renderShortcuts(shortcuts) {
        const tableBody = document.getElementById('shortcutsTableBody');
        
        if (!tableBody) {
            console.error('Shortcuts table body not found');
            return;
        }

        if (shortcuts.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 40px; color: #7f8c8d;">
                        <i class="fas fa-clipboard-list" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                        <p>No shortcuts found. Add your first shortcut above!</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Sort shortcuts alphabetically by shortcut key
        shortcuts.sort((a, b) => a.shortcutKey.localeCompare(b.shortcutKey));

        tableBody.innerHTML = shortcuts.map(shortcut => `
            <tr>
                <td><strong>${this.escapeHtml(shortcut.shortcutKey)}</strong></td>
                <td>${this.escapeHtml(shortcut.fullDescription)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="shortcutManager.editShortcut('${shortcut.shortcutKey}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-delete" onclick="shortcutManager.deleteShortcut('${shortcut.shortcutKey}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async editShortcut(shortcutKey) {
        try {
            const shortcut = await this.getShortcut(shortcutKey);
            if (shortcut) {
                this.currentEditId = shortcutKey;
                document.getElementById('editShortcutKey').value = shortcut.shortcutKey;
                document.getElementById('editFullDescription').value = shortcut.fullDescription;
                document.getElementById('editModal').style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading shortcut for edit:', error);
            this.showMessage('Error loading shortcut for editing', 'error');
        }
    }

    async getShortcut(shortcutKey) {
        return new Promise((resolve, reject) => {
            // Ensure database is ready
            if (!db.db || !db.db.objectStoreNames.contains('shortcuts')) {
                resolve(null);
                return;
            }

            const transaction = db.db.transaction(['shortcuts'], 'readonly');
            const store = transaction.objectStore('shortcuts');
            const request = store.get(shortcutKey);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveEdit() {
        const shortcutKey = document.getElementById('editShortcutKey').value.trim();
        const fullDescription = document.getElementById('editFullDescription').value.trim();

        if (!shortcutKey || !fullDescription) {
            alert('Please enter both shortcut key and full description');
            return;
        }

        try {
            const shortcutData = {
                shortcutKey: shortcutKey.toUpperCase(),
                fullDescription: fullDescription,
                createdAt: new Date().toISOString()
            };

            // If the key changed, we need to delete the old one and add new
            if (shortcutKey !== this.currentEditId) {
                await this.deleteShortcut(this.currentEditId, false);
            }

            await this.saveShortcut(shortcutData);
            await this.loadShortcuts();
            this.closeModal();
            this.showMessage('Shortcut updated successfully!', 'success');
            
        } catch (error) {
            console.error('Error updating shortcut:', error);
            this.showMessage('Error updating shortcut. Please try again.', 'error');
        }
    }

    async deleteShortcut(shortcutKey, confirm = true) {
        if (confirm && !window.confirm('Are you sure you want to delete this shortcut?')) {
            return;
        }

        try {
            await new Promise((resolve, reject) => {
                // Ensure database is ready
                if (!db.db || !db.db.objectStoreNames.contains('shortcuts')) {
                    resolve();
                    return;
                }

                const transaction = db.db.transaction(['shortcuts'], 'readwrite');
                const store = transaction.objectStore('shortcuts');
                const request = store.delete(shortcutKey);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            await this.loadShortcuts();
            this.showMessage('Shortcut deleted successfully!', 'success');
            
        } catch (error) {
            console.error('Error deleting shortcut:', error);
            this.showMessage('Error deleting shortcut. Please try again.', 'error');
        }
    }

    searchShortcuts(query) {
        const rows = document.querySelectorAll('#shortcutsTableBody tr');
        const searchTerm = query.toLowerCase();

        rows.forEach(row => {
            const shortcutKey = row.cells[0].textContent.toLowerCase();
            const fullDescription = row.cells[1].textContent.toLowerCase();
            
            if (shortcutKey.includes(searchTerm) || fullDescription.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    closeModal() {
        document.getElementById('editModal').style.display = 'none';
        this.currentEditId = null;
    }

    showMessage(message, type) {
        // Remove existing messages
        const existingMessage = document.querySelector('.shortcut-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `shortcut-message shortcut-message-${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 600;
            z-index: 1001;
            animation: slideInRight 0.3s ease;
        `;

        if (type === 'success') {
            messageDiv.style.background = 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)';
        } else {
            messageDiv.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
        }

        document.body.appendChild(messageDiv);

        // Remove message after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => messageDiv.remove(), 300);
            }
        }, 3000);
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Initialize database first
        if (!db.db) {
            await db.init();
        }
        
        // Create shortcuts manager
        window.shortcutManager = new ShortcutManager();
    } catch (error) {
        console.error('Failed to initialize shortcut manager:', error);
        // Show error message to user
        const tableBody = document.getElementById('shortcutsTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 40px; color: #e74c3c;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                        <p>Failed to load shortcuts. Please refresh the page.</p>
                    </td>
                </tr>
            `;
        }
    }
});