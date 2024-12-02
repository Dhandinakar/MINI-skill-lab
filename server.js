const express = require('express');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

// Initialize express app
const app = express();
app.use(express.json());

// In-memory storage for food orders
let foodOrders = [];
let predefinedCategories = ["Pizza", "Burgers", "Pasta", "Sushi", "Salads"];

// Utility function to validate food orders
function isValidOrder(order) {
  const { category, amount, date, quantity } = order;
  return predefinedCategories.includes(category) && !isNaN(amount) && amount > 0 && quantity > 0 && new Date(date).toString() !== "Invalid Date";
}

// 1. Add a new food order (POST /orders)
app.post('/orders', (req, res) => {
  const { category, amount, date, quantity } = req.body;

  // Validate order data
  if (!category || !amount || !date || !quantity || !isValidOrder(req.body)) {
    return res.status(400).json({ status: 'error', data: null, error: 'Invalid order data' });
  }

  const order = {
    id: uuidv4(),
    category,
    amount,
    quantity,
    date: new Date(date)
  };

  foodOrders.push(order);
  res.status(201).json({ status: 'success', data: order, error: null });
});

// 2. Get food orders (GET /orders) with optional filters
app.get('/orders', (req, res) => {
  const { category, startDate, endDate } = req.query;
  let filteredOrders = [...foodOrders];

  // Filter by category
  if (category && predefinedCategories.includes(category)) {
    filteredOrders = filteredOrders.filter(order => order.category === category);
  }

  // Filter by date range (if provided)
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start.toString() !== "Invalid Date" && end.toString() !== "Invalid Date") {
      filteredOrders = filteredOrders.filter(order => new Date(order.date) >= start && new Date(order.date) <= end);
    } else {
      return res.status(400).json({ status: 'error', data: null, error: 'Invalid date range' });
    }
  }

  res.status(200).json({ status: 'success', data: filteredOrders, error: null });
});

// 3. Analyze food orders (GET /orders/analysis)
app.get('/orders/analysis', (req, res) => {
  // Total by category
  const categoryTotals = foodOrders.reduce((acc, order) => {
    if (!acc[order.category]) {
      acc[order.category] = 0;
    }
    acc[order.category] += order.amount * order.quantity; // Total amount based on quantity
    return acc;
  }, {});

  // Highest spending category
  const highestSpendingCategory = Object.entries(categoryTotals).reduce((max, curr) => curr[1] > max[1] ? curr : max, ["", 0]);

  // Monthly totals
  const monthlyTotals = foodOrders.reduce((acc, order) => {
    const monthYear = `${order.date.getMonth() + 1}-${order.date.getFullYear()}`;
    if (!acc[monthYear]) {
      acc[monthYear] = 0;
    }
    acc[monthYear] += order.amount * order.quantity;
    return acc;
  }, {});

  res.status(200).json({
    status: 'success',
    data: {
      categoryTotals,
      highestSpendingCategory: { category: highestSpendingCategory[0], amount: highestSpendingCategory[1] },
      monthlyTotals
    },
    error: null
  });
});

// 4. CRON job to generate summary (Weekly and Monthly reports)
cron.schedule('0 0 * * 0', () => { // Every Sunday at midnight
  const weeklySummary = generateSummary('week');
  console.log('Weekly Summary:', weeklySummary);
});

cron.schedule('0 0 1 * *', () => { // Every 1st day of the month at midnight
  const monthlySummary = generateSummary('month');
  console.log('Monthly Summary:', monthlySummary);
});

// Function to generate a summary (weekly or monthly)
function generateSummary(period) {
  const now = new Date();
  let startDate;

  if (period === 'week') {
    // Get the start of the current week (Sunday)
    startDate = new Date(now.setDate(now.getDate() - now.getDay()));
  } else if (period === 'month') {
    // Get the start of the current month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const filteredOrders = foodOrders.filter(order => new Date(order.date) >= startDate);

  // Summarize total spending for this period
  const total = filteredOrders.reduce((acc, order) => acc + order.amount * order.quantity, 0);
  return { period, total, orders: filteredOrders.length };
}

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Food Ordering API running on port ${PORT}`);
});
