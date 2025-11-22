// db.js - Firebase Compatibility Version
class Database {
    constructor() {
        this.dbName = 'BillingDB';
        this.version = 2;
        this.db = null;
        this.firestore = null;
        this.initialized = false;

        // Firebase configuration - REPLACE WITH YOUR ACTUAL CONFIG
        this.firebaseConfig = {
            apiKey: "AIzaSyBHQEyCf27I_y0o7QFvdHwN_86PH7ugYbQ",
            authDomain: "prfabricsbilling.firebaseapp.com",
            projectId: "prfabricsbilling",
            storageBucket: "prfabricsbilling.firebasestorage.app",
            messagingSenderId: "591557598182",
            appId: "1:591557598182:web:f63108b79c4861812ad427",
            measurementId: "G-SKPHVM350N"
        };
    }

    // Initialize Firebase
    async init() {
        try {
            // Initialize Firebase
            firebase.initializeApp(this.firebaseConfig);
            this.firestore = firebase.firestore();

            // Enable offline persistence
            this.firestore.enablePersistence()
                .then(() => {
                    console.log('Firebase persistence enabled');
                })
                .catch((err) => {
                    console.log('Firebase persistence error:', err);
                    if (err.code == 'failed-precondition') {
                        console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                    } else if (err.code == 'unimplemented') {
                        console.log('The current browser doesn\'t support persistence');
                    }
                });

            this.initialized = true;
            console.log('Firebase initialized successfully');
            return this.firestore;

        } catch (error) {
            console.error('Error initializing Firebase:', error);
            throw error;
        }
    }

    // Helper method to check initialization
    _checkInit() {
        if (!this.initialized) {
            throw new Error('Database not initialized. Call init() first.');
        }
    }

    // Save invoice to Firebase
    async saveInvoice(invoiceData) {
        this._checkInit();
        try {
            await this.firestore.collection('invoices').doc(invoiceData.invoiceNo).set({
                ...invoiceData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Invoice saved successfully to Firebase');
            return invoiceData.invoiceNo;
        } catch (error) {
            console.error('Error saving invoice to Firebase:', error);
            throw error;
        }
    }

    // Save customer to Firebase
    async saveCustomer(customerData) {
        this._checkInit();
        try {
            await this.firestore.collection('customers').doc(customerData.phone).set({
                ...customerData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Customer saved successfully to Firebase');
            return customerData.phone;
        } catch (error) {
            console.error('Error saving customer to Firebase:', error);
            throw error;
        }
    }

    // Get customer by phone number
    async getCustomer(phone) {
        this._checkInit();
        try {
            const docRef = this.firestore.collection('customers').doc(phone);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                return docSnap.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error getting customer from Firebase:', error);
            throw error;
        }
    }

    // Get all customers
    async getAllCustomers() {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('customers').get();
            const customers = [];
            querySnapshot.forEach((doc) => {
                customers.push(doc.data());
            });
            return customers;
        } catch (error) {
            console.error('Error getting all customers from Firebase:', error);
            throw error;
        }
    }

    // Delete customer
    async deleteCustomer(phone) {
        this._checkInit();
        try {
            await this.firestore.collection('customers').doc(phone).delete();
            console.log('Customer deleted successfully from Firebase');
        } catch (error) {
            console.error('Error deleting customer from Firebase:', error);
            throw error;
        }
    }

    // Delete return by ID
    async deleteReturn(returnId) {
        this._checkInit();
        try {
            await this.firestore.collection('returns').doc(returnId.toString()).delete();
            console.log('Return deleted successfully from Firebase');
        } catch (error) {
            console.error('Error deleting return from Firebase:', error);
            throw error;
        }
    }

    // Delete payment record
    async deletePayment(paymentId) {
        this._checkInit();
        try {
            await this.firestore.collection('payments').doc(paymentId.toString()).delete();
            console.log('Payment deleted successfully from Firebase');
        } catch (error) {
            console.error('Error deleting payment from Firebase:', error);
            throw error;
        }
    }

    // Get all invoices
    async getAllInvoices() {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('invoices').get();
            const invoices = [];
            querySnapshot.forEach((doc) => {
                invoices.push(doc.data());
            });

            // Sort by invoice date descending (newest first)
            return invoices.sort((a, b) => {
                const dateA = a.invoiceDate ? new Date(a.invoiceDate) : new Date(0);
                const dateB = b.invoiceDate ? new Date(b.invoiceDate) : new Date(0);
                return dateB - dateA;
            });
        } catch (error) {
            console.error('Error getting all invoices from Firebase:', error);
            throw error;
        }
    }

    // Get invoice by invoice number
    async getInvoice(invoiceNo) {
        this._checkInit();
        try {
            const docRef = this.firestore.collection('invoices').doc(invoiceNo);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                return docSnap.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error getting invoice from Firebase:', error);
            throw error;
        }
    }

    // Save payment record
    async savePayment(paymentData) {
        this._checkInit();
        try {
            // Use auto-generated ID or provided ID
            const paymentId = paymentData.id || Date.now().toString();

            await this.firestore.collection('payments').doc(paymentId).set({
                ...paymentData,
                id: paymentId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Payment saved successfully to Firebase');
            return paymentId;
        } catch (error) {
            console.error('Error saving payment to Firebase:', error);
            throw error;
        }
    }

    // Get all payments for an invoice
    async getPaymentsByInvoice(invoiceNo) {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('payments')
                .where('invoiceNo', '==', invoiceNo)
                .get();

            const payments = [];
            querySnapshot.forEach((doc) => {
                payments.push(doc.data());
            });
            return payments;
        } catch (error) {
            console.error('Error getting payments from Firebase:', error);
            return [];
        }
    }

    // Delete invoice
    async deleteInvoice(invoiceNo) {
        this._checkInit();
        try {
            await this.firestore.collection('invoices').doc(invoiceNo).delete();
            console.log('Invoice deleted successfully from Firebase');
        } catch (error) {
            console.error('Error deleting invoice from Firebase:', error);
            throw error;
        }
    }

    // Save return record
    async saveReturn(returnData) {
        this._checkInit();
        try {
            // Use auto-generated ID or provided ID
            const returnId = returnData.id || Date.now().toString();

            await this.firestore.collection('returns').doc(returnId).set({
                ...returnData,
                id: returnId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Return saved successfully to Firebase');
            return returnId;
        } catch (error) {
            console.error('Error saving return to Firebase:', error);
            throw error;
        }
    }

    // Get all returns for an invoice
    async getReturnsByInvoice(invoiceNo) {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('returns')
                .where('invoiceNo', '==', invoiceNo)
                .get();

            const returns = [];
            querySnapshot.forEach((doc) => {
                returns.push(doc.data());
            });
            return returns;
        } catch (error) {
            console.error('Error getting returns from Firebase:', error);
            return [];
        }
    }

    // Get all returns
    async getAllReturns() {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('returns').get();
            const returns = [];
            querySnapshot.forEach((doc) => {
                returns.push(doc.data());
            });
            return returns;
        } catch (error) {
            console.error('Error getting all returns from Firebase:', error);
            return [];
        }
    }

    // Migration function to export existing IndexedDB data
    async exportIndexedDBData() {
        // This would export data from your old IndexedDB
        // You'll need to implement this based on your current IndexedDB structure
        console.log('Export IndexedDB data function');
        return null;
    }

    // Migration function to import data to Firebase
    async importToFirebase(data) {
        this._checkInit();
        try {
            // Import invoices
            if (data.invoices) {
                for (const invoice of data.invoices) {
                    await this.saveInvoice(invoice);
                }
            }

            // Import customers
            if (data.customers) {
                for (const customer of data.customers) {
                    await this.saveCustomer(customer);
                }
            }

            console.log('Data imported successfully to Firebase');
        } catch (error) {
            console.error('Error importing data to Firebase:', error);
            throw error;
        }
    }
}

// Create a global database instance
const db = new Database();