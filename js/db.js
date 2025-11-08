// Database initialization and operations
class Database {
    constructor() {
        this.dbName = 'BillingDB';
        this.version = 2; // Incremented version to 2
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
                const oldVersion = event.oldVersion;
                const newVersion = event.newVersion;

                console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);

                // Create object store for invoices if it doesn't exist
                if (!db.objectStoreNames.contains('invoices')) {
                    const invoiceStore = db.createObjectStore('invoices', { keyPath: 'invoiceNo' });
                    invoiceStore.createIndex('customerName', 'customerName', { unique: false });
                    invoiceStore.createIndex('invoiceDate', 'invoiceDate', { unique: false });
                    console.log('Created invoices object store');
                }

                // Add this in the onupgradeneeded method after the returns store creation
                if (!db.objectStoreNames.contains('customers')) {
                    const customerStore = db.createObjectStore('customers', { keyPath: 'phone' });
                    customerStore.createIndex('name', 'name', { unique: false });
                    customerStore.createIndex('phone', 'phone', { unique: true });
                    console.log('Created customers object store');
                }

                // Create object store for payments if it doesn't exist
                if (!db.objectStoreNames.contains('payments')) {
                    const paymentStore = db.createObjectStore('payments', { keyPath: 'id', autoIncrement: true });
                    paymentStore.createIndex('invoiceNo', 'invoiceNo', { unique: false });
                    paymentStore.createIndex('paymentDate', 'paymentDate', { unique: false });
                    console.log('Created payments object store');
                }

                // Create object store for returns - this is new in version 2
                if (!db.objectStoreNames.contains('returns')) {
                    const returnStore = db.createObjectStore('returns', { keyPath: 'id', autoIncrement: true });
                    returnStore.createIndex('invoiceNo', 'invoiceNo', { unique: false });
                    returnStore.createIndex('returnDate', 'returnDate', { unique: false });
                    returnStore.createIndex('customerName', 'customerName', { unique: false });
                    console.log('Created returns object store');
                }
            };

            request.onblocked = () => {
                console.error('Database upgrade blocked');
                alert('Please close all other tabs with this app to update the database.');
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



    // Save customer to database
    async saveCustomer(customerData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['customers'], 'readwrite');
            const store = transaction.objectStore('customers');
            const request = store.put(customerData);

            request.onsuccess = () => {
                console.log('Customer saved successfully');
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Error saving customer');
                reject(request.error);
            };
        });
    }

    // Get customer by phone number
    async getCustomer(phone) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['customers'], 'readonly');
            const store = transaction.objectStore('customers');
            const request = store.get(phone);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // Get all customers
    async getAllCustomers() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['customers'], 'readonly');
            const store = transaction.objectStore('customers');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // Delete customer
    async deleteCustomer(phone) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['customers'], 'readwrite');
            const store = transaction.objectStore('customers');
            const request = store.delete(phone);

            request.onsuccess = () => {
                console.log('Customer deleted successfully');
                resolve();
            };

            request.onerror = () => {
                console.error('Error deleting customer');
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

    // Save return record
    async saveReturn(returnData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['returns'], 'readwrite');
            const store = transaction.objectStore('returns');
            const request = store.put(returnData);

            request.onsuccess = () => {
                console.log('Return saved successfully');
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Error saving return');
                reject(request.error);
            };
        });
    }

    // Get all returns for an invoice
    async getReturnsByInvoice(invoiceNo) {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['returns'], 'readonly');
                const store = transaction.objectStore('returns');
                const index = store.index('invoiceNo');
                const request = index.getAll(invoiceNo);

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = () => {
                    console.error('Error getting returns:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('Transaction error:', error);
                // If returns store doesn't exist, return empty array
                resolve([]);
            }
        });
    }

    // Get all returns
    async getAllReturns() {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['returns'], 'readonly');
                const store = transaction.objectStore('returns');
                const request = store.getAll();

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = () => {
                    console.error('Error getting all returns:', request.error);
                    reject(request.error);
                };
            } catch (error) {
                console.error('Transaction error:', error);
                // If returns store doesn't exist, return empty array
                resolve([]);
            }
        });
    }
}

// Create a global database instance
const db = new Database();