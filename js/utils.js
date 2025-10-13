// Utility functions for the billing application
class Utils {
    // Format currency
    static formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    // Convert number to words
    static numberToWords(num) {
        const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
        const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

        if ((num = num.toString()).length > 9) return 'overflow';
        let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return;
        let str = '';
        str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
        str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
        str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
        str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
        str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'only' : 'only';
        return str.replace(/\s+/g, ' ').trim();
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
    static calculateGrandTotal(subtotal, discount) {
        const discountAmount = (subtotal * discount) / 100;
        const totalAfterDiscount = subtotal - discountAmount;
        const roundedTotal = Math.round(totalAfterDiscount);
        const roundOff = roundedTotal - totalAfterDiscount;
        
        return {
            grandTotal: roundedTotal,
            discountAmount: discountAmount,
            roundOff: roundOff
        };
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

    // Get form data as object
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
        const discount = parseFloat(document.getElementById('discount').value) || 0;
        const calculations = Utils.calculateGrandTotal(subtotal, discount);
        const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;
        
        return {
            invoiceNo: document.getElementById('invoiceNo').value,
            invoiceDate: document.getElementById('invoiceDate').value,
            customerName: document.getElementById('customerName').value,
            customerAddress: document.getElementById('customerAddress').value,
            customerPhone: document.getElementById('customerPhone').value,
            transportMode: document.getElementById('transportMode').value,
            vehicleNumber: document.getElementById('vehicleNumber').value,
            supplyDate: document.getElementById('supplyDate').value,
            placeOfSupply: document.getElementById('placeOfSupply').value,
            products: products,
            subtotal: subtotal,
            discount: discount,
            discountAmount: calculations.discountAmount,
            roundOff: calculations.roundOff,
            grandTotal: calculations.grandTotal,
            amountPaid: amountPaid,
            balanceDue: calculations.grandTotal - amountPaid,
            amountInWords: Utils.numberToWords(calculations.grandTotal) + ' rupees only',
            createdAt: new Date().toISOString()
        };
    }

    // Set form data from object
    static setFormData(data) {
        document.getElementById('invoiceNo').value = data.invoiceNo || '';
        document.getElementById('invoiceDate').value = data.invoiceDate || '';
        document.getElementById('customerName').value = data.customerName || '';
        document.getElementById('customerAddress').value = data.customerAddress || '';
        document.getElementById('customerPhone').value = data.customerPhone || '';
        document.getElementById('transportMode').value = data.transportMode || '';
        document.getElementById('vehicleNumber').value = data.vehicleNumber || '';
        document.getElementById('supplyDate').value = data.supplyDate || '';
        document.getElementById('placeOfSupply').value = data.placeOfSupply || '';
        document.getElementById('discount').value = data.discount || 0;
        document.getElementById('amountPaid').value = data.amountPaid || 0;
        
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
        
        // Update calculations
        Utils.updateCalculations();
    }

    // Update all calculations
    static updateCalculations() {
        const subtotal = Utils.calculateSubtotal();
        const discount = parseFloat(document.getElementById('discount').value) || 0;
        const calculations = Utils.calculateGrandTotal(subtotal, discount);
        const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;
        
        document.getElementById('subTotal').textContent = Utils.formatCurrency(subtotal);
        document.getElementById('discountAmount').textContent = Utils.formatCurrency(calculations.discountAmount);
        document.getElementById('roundOff').textContent = Utils.formatCurrency(calculations.roundOff);
        document.getElementById('grandTotal').textContent = Utils.formatCurrency(calculations.grandTotal);
        document.getElementById('balanceDue').textContent = Utils.formatCurrency(calculations.grandTotal - amountPaid);
        document.getElementById('amountInWords').textContent = Utils.numberToWords(calculations.grandTotal) + ' rupees only';
        
        // Update product amounts
        document.querySelectorAll('#productTableBody tr').forEach(row => {
            const qty = parseFloat(row.querySelector('.qty').value) || 0;
            const rate = parseFloat(row.querySelector('.rate').value) || 0;
            row.querySelector('.amount').textContent = Utils.formatCurrency(qty * rate);
        });
    }

    // Reset form to default state
    static resetForm() {
        document.getElementById('invoiceNo').value = '';
        document.getElementById('invoiceDate').value = '';
        document.getElementById('customerName').value = '';
        document.getElementById('customerAddress').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('transportMode').value = '';
        document.getElementById('vehicleNumber').value = '';
        document.getElementById('supplyDate').value = '';
        document.getElementById('placeOfSupply').value = '';
        document.getElementById('discount').value = 0;
        document.getElementById('amountPaid').value = 0;
        
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