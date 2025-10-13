// PDF generation functionality
class PDFGenerator {
    // Generate PDF from invoice data
    static async generatePDF() {
        if (!Utils.validateForm()) {
            return;
        }

        const invoiceData = Utils.getFormData();
        
        // Create a new window for PDF
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice ${invoiceData.invoiceNo}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                    body { 
                        font-family: 'Arial', sans-serif; 
                        margin: 0; 
                        padding: 0;
                        color: #333;
                        line-height: 1.3;
                        font-size: 11px;
                    }
                    .invoice-container { 
                        width: 190mm;
                        margin: 0 auto;
                        padding: 8mm;
                        background: white;
                        box-sizing: border-box;
                        min-height: 277mm;
                    }
                    .invoice-header { 
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 12px;
                        padding-bottom: 10px;
                        border-bottom: 1.5px solid #2c3e50;
                    }
                    .company-details h2 { 
                        margin: 0 0 4px 0; 
                        color: #2c3e50;
                        font-size: 18px;
                        font-weight: bold;
                    }
                    .company-details p { 
                        margin: 1px 0;
                        font-size: 9px;
                        color: #555;
                    }
                    .invoice-title { 
                        text-align: right;
                    }
                    .invoice-title h2 { 
                        margin: 0 0 8px 0; 
                        color: #2c3e50;
                        font-size: 20px;
                        font-weight: bold;
                    }
                    .invoice-number, .invoice-date { 
                        margin-bottom: 3px;
                        font-size: 10px;
                    }
                    .invoice-number strong, .invoice-date strong {
                        color: #555;
                    }
                    .billing-info { 
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 12px;
                        gap: 10px;
                    }
                    .bill-to, .shipping-info { 
                        flex: 1;
                        padding: 8px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        border-left: 3px solid #3498db;
                    }
                    .bill-to h3, .shipping-info h3 { 
                        margin: 0 0 6px 0;
                        color: #2c3e50;
                        font-size: 12px;
                        font-weight: bold;
                        padding-bottom: 4px;
                        border-bottom: 1px solid #ddd;
                    }
                    .bill-to p, .shipping-info p { 
                        margin: 3px 0;
                        font-size: 9px;
                        color: #555;
                        line-height: 1.2;
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-bottom: 10px;
                        font-size: 9px;
                    }
                    th { 
                        background-color: #2c3e50; 
                        color: white;
                        font-weight: bold;
                        padding: 6px 4px;
                        text-align: left;
                        border: 1px solid #1a252f;
                    }
                    td { 
                        padding: 5px 4px;
                        border: 1px solid #ddd;
                        text-align: left;
                        vertical-align: top;
                    }
                    tbody tr:nth-child(even) {
                        background-color: #f8f9fa;
                    }
                    .calculation-section { 
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 12px;
                        gap: 10px;
                    }
                    .payment-calculation { 
                        flex: 1;
                        padding: 8px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        border-left: 3px solid #27ae60;
                    }
                    .payment-info { 
                        flex: 1;
                        padding: 8px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        border-left: 3px solid #e74c3c;
                    }
                    .payment-calculation h3, .payment-info h3 { 
                        margin: 0 0 6px 0;
                        color: #2c3e50;
                        font-size: 12px;
                        font-weight: bold;
                        padding-bottom: 4px;
                        border-bottom: 1px solid #ddd;
                    }
                    .payment-row { 
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 4px;
                        padding: 3px 0;
                        border-bottom: 1px solid #eee;
                    }
                    .payment-row.total {
                        border-bottom: 1.5px solid #2c3e50;
                        font-weight: bold;
                        font-size: 11px;
                        margin-top: 4px;
                    }
                    .payment-row label {
                        font-weight: 500;
                        color: #555;
                        font-size: 9px;
                    }
                    .payment-info p { 
                        margin: 4px 0;
                        font-size: 9px;
                        color: #555;
                        line-height: 1.2;
                    }
                    .payment-info strong {
                        color: #2c3e50;
                    }
                    .signature-section { 
                        display: flex;
                        justify-content: space-between;
                        margin-top: 15px;
                        padding-top: 10px;
                        border-top: 1.5px solid #ddd;
                    }
                    .declaration, .customer-signature, .company-signature { 
                        flex: 1;
                        text-align: center;
                        padding: 0 5px;
                    }
                    .declaration p, .customer-signature p, .company-signature p { 
                        margin: 4px 0;
                        font-size: 8px;
                        color: #555;
                        line-height: 1.2;
                    }
                    .signature-line { 
                        margin-top: 20px;
                        padding-top: 4px;
                        border-top: 1px solid #333;
                        font-weight: bold;
                        color: #333;
                        font-size: 9px;
                    }
                    .declaration {
                        text-align: left;
                    }
                    .declaration p:first-child {
                        font-weight: 500;
                    }
                    .declaration p:last-child {
                        font-style: italic;
                        color: #e74c3c;
                    }
                    .note-box {
                        margin-top: 6px;
                        padding: 5px;
                        background: #fff3cd;
                        border-radius: 3px;
                        border-left: 3px solid #ffc107;
                        font-size: 8px;
                        line-height: 1.2;
                    }
                    .amount-positive {
                        color: #27ae60;
                        font-weight: bold;
                    }
                    .amount-negative {
                        color: #e74c3c;
                        font-weight: bold;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 0;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .invoice-container {
                            padding: 8mm;
                            box-shadow: none;
                            border: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    <!-- Header Section -->
                    <div class="invoice-header">
                        <div class="company-details">
                            <h2>PR FABRICS</h2>
                            <p>42/65, THIRUNEELAKANDA PURAM, 1ST STREET,</p>
                            <p>TIRUPUR 641-602 | CELL: 9952520181</p>
                        </div>
                        <div class="invoice-title">
                            <h2>TAX INVOICE</h2>
                            <div class="invoice-number">
                                <strong>Invoice No:</strong> ${invoiceData.invoiceNo}
                            </div>
                            <div class="invoice-date">
                                <strong>Date:</strong> ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}
                            </div>
                        </div>
                    </div>

                    <!-- Billing Information -->
                    <div class="billing-info">
                        <div class="bill-to">
                            <h3>BILL TO</h3>
                            <p><strong>Name:</strong> ${invoiceData.customerName}</p>
                            <p><strong>Address:</strong> ${invoiceData.customerAddress}</p>
                            <p><strong>Phone:</strong> ${invoiceData.customerPhone}</p>
                        </div>
                        <div class="shipping-info">
                            <h3>SHIPPING DETAILS</h3>
                            <p><strong>Transport:</strong> ${invoiceData.transportMode || 'N/A'}</p>
                            <p><strong>Vehicle No:</strong> ${invoiceData.vehicleNumber || 'N/A'}</p>
                            <p><strong>Supply Date:</strong> ${invoiceData.supplyDate ? new Date(invoiceData.supplyDate).toLocaleDateString('en-IN') : 'N/A'}</p>
                            <p><strong>Place:</strong> ${invoiceData.placeOfSupply || 'N/A'}</p>
                        </div>
                    </div>

                    <!-- Products Table -->
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 8%">S.No.</th>
                                <th style="width: 52%">Product Description</th>
                                <th style="width: 10%">Qty</th>
                                <th style="width: 15%">Rate (₹)</th>
                                <th style="width: 15%">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoiceData.products.map(product => `
                                <tr>
                                    <td>${product.sno}</td>
                                    <td>${product.description}</td>
                                    <td>${product.qty}</td>
                                    <td>${Utils.formatCurrency(product.rate)}</td>
                                    <td>${Utils.formatCurrency(product.amount)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <!-- Calculation Section -->
                    <div class="calculation-section">
                        <div class="payment-calculation">
                            <h3>PAYMENT SUMMARY</h3>
                            <div class="payment-row">
                                <label>Subtotal:</label>
                                <span>₹${Utils.formatCurrency(invoiceData.subtotal)}</span>
                            </div>
                            <div class="payment-row total">
                                <label>Total Amount:</label>
                                <span>₹${Utils.formatCurrency(invoiceData.grandTotal)}</span>
                            </div>
                            <div class="payment-row">
                                <label>Amount Paid:</label>
                                <span>₹${Utils.formatCurrency(invoiceData.amountPaid)}</span>
                            </div>
                            <div class="payment-row">
                                <label>Payment Method:</label>
                                <span style="font-weight: bold; ${invoiceData.paymentMethod === 'cash' ? 'color: #27ae60;' : 'color: #3498db;'}">${invoiceData.paymentMethod === 'cash' ? 'CASH' : 'GPAY'}</span>
                            </div>
                            <div class="payment-row" style="border-bottom: none; margin-top: 2px;">
                                <label>Balance Due:</label>
                                <span class="${invoiceData.balanceDue > 0 ? 'amount-negative' : 'amount-positive'}">₹${Utils.formatCurrency(invoiceData.balanceDue)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Signature Section -->
                    <div class="signature-section">
                        <div class="declaration">
                            <p>Certified that the particulars given above are true and correct</p>
                            <p>**TERMS & CONDITIONS APPLY</p>
                            <p>**E. & O.E.</p>
                        </div>
                        <div class="customer-signature">
                            <p>Agreed and accepted</p>
                            <p class="signature-line">CUSTOMER SIGNATURE</p>
                            <p>Authorized Signatory</p>
                        </div>
                        <div class="company-signature">
                            <p>For PR FABRICS</p>
                            <p class="signature-line">AUTHORIZED SIGNATORY</p>
                            <p>Proprietor</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        
        // Wait for content to load then print
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }
}