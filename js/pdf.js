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
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .invoice-container { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; }
                    .invoice-header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .company-details h2 { margin: 0; color: #333; }
                    .invoice-title h2 { margin: 0; text-align: right; }
                    .invoice-number, .invoice-date { margin-bottom: 5px; }
                    .billing-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .bill-to, .shipping-info { width: 48%; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .calculation-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .payment-calculation, .payment-info { width: 48%; }
                    .payment-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                    .signature-section { display: flex; justify-content: space-between; margin-top: 40px; }
                    .declaration, .customer-signature, .company-signature { width: 30%; text-align: center; }
                    .signature-line { margin-top: 60px; border-top: 1px solid #333; padding-top: 5px; }
                    .total { font-weight: bold; border-top: 2px solid #333; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    <div class="invoice-header">
                        <div class="company-details">
                            <h2>PR FABRICS</h2>
                            <p>42/65, THIRUNEELAKANDA PURAM, 1ST STREET,</p>
                            <p>TIRUPUR 641-602. CELL NO: 9952520181</p>
                        </div>
                        <div class="invoice-title">
                            <h2>Invoice</h2>
                            <div class="invoice-number">
                                <strong>Invoice No:</strong> ${invoiceData.invoiceNo}
                            </div>
                            <div class="invoice-date">
                                <strong>Invoice Date:</strong> ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}
                            </div>
                        </div>
                    </div>

                    <div class="billing-info">
                        <div class="bill-to">
                            <h3>Bill to Party</h3>
                            <p><strong>Name:</strong> ${invoiceData.customerName}</p>
                            <p><strong>Address:</strong> ${invoiceData.customerAddress}</p>
                            <p><strong>Phone:</strong> ${invoiceData.customerPhone}</p>
                        </div>
                        <div class="shipping-info">
                            <h3>Shipping Details</h3>
                            <p><strong>Transport Mode:</strong> ${invoiceData.transportMode}</p>
                            <p><strong>Vehicle Number:</strong> ${invoiceData.vehicleNumber}</p>
                            <p><strong>Date of Supply:</strong> ${invoiceData.supplyDate ? new Date(invoiceData.supplyDate).toLocaleDateString('en-IN') : ''}</p>
                            <p><strong>Place of Supply:</strong> ${invoiceData.placeOfSupply}</p>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>S.No.</th>
                                <th>Product Description</th>
                                <th>Qty</th>
                                <th>Rate</th>
                                <th>Amount</th>
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

                    <div class="calculation-section">
                        <div class="payment-calculation">
                            <div class="payment-row">
                                <label>Subtotal:</label>
                                <span>${Utils.formatCurrency(invoiceData.subtotal)}</span>
                            </div>
                            <div class="payment-row total">
                                <label>Total Amount:</label>
                                <span>${Utils.formatCurrency(invoiceData.grandTotal)}</span>
                            </div>
                            <div class="payment-row">
                                <label>Amount Paid:</label>
                                <span>${Utils.formatCurrency(invoiceData.amountPaid)}</span>
                            </div>
                            <div class="payment-row">
                                <label>Payment Method:</label>
                                <span>${invoiceData.paymentMethod === 'cash' ? 'Cash' : 'GPay'}</span>
                            </div>
                            <div class="payment-row">
                                <label>Balance Due:</label>
                                <span>${Utils.formatCurrency(invoiceData.balanceDue)}</span>
                            </div>
                        </div>

                        <div class="payment-info">
                            <h3>Payment Information</h3>
                            <p><strong>For Cash Payments:</strong> Please pay at our office</p>
                            <p><strong>For GPay Payments:</strong> Use UPI ID: prfabrics@okhdfcbank</p>
                        </div>
                    </div>

                    <div class="signature-section">
                        <div class="declaration">
                            <p>Certified that the particulars given above are true and correct</p>
                            <p>**TERMS AND CONDITIONS APPLY FOR PR FABRICS</p>
                        </div>
                        <div class="customer-signature">
                            <p>Agreed and accepted the conditions and signed</p>
                            <p class="signature-line">Signature of Customer</p>
                            <p>Authorized signatory</p>
                        </div>
                        <div class="company-signature">
                            <p class="signature-line">For PR FABRICS</p>
                            <p>Authorized signatory</p>
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
            // printWindow.close(); // Uncomment if you want to automatically close after printing
        }, 500);
    }
}