// PDF generation functionality
class PDFGenerator {
    // Generate PDF from invoice data
    static async generatePDF() {
        if (!Utils.validateForm()) {
            return;
        }

        const invoiceData = Utils.getFormData();

        // Calculate returns for this invoice
        const totalReturns = await Utils.calculateTotalReturns(invoiceData.invoiceNo);
        const adjustedBalanceDue = invoiceData.balanceDue - totalReturns;

        // Create a new window for PDF
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice ${invoiceData.invoiceNo}</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 40px;
                        background: #fff;
                        position: relative;
                        color: #333;
                    }
                    .invoice-container {
                        position: relative;
                        z-index: 2;
                    }
                    /* Watermark */
                    body::before {
                        content: "PR FABRICS";
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-45deg);
                        font-size: 100px;
                        color: rgba(200, 200, 200, 0.15);
                        font-weight: 900;
                        white-space: nowrap;
                        pointer-events: none;
                        z-index: 0;
                    }
                    /* Header */
                    .invoice-header {
                        display: flex;
                        align-items: center;   /* Centers image vertically */
                        justify-content: flex-start;  /* Keeps image on left */
                        border-bottom: 2px solid #444;
                        padding-bottom: 15px;
                        margin-bottom: 25px;
                        text-align: left;
                        gap: 20px; /* Adds spacing between image and text */
                    }
                    .invoice-header img {
                        height: 90px;
                        width: auto;
                        object-fit: contain;
                    }
                    .company-details, .invoice-title {
                        text-align: left;
                    }
                    .invoice-title {
                        margin-left: auto; /* Pushes invoice title to right end */
                        text-align: right;
                    }
                    .company-details h2 {
                        margin: 0;
                        color: #2c3e50;
                        font-size: 26px;
                    }
                    .company-details p {
                        margin: 3px 0;
                        font-size: 13px;
                    }
                    .invoice-title h2 {
                        margin: 0;
                        color: #2c3e50;
                        font-size: 24px;
                        text-transform: uppercase;
                    }
                    .invoice-title div {
                        font-size: 14px;
                        margin-top: 4px;
                    }
                    /* Billing Info */
                    .billing-info {
                        margin-bottom: 20px;
                    }
                    .bill-to {
                        border: 1px solid #555;
                        padding: 6px 10px;
                        border-radius: 6px;
                        background: #f4f4f4;
                        font-weight: 600;
                        color: #222;
                        line-height: 1.3;
                    }
                    .bill-to h3 {
                        margin: 0 0 5px 0;
                        color: #111;
                        font-size: 14px;
                        font-weight: 700;
                        text-transform: uppercase;
                    }
                    .bill-to p {
                        margin: 2px 0;
                        font-size: 13px;
                        color: #111;
                        font-weight: 600;
                    }

                    /* Table */
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th, td {
                        border: 1px solid #ccc;
                        text-align: center;
                        padding: 8px;
                        font-size: 13px;
                    }
                    th {
                        background: wheat;
                        color: #1c1b1bff;
                    }
                    /* Payment Summary */
                    .calculation-section {
                        margin-top: 25px;
                        display: flex;
                        justify-content: flex-end;
                    }
                    .payment-calculation {
                        width: 300px;
                        border: 1px solid #ccc;
                        padding: 10px 15px;
                        border-radius: 8px;
                        background: #fdfdfd;
                    }
                    .payment-calculation h3 {
                        margin-top: 0;
                        text-align: center;
                        font-size: 15px;
                        background: #2c3e50;
                        color: #fff;
                        padding: 5px 0;
                        border-radius: 6px;
                    }
                    .payment-row {
                        display: flex;
                        justify-content: space-between;
                        margin: 6px 0;
                        font-size: 13px;
                    }
                    .payment-row.total {
                        font-weight: bold;
                        border-top: 1px solid #333;
                        padding-top: 6px;
                    }
                    .amount-return {
                        color: #e74c3c;
                        font-weight: bold;
                    }
                    .amount-negative {
                        color: #e74c3c;
                        font-weight: bold;
                    }
                    .amount-positive {
                        color: #27ae60;
                        font-weight: bold;
                    }
                    /* Return Info Box */
                    .return-box {
                        margin-top: 20px;
                        padding: 10px 15px;
                        background: #fff4e6;
                        border-left: 4px solid #f39c12;
                        font-size: 13px;
                        border-radius: 5px;
                    }
                    /* Signature Section */
                    .signature-section {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 50px;
                        font-size: 12px;
                    }
                    .signature-line {
                        border-top: 1px solid #333;
                        margin: 25px 0 5px;
                        width: 160px;
                    }
                    .declaration {
                        flex: 1;
                    }
                    .customer-signature, .company-signature {
                        text-align: center;
                        flex: 1;
                    }
                    img {
                        height: 90px;
                        width: auto;
                        object-fit: contain;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 20px;
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
                            <p>GSTIN: <b>33CLJPG4331G1ZG</b></p>
                        </div>
                        <img src="image.png" alt="pr-image">
                        <div class="invoice-title">
                            <h2>TAX INVOICE</h2>
                            <div><strong>Invoice No:</strong> ${invoiceData.invoiceNo}</div>
                            <div><strong>Date:</strong> ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}</div>
                        </div>
                    </div>

                    <!-- Billing Information -->
                        <div class="billing-info">
                        <div class="bill-to">
                            <h3>BILL TO</h3>
                            <p>Name: ${invoiceData.customerName}</p>
                            <p>Address: ${invoiceData.customerAddress || '-'}</p>
                            <p>Phone: ${invoiceData.customerPhone || '-'}</p>
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
                            <div class="payment-row">
                                <label>Previous Balance:</label>
                                <span>₹${Utils.formatCurrency(invoiceData.previousBalance || 0)}</span>
                            </div>
                            <div class="payment-row total">
                                <label>Total Amount:</label>
                                <span>₹${Utils.formatCurrency(invoiceData.grandTotal)}</span>
                            </div>
                            <div class="payment-row">
                                <label>Amount Paid:</label>
                                <span>₹${Utils.formatCurrency(invoiceData.amountPaid)}</span>
                            </div>
                            ${totalReturns > 0 ? `
                            <div class="payment-row">
                                <label>Return Amount:</label>
                                <span class="amount-return">-₹${Utils.formatCurrency(totalReturns)}</span>
                            </div>
                            ` : ''}
                            <div class="payment-row">
                                <label>Payment Method:</label>
                                <span style="font-weight: bold; ${invoiceData.paymentMethod === 'cash' ? 'color: #27ae60;' : 'color: #3498db;'}">
                                    ${invoiceData.paymentMethod === 'cash' ? 'CASH' : 'GPAY'}
                                </span>
                            </div>
                            <div class="payment-row" style="border-bottom: none;">
                                <label>${totalReturns > 0 ? 'Adjusted Balance Due:' : 'Balance Due:'}</label>
                                <span class="${adjustedBalanceDue > 0 ? 'amount-negative' : 'amount-positive'}">
                                    ₹${Utils.formatCurrency(totalReturns > 0 ? adjustedBalanceDue : invoiceData.balanceDue)}
                                </span>
                            </div>
                        </div>
                    </div>

                    ${totalReturns > 0 ? `
                    <!-- Return Information -->
                    <div class="return-box">
                        <strong>RETURN INFORMATION:</strong> This invoice has processed returns amounting to ₹${Utils.formatCurrency(totalReturns)}. 
                        The balance due has been adjusted accordingly.
                    </div>
                    ` : ''}

                    <!-- Signature Section -->
                    <div class="signature-section">
                        <div class="declaration">
                            <p>Certified that the particulars given above are true and correct</p>
                            <p>**TERMS & CONDITIONS APPLY</p>
                            <p>**E. & O.E.</p>
                        </div>
                        <div class="customer-signature">
                            <p>Agreed and accepted</p>
                            <p class="signature-line"></p>
                            <p>CUSTOMER SIGNATURE</p>
                        </div>
                        <div class="company-signature">
                            <p>For PR FABRICS</p>
                            <p class="signature-line"></p>
                            <p>AUTHORIZED SIGNATORY</p>
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
        }, 600);
    }
}
