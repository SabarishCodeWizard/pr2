// Database initialization and operations
class Database {
    constructor() {
        this.dbName = 'BillingDB';
        this.version = 1;
        this.db = null;
    }

    // Initialize the database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Database failed to open');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store for invoices
                if (!db.objectStoreNames.contains('invoices')) {
                    const invoiceStore = db.createObjectStore('invoices', { keyPath: 'invoiceNo' });
                    invoiceStore.createIndex('customerName', 'customerName', { unique: false });
                    invoiceStore.createIndex('invoiceDate', 'invoiceDate', { unique: false });
                }

                // Create object store for payments
                if (!db.objectStoreNames.contains('payments')) {
                    const paymentStore = db.createObjectStore('payments', { keyPath: 'id', autoIncrement: true });
                    paymentStore.createIndex('invoiceNo', 'invoiceNo', { unique: false });
                    paymentStore.createIndex('paymentDate', 'paymentDate', { unique: false });
                }
            };
        });
    }

    // Save invoice to database
    async saveInvoice(invoiceData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invoices'], 'readwrite');
            const store = transaction.objectStore('invoices');
            const request = store.put(invoiceData);

            request.onsuccess = () => {
                console.log('Invoice saved successfully');
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Error saving invoice');
                reject(request.error);
            };
        });
    }

    // Get all invoices
    async getAllInvoices() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invoices'], 'readonly');
            const store = transaction.objectStore('invoices');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // Get invoice by invoice number
    async getInvoice(invoiceNo) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invoices'], 'readonly');
            const store = transaction.objectStore('invoices');
            const request = store.get(invoiceNo);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // Save payment record
    async savePayment(paymentData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['payments'], 'readwrite');
            const store = transaction.objectStore('payments');
            const request = store.put(paymentData);

            request.onsuccess = () => {
                console.log('Payment saved successfully');
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Error saving payment');
                reject(request.error);
            };
        });
    }

    // Get all payments for an invoice
    async getPaymentsByInvoice(invoiceNo) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['payments'], 'readonly');
            const store = transaction.objectStore('payments');
            const index = store.index('invoiceNo');
            const request = index.getAll(invoiceNo);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // Delete invoice
    async deleteInvoice(invoiceNo) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invoices'], 'readwrite');
            const store = transaction.objectStore('invoices');
            const request = store.delete(invoiceNo);

            request.onsuccess = () => {
                console.log('Invoice deleted successfully');
                resolve();
            };

            request.onerror = () => {
                console.error('Error deleting invoice');
                reject(request.error);
            };
        });
    }
}

// Create a global database instance
const db = new Database();