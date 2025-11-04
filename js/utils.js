// Utility functions for the billing application
class Utils {
    // Format currency
    static formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    // Calculate subtotal from product rows
    static calculateSubtotal() {
        let subtotal = 0;
        document.querySelectorAll('#productTableBody tr').forEach(row => {
            const qty = parseFloat(row.querySelector('.qty').value) || 0;
            const rate = parseFloat(row.querySelector('.rate').value) || 0;
            subtotal += qty * rate;
        });
        return subtotal;
    }

    // Calculate grand total
    static calculateGrandTotal(subtotal) {
        const roundedTotal = Math.round(subtotal);
        const roundOff = roundedTotal - subtotal;

        return {
            grandTotal: roundedTotal,
            roundOff: roundOff
        };
    }


    // Calculate total return amount for an invoice
    static async calculateTotalReturns(invoiceNo) {
        try {
            const returns = await db.getReturnsByInvoice(invoiceNo);
            return returns.reduce((total, returnItem) => total + returnItem.returnAmount, 0);
        } catch (error) {
            console.error('Error calculating returns for invoice:', invoiceNo, error);
            return 0; // Return 0 if there's an error
        }
    }

    // Update invoice with return amounts
    static async updateInvoiceWithReturns(invoiceNo) {
        try {
            const totalReturns = await Utils.calculateTotalReturns(invoiceNo);
            const invoiceData = await db.getInvoice(invoiceNo);

            if (invoiceData) {
                invoiceData.totalReturns = totalReturns;
                invoiceData.adjustedBalanceDue = invoiceData.balanceDue - totalReturns;
                await db.saveInvoice(invoiceData);
            }
        } catch (error) {
            console.error('Error updating invoice with returns:', error);
        }
    }
    // Calculate customer's previous balance
    // Calculate customer's previous balance (only the most recent balance)
    static async calculateCustomerBalance(customerName, currentInvoiceNo = null) {
        try {
            const invoices = await db.getAllInvoices();

            // Filter customer invoices and exclude current invoice
            const customerInvoices = invoices.filter(invoice =>
                invoice.customerName === customerName &&
                invoice.invoiceNo !== currentInvoiceNo
            );

            if (customerInvoices.length === 0) {
                return {
                    totalPreviousBills: 0,
                    balanceCarriedForward: 0,
                    invoiceCount: 0,
                    lastInvoiceNo: null
                };
            }

            // Sort invoices by invoice number in descending order (newest first)
            customerInvoices.sort((a, b) => {
                const numA = parseInt(a.invoiceNo) || 0;
                const numB = parseInt(b.invoiceNo) || 0;
                return numB - numA;
            });

            // Get the most recent invoice's adjusted balance due
            const mostRecentInvoice = customerInvoices[0];
            const totalReturns = await Utils.calculateTotalReturns(mostRecentInvoice.invoiceNo);
            const adjustedBalanceDue = mostRecentInvoice.balanceDue - totalReturns;

            // Calculate total of all previous bills (for display only)
            const totalPreviousBills = customerInvoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0);

            return {
                totalPreviousBills,
                balanceCarriedForward: adjustedBalanceDue, // Use adjusted balance
                invoiceCount: customerInvoices.length,
                lastInvoiceNo: mostRecentInvoice.invoiceNo
            };
        } catch (error) {
            console.error('Error calculating customer balance:', error);
            return { totalPreviousBills: 0, balanceCarriedForward: 0, invoiceCount: 0, lastInvoiceNo: null };
        }
    }

    // Validate form data
    static validateForm() {
        const invoiceNo = document.getElementById('invoiceNo').value.trim();
        const invoiceDate = document.getElementById('invoiceDate').value;
        const customerName = document.getElementById('customerName').value.trim();

        if (!invoiceNo) {
            alert('Please enter an invoice number');
            return false;
        }

        if (!invoiceDate) {
            alert('Please select an invoice date');
            return false;
        }

        if (!customerName) {
            alert('Please enter customer name');
            return false;
        }

        // Check if at least one product has description
        let hasProduct = false;
        document.querySelectorAll('.product-description').forEach(input => {
            if (input.value.trim()) {
                hasProduct = true;
            }
        });

        if (!hasProduct) {
            alert('Please add at least one product');
            return false;
        }

        return true;
    }

// Get form data as object (synchronous version)
static getFormData() {
    const products = [];
    document.querySelectorAll('#productTableBody tr').forEach((row, index) => {
        const description = row.querySelector('.product-description').value;
        const qty = parseFloat(row.querySelector('.qty').value) || 0;
        const rate = parseFloat(row.querySelector('.rate').value) || 0;

        if (description) {
            products.push({
                sno: index + 1,
                description: description,
                qty: qty,
                rate: rate,
                amount: qty * rate
            });
        }
    });

    const subtotal = Utils.calculateSubtotal();
    const previousBalance = parseFloat(document.getElementById('previousBalance').textContent.replace(/[^0-9.-]+/g, "")) || 0;
    const totalAmount = subtotal + previousBalance;
    const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const balanceDue = totalAmount - amountPaid;

    return {
        invoiceNo: document.getElementById('invoiceNo').value,
        invoiceDate: document.getElementById('invoiceDate').value,
        customerName: document.getElementById('customerName').value,
        customerAddress: document.getElementById('customerAddress').value,
        customerPhone: document.getElementById('customerPhone').value,
        products: products,
        subtotal: subtotal,
        previousBalance: previousBalance, // ADD THIS LINE - Store previous balance
        grandTotal: totalAmount,
        amountPaid: amountPaid,
        paymentMethod: paymentMethod,
        balanceDue: balanceDue,
        createdAt: new Date().toISOString()
    };
}

    // Calculate and set previous balance for new invoices
    static async calculateAndSetPreviousBalance() {
        const customerName = document.getElementById('customerName').value;
        const currentInvoiceNo = document.getElementById('invoiceNo').value;

        if (customerName) {
            const previousBalanceInfo = await Utils.calculatePreviousBalanceAtTime(customerName, currentInvoiceNo);
            document.getElementById('previousBalance').textContent = Utils.formatCurrency(previousBalanceInfo.balanceCarriedForward);

            // Update calculations with the new previous balance
            Utils.updateCalculations();
        }
    }

    // Calculate previous balance as it was at the time of a specific invoice
    static async calculatePreviousBalanceAtTime(customerName, currentInvoiceNo = null) {
        try {
            const invoices = await db.getAllInvoices();

            // Filter customer invoices and sort by invoice number (ascending)
            const customerInvoices = invoices
                .filter(invoice => invoice.customerName === customerName)
                .sort((a, b) => {
                    const numA = parseInt(a.invoiceNo) || 0;
                    const numB = parseInt(b.invoiceNo) || 0;
                    return numA - numB; // Sort oldest to newest
                });

            if (customerInvoices.length === 0) {
                return {
                    totalPreviousBills: 0,
                    balanceCarriedForward: 0,
                    invoiceCount: 0
                };
            }

            // If we're creating a new invoice, find the balance from the most recent existing invoice
            if (!currentInvoiceNo || !customerInvoices.find(inv => inv.invoiceNo === currentInvoiceNo)) {
                const mostRecentInvoice = customerInvoices[customerInvoices.length - 1];

                // Calculate adjusted balance considering returns
                const totalReturns = await Utils.calculateTotalReturns(mostRecentInvoice.invoiceNo);
                const adjustedBalance = mostRecentInvoice.balanceDue - totalReturns;

                return {
                    totalPreviousBills: customerInvoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0),
                    balanceCarriedForward: adjustedBalance, // Use adjusted balance instead of original balance
                    invoiceCount: customerInvoices.length
                };
            }

            // If we're editing an existing invoice, calculate running balance up to the previous invoice
            const currentInvoiceIndex = customerInvoices.findIndex(inv => inv.invoiceNo === currentInvoiceNo);

            if (currentInvoiceIndex === 0) {
                // This is the first invoice for this customer
                return {
                    totalPreviousBills: 0,
                    balanceCarriedForward: 0,
                    invoiceCount: 0
                };
            }

            // Calculate running balance: start from 0 and apply each invoice's net effect
            let runningBalance = 0;
            for (let i = 0; i < currentInvoiceIndex; i++) {
                const invoice = customerInvoices[i];

                // Calculate adjusted balance for each invoice considering returns
                const totalReturns = await Utils.calculateTotalReturns(invoice.invoiceNo);
                const adjustedBalanceDue = invoice.balanceDue - totalReturns;

                runningBalance += invoice.grandTotal; // Add invoice total
                runningBalance -= invoice.amountPaid; // Subtract payments
                runningBalance -= totalReturns; // Subtract returns
            }

            return {
                totalPreviousBills: customerInvoices.slice(0, currentInvoiceIndex).reduce((sum, invoice) => sum + invoice.grandTotal, 0),
                balanceCarriedForward: runningBalance,
                invoiceCount: currentInvoiceIndex
            };

        } catch (error) {
            console.error('Error calculating previous balance at time:', error);
            return { totalPreviousBills: 0, balanceCarriedForward: 0, invoiceCount: 0 };
        }
    }

    // Update all subsequent invoices when a payment or return is made
    static async updateSubsequentInvoices(customerName, updatedInvoiceNo) {
        try {
            const invoices = await db.getAllInvoices();

            // Get all invoices for this customer after the updated one
            const customerInvoices = invoices
                .filter(invoice => invoice.customerName === customerName)
                .sort((a, b) => {
                    const numA = parseInt(a.invoiceNo) || 0;
                    const numB = parseInt(b.invoiceNo) || 0;
                    return numA - numB;
                });

            const updatedInvoiceIndex = customerInvoices.findIndex(inv => inv.invoiceNo === updatedInvoiceNo);

            if (updatedInvoiceIndex === -1 || updatedInvoiceIndex === customerInvoices.length - 1) {
                return; // No subsequent invoices to update
            }

            // Update all invoices after the changed one
            for (let i = updatedInvoiceIndex + 1; i < customerInvoices.length; i++) {
                const invoice = customerInvoices[i];

                // Recalculate the previous balance for this invoice (considering returns)
                const previousBalanceInfo = await Utils.calculatePreviousBalanceAtTime(customerName, invoice.invoiceNo);
                const previousBalance = previousBalanceInfo.balanceCarriedForward;

                // Recalculate the totals
                const subtotal = invoice.products.reduce((sum, product) => sum + product.amount, 0);
                const totalAmount = subtotal + previousBalance;

                // Calculate returns for this invoice
                const totalReturns = await Utils.calculateTotalReturns(invoice.invoiceNo);
                const balanceDue = totalAmount - invoice.amountPaid - totalReturns;

                // Update the invoice
                invoice.subtotal = subtotal;
                invoice.grandTotal = totalAmount;
                invoice.balanceDue = balanceDue;
                invoice.totalReturns = totalReturns;
                invoice.adjustedBalanceDue = balanceDue;

                // Save the updated invoice
                await db.saveInvoice(invoice);
            }

            console.log(`Updated ${customerInvoices.length - updatedInvoiceIndex - 1} subsequent invoices`);

        } catch (error) {
            console.error('Error updating subsequent invoices:', error);
        }
    }

// Set form data from object
static async setFormData(data) {
    document.getElementById('invoiceNo').value = data.invoiceNo || '';
    document.getElementById('invoiceDate').value = data.invoiceDate || '';
    document.getElementById('customerName').value = data.customerName || '';
    document.getElementById('customerAddress').value = data.customerAddress || '';
    document.getElementById('customerPhone').value = data.customerPhone || '';
    document.getElementById('amountPaid').value = data.amountPaid || 0;
    document.getElementById('paymentMethod').value = data.paymentMethod || 'cash';

    // Clear existing product rows
    const tableBody = document.getElementById('productTableBody');
    tableBody.innerHTML = '';

    // Add product rows
    if (data.products && data.products.length > 0) {
        data.products.forEach((product, index) => {
            const newRow = tableBody.insertRow();
            newRow.innerHTML = `
            <td>${index + 1}</td>
            <td><input type="text" class="product-description" value="${product.description}"></td>
            <td><input type="number" class="qty" value="${product.qty}"></td>
            <td><input type="number" class="rate" value="${product.rate}"></td>
            <td class="amount">${Utils.formatCurrency(product.amount)}</td>
            <td><button class="remove-row">X</button></td>
        `;
        });
    } else {
        // Add one empty row if no products
        const newRow = tableBody.insertRow();
        newRow.innerHTML = `
        <td>1</td>
        <td><input type="text" class="product-description"></td>
        <td><input type="number" class="qty" value="0"></td>
        <td><input type="number" class="rate" value="0.00"></td>
        <td class="amount">0.00</td>
        <td><button class="remove-row">X</button></td>
    `;
    }

    // Set previous balance from data if available, otherwise calculate dynamically
    if (data.previousBalance !== undefined) {
        document.getElementById('previousBalance').textContent = Utils.formatCurrency(data.previousBalance);
    } else {
        // Always calculate previous balance dynamically if not available in data
        await Utils.calculateAndSetPreviousBalance();
    }

    // Update current calculations
    Utils.updateCalculations();
}


    // Update all calculations (synchronous)
    static updateCalculations() {
        const subtotal = Utils.calculateSubtotal();
        const previousBalance = parseFloat(document.getElementById('previousBalance').textContent.replace(/[^0-9.-]+/g, "")) || 0;
        const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;

        const totalAmount = subtotal + previousBalance;
        const balanceDue = totalAmount - amountPaid;

        // Update display
        document.getElementById('subTotal').textContent = Utils.formatCurrency(subtotal);
        document.getElementById('grandTotal').textContent = Utils.formatCurrency(totalAmount);
        document.getElementById('balanceDue').textContent = Utils.formatCurrency(balanceDue);

        // Update product amounts
        document.querySelectorAll('#productTableBody tr').forEach(row => {
            const qty = parseFloat(row.querySelector('.qty').value) || 0;
            const rate = parseFloat(row.querySelector('.rate').value) || 0;
            row.querySelector('.amount').textContent = Utils.formatCurrency(qty * rate);
        });
    }

    // Update customer balance display
    static updateCustomerBalanceDisplay(balanceInfo) {
        const balanceInfoDiv = document.getElementById('customerBalanceInfo');

        if (balanceInfo.invoiceCount > 0) {
            balanceInfoDiv.style.display = 'block';
            document.getElementById('totalPreviousBills').textContent = `₹${Utils.formatCurrency(balanceInfo.totalPreviousBills)}`;
            document.getElementById('balanceCarriedForward').textContent = `₹${Utils.formatCurrency(balanceInfo.balanceCarriedForward)}`;

            // Add more detailed information
            const balanceDetails = balanceInfoDiv.querySelector('.balance-details');
            if (balanceInfo.lastInvoiceNo) {
                // Add last invoice reference if not already present
                if (!document.getElementById('lastInvoiceReference')) {
                    const lastInvoiceRef = document.createElement('div');
                    lastInvoiceRef.className = 'balance-item';
                    lastInvoiceRef.id = 'lastInvoiceReference';
                    lastInvoiceRef.innerHTML = `
                    <span class="balance-label">Last Invoice:</span>
                    <span class="balance-value">#${balanceInfo.lastInvoiceNo}</span>
                `;
                    balanceDetails.appendChild(lastInvoiceRef);
                } else {
                    document.querySelector('#lastInvoiceReference .balance-value').textContent = `#${balanceInfo.lastInvoiceNo}`;
                }

                // Add invoice count if not already present
                if (!document.getElementById('invoiceCount')) {
                    const invoiceCount = document.createElement('div');
                    invoiceCount.className = 'balance-item';
                    invoiceCount.id = 'invoiceCount';
                    invoiceCount.innerHTML = `
                    <span class="balance-label">Total Invoices:</span>
                    <span class="balance-value">${balanceInfo.invoiceCount}</span>
                `;
                    balanceDetails.appendChild(invoiceCount);
                } else {
                    document.querySelector('#invoiceCount .balance-value').textContent = balanceInfo.invoiceCount;
                }
            }
        } else {
            balanceInfoDiv.style.display = 'none';
        }
    }
    // Reset form to default state
    static resetForm() {
        document.getElementById('invoiceNo').value = '';
        document.getElementById('invoiceDate').value = '';
        document.getElementById('customerName').value = '';
        document.getElementById('customerAddress').value = '';
        document.getElementById('customerPhone').value = '';
        // document.getElementById('transportMode').value = '';
        // document.getElementById('vehicleNumber').value = '';
        // document.getElementById('supplyDate').value = '';
        // document.getElementById('placeOfSupply').value = '';
        document.getElementById('amountPaid').value = 0;
        document.getElementById('paymentMethod').value = 'cash';

        // Reset product table
        const tableBody = document.getElementById('productTableBody');
        tableBody.innerHTML = '';
        const newRow = tableBody.insertRow();
        newRow.innerHTML = `
            <td>1</td>
            <td><input type="text" class="product-description"></td>
            <td><input type="number" class="qty" value="0"></td>
            <td><input type="number" class="rate" value="0.00"></td>
            <td class="amount">0.00</td>
            <td><button class="remove-row">X</button></td>
        `;

        Utils.updateCalculations();
    }
}