// Dashboard Analytics JavaScript
class Dashboard {
    constructor() {
        this.charts = {};
        this.invoices = [];
        this.payments = [];
        this.init();
    }

    async init() {
        // Initialize database and load data
        await db.init();
        await this.loadData();
        this.initializeCharts();
        this.setupEventListeners();
        this.updateDashboard();
    }

    async loadData() {
        try {
            this.invoices = await db.getAllInvoices();
            this.payments = await this.getAllPayments();
            console.log('Data loaded:', this.invoices.length, 'invoices found');
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async getAllPayments() {
        // Get all payments from all invoices
        const payments = [];
        for (const invoice of this.invoices) {
            const invoicePayments = await db.getPaymentsByInvoice(invoice.invoiceNo);
            payments.push(...invoicePayments);
        }
        return payments;
    }

    initializeCharts() {
        // Revenue Chart
        this.charts.revenue = new Chart(document.getElementById('revenueChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Revenue',
                    data: [],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `Revenue: ₹${context.parsed.y.toLocaleString('en-IN')}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString('en-IN');
                            }
                        }
                    }
                }
            }
        });

        // Invoice Chart
        this.charts.invoice = new Chart(document.getElementById('invoiceChart'), {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Invoices',
                    data: [],
                    backgroundColor: '#27ae60',
                    borderColor: '#2ecc71',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });

        // Customer Chart
        this.charts.customer = new Chart(document.getElementById('customerChart'), {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#3498db', '#27ae60', '#e74c3c', '#f39c12', 
                        '#9b59b6', '#1abc9c', '#d35400', '#c0392b',
                        '#16a085', '#2980b9'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 15
                        }
                    }
                }
            }
        });

        // Payment Status Chart
        this.charts.payment = new Chart(document.getElementById('paymentChart'), {
            type: 'pie',
            data: {
                labels: ['Paid', 'Pending', 'Overdue'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#27ae60', '#f39c12', '#e74c3c'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    setupEventListeners() {
        // Period selectors
        document.getElementById('revenuePeriod').addEventListener('change', (e) => {
            this.updateRevenueChart(e.target.value);
        });

        document.getElementById('invoicePeriod').addEventListener('change', (e) => {
            this.updateInvoiceChart(e.target.value);
        });

        document.getElementById('customerLimit').addEventListener('change', (e) => {
            this.updateCustomerChart(parseInt(e.target.value));
        });

        // Refresh buttons
        document.getElementById('refreshActivity').addEventListener('click', () => {
            this.updateRecentActivity();
        });

        document.getElementById('refreshPending').addEventListener('click', () => {
            this.updatePendingInvoices();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', this.logout);
    }

    updateDashboard() {
        this.updateSummaryCards();
        this.updateRevenueChart('30d');
        this.updateInvoiceChart('30d');
        this.updateCustomerChart(10);
        this.updatePaymentChart();
        this.updateRecentActivity();
        this.updatePendingInvoices();
        this.updateQuickStats();
    }

    updateSummaryCards() {
        const totalRevenue = this.invoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0);
        const totalInvoices = this.invoices.length;
        const pendingAmount = this.invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
        const pendingCount = this.invoices.filter(inv => inv.balanceDue > 0).length;

        // Find top customer
        const customerRevenue = {};
        this.invoices.forEach(invoice => {
            if (customerRevenue[invoice.customerName]) {
                customerRevenue[invoice.customerName] += invoice.grandTotal;
            } else {
                customerRevenue[invoice.customerName] = invoice.grandTotal;
            }
        });

        const topCustomer = Object.entries(customerRevenue)
            .sort(([,a], [,b]) => b - a)[0] || ['-', 0];

        // Update DOM
        document.getElementById('totalRevenue').textContent = `₹${Utils.formatCurrency(totalRevenue)}`;
        document.getElementById('totalInvoices').textContent = totalInvoices;
        document.getElementById('pendingPayments').textContent = `₹${Utils.formatCurrency(pendingAmount)}`;
        document.getElementById('pendingCount').textContent = `${pendingCount} invoices`;
        document.getElementById('topCustomer').textContent = topCustomer[0];
        document.getElementById('topCustomerAmount').textContent = `₹${Utils.formatCurrency(topCustomer[1])}`;

        // Calculate trends (simplified - in real app, compare with previous period)
        const revenueTrend = totalInvoices > 0 ? 12.5 : 0; // Mock trend
        const invoiceTrend = totalInvoices > 0 ? 8.3 : 0; // Mock trend

        document.getElementById('revenueTrend').innerHTML = 
            `<i class="fas fa-arrow-up"></i> ${revenueTrend}%`;
        document.getElementById('invoiceTrend').innerHTML = 
            `<i class="fas fa-arrow-up"></i> ${invoiceTrend}%`;
    }

    updateRevenueChart(period) {
        const data = this.getRevenueData(period);
        this.charts.revenue.data.labels = data.labels;
        this.charts.revenue.data.datasets[0].data = data.values;
        this.charts.revenue.update();
    }

    updateInvoiceChart(period) {
        const data = this.getInvoiceData(period);
        this.charts.invoice.data.labels = data.labels;
        this.charts.invoice.data.datasets[0].data = data.values;
        this.charts.invoice.update();
    }

    updateCustomerChart(limit) {
        const data = this.getCustomerData(limit);
        this.charts.customer.data.labels = data.labels;
        this.charts.customer.data.datasets[0].data = data.values;
        this.charts.customer.update();
    }

    updatePaymentChart() {
        const paid = this.invoices.filter(inv => inv.balanceDue === 0).length;
        const pending = this.invoices.filter(inv => inv.balanceDue > 0).length;
        const overdue = this.invoices.filter(inv => this.isOverdue(inv)).length;

        this.charts.payment.data.datasets[0].data = [paid, pending, overdue];
        this.charts.payment.update();
    }

    updateRecentActivity() {
        const tableBody = document.getElementById('activityTableBody');
        const recentInvoices = this.invoices
            .sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate))
            .slice(0, 10);

        tableBody.innerHTML = recentInvoices.map(invoice => `
            <tr>
                <td>${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</td>
                <td>${invoice.invoiceNo}</td>
                <td>${invoice.customerName}</td>
                <td>₹${Utils.formatCurrency(invoice.grandTotal)}</td>
                <td>
                    <span class="status-${invoice.balanceDue === 0 ? 'paid' : 
                        this.isOverdue(invoice) ? 'overdue' : 'pending'}">
                        ${invoice.balanceDue === 0 ? 'Paid' : 
                         this.isOverdue(invoice) ? 'Overdue' : 'Pending'}
                    </span>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" class="no-data">No recent activity</td></tr>';
    }

    updatePendingInvoices() {
        const tableBody = document.getElementById('pendingTableBody');
        const pendingInvoices = this.invoices
            .filter(inv => inv.balanceDue > 0)
            .sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate))
            .slice(0, 10);

        tableBody.innerHTML = pendingInvoices.map(invoice => {
            const dueDate = new Date(invoice.invoiceDate);
            dueDate.setDate(dueDate.getDate() + 30); // Assume 30-day payment terms
            
            return `
                <tr>
                    <td>${invoice.invoiceNo}</td>
                    <td>${invoice.customerName}</td>
                    <td>${dueDate.toLocaleDateString('en-IN')}</td>
                    <td>₹${Utils.formatCurrency(invoice.balanceDue)}</td>
                    <td>
                        <button class="btn-action btn-pay" onclick="dashboard.addPayment('${invoice.invoiceNo}')">
                            Add Payment
                        </button>
                        <button class="btn-action btn-view" onclick="dashboard.viewInvoice('${invoice.invoiceNo}')">
                            View
                        </button>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="5" class="no-data">No pending payments</td></tr>';
    }

    updateQuickStats() {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const monthlyRevenue = this.invoices
            .filter(inv => {
                const invDate = new Date(inv.invoiceDate);
                return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
            })
            .reduce((sum, inv) => sum + inv.grandTotal, 0);

        const avgInvoice = this.invoices.length > 0 ? 
            this.invoices.reduce((sum, inv) => sum + inv.grandTotal, 0) / this.invoices.length : 0;

        const paidInvoices = this.invoices.filter(inv => inv.balanceDue === 0).length;
        const overdueInvoices = this.invoices.filter(inv => this.isOverdue(inv)).length;

        document.getElementById('monthlyRevenue').textContent = `₹${Utils.formatCurrency(monthlyRevenue)}`;
        document.getElementById('avgInvoice').textContent = `₹${Utils.formatCurrency(avgInvoice)}`;
        document.getElementById('paidInvoices').textContent = paidInvoices;
        document.getElementById('overdueInvoices').textContent = overdueInvoices;
    }

    // Data processing methods
    getRevenueData(period) {
        const { startDate, labels } = this.getDateRange(period);
        
        const revenueByDate = {};
        labels.forEach(label => revenueByDate[label] = 0);

        this.invoices.forEach(invoice => {
            const invoiceDate = new Date(invoice.invoiceDate);
            if (invoiceDate >= startDate) {
                const label = this.getDateLabel(invoiceDate, period);
                if (revenueByDate.hasOwnProperty(label)) {
                    revenueByDate[label] += invoice.grandTotal;
                }
            }
        });

        return {
            labels: labels,
            values: labels.map(label => revenueByDate[label])
        };
    }

    getInvoiceData(period) {
        const { startDate, labels } = this.getDateRange(period);
        
        const invoicesByDate = {};
        labels.forEach(label => invoicesByDate[label] = 0);

        this.invoices.forEach(invoice => {
            const invoiceDate = new Date(invoice.invoiceDate);
            if (invoiceDate >= startDate) {
                const label = this.getDateLabel(invoiceDate, period);
                if (invoicesByDate.hasOwnProperty(label)) {
                    invoicesByDate[label] += 1;
                }
            }
        });

        return {
            labels: labels,
            values: labels.map(label => invoicesByDate[label])
        };
    }

    getCustomerData(limit) {
        const customerRevenue = {};
        
        this.invoices.forEach(invoice => {
            if (customerRevenue[invoice.customerName]) {
                customerRevenue[invoice.customerName] += invoice.grandTotal;
            } else {
                customerRevenue[invoice.customerName] = invoice.grandTotal;
            }
        });

        const sortedCustomers = Object.entries(customerRevenue)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit);

        return {
            labels: sortedCustomers.map(([name]) => name),
            values: sortedCustomers.map(([,revenue]) => revenue)
        };
    }

    getDateRange(period) {
        const now = new Date();
        let startDate = new Date();
        let labels = [];

        switch (period) {
            case '7d':
                startDate.setDate(now.getDate() - 7);
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(now.getDate() - i);
                    labels.push(date.toLocaleDateString('en-IN', { weekday: 'short' }));
                }
                break;
            case '30d':
                startDate.setDate(now.getDate() - 30);
                for (let i = 29; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(now.getDate() - i);
                    labels.push(date.getDate().toString());
                }
                break;
            case '90d':
                startDate.setDate(now.getDate() - 90);
                for (let i = 11; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(now.getDate() - (i * 7));
                    labels.push(`Week ${12 - i}`);
                }
                break;
            case '1y':
                startDate.setFullYear(now.getFullYear() - 1);
                for (let i = 11; i >= 0; i--) {
                    const date = new Date();
                    date.setMonth(now.getMonth() - i);
                    labels.push(date.toLocaleDateString('en-IN', { month: 'short' }));
                }
                break;
        }

        return { startDate, labels };
    }

    getDateLabel(date, period) {
        switch (period) {
            case '7d':
                return date.toLocaleDateString('en-IN', { weekday: 'short' });
            case '30d':
                return date.getDate().toString();
            case '90d':
                const weekNumber = Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7);
                return `Week ${weekNumber}`;
            case '1y':
                return date.toLocaleDateString('en-IN', { month: 'short' });
            default:
                return date.toLocaleDateString('en-IN');
        }
    }

    isOverdue(invoice) {
        const invoiceDate = new Date(invoice.invoiceDate);
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + 30); // 30-day payment terms
        return invoice.balanceDue > 0 && new Date() > dueDate;
    }

    // Action methods
    async addPayment(invoiceNo) {
        const amount = prompt('Enter payment amount:');
        if (amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0) {
            try {
                const invoiceData = await db.getInvoice(invoiceNo);
                if (invoiceData) {
                    const paymentAmount = parseFloat(amount);
                    const newAmountPaid = invoiceData.amountPaid + paymentAmount;
                    
                    // Update invoice with new payment
                    invoiceData.amountPaid = newAmountPaid;
                    invoiceData.balanceDue = invoiceData.grandTotal - newAmountPaid;
                    
                    await db.saveInvoice(invoiceData);
                    
                    // Save payment record
                    const paymentData = {
                        invoiceNo: invoiceNo,
                        paymentDate: new Date().toISOString().split('T')[0],
                        amount: paymentAmount,
                        paymentType: 'additional'
                    };
                    await db.savePayment(paymentData);
                    
                    alert('Payment added successfully!');
                    await this.loadData();
                    this.updateDashboard();
                } else {
                    alert('Invoice not found!');
                }
            } catch (error) {
                console.error('Error adding payment:', error);
                alert('Error adding payment.');
            }
        } else if (amount !== null) {
            alert('Please enter a valid payment amount.');
        }
    }

    viewInvoice(invoiceNo) {
        window.location.href = `index.html?edit=${invoiceNo}`;
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            window.location.href = 'login.html';
        }
    }

    showError(message) {
        // Simple error notification
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e74c3c;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', async function() {
    dashboard = new Dashboard();
});

// Utility function to refresh dashboard data
async function refreshDashboard() {
    if (dashboard) {
        await dashboard.loadData();
        dashboard.updateDashboard();
    }
}