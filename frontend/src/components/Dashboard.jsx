
import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import {
  AccountBalance,
  TrendingUp,
  TrendingDown,
  AttachMoney,
} from '@mui/icons-material';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { accounts, transactions, borrowings, workSchedule } from '../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalBalance: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    pendingBorrowings: 0,
    recentTransactions: [],
    monthlyData: [],
    categoryData: [],
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data
      const [accountsRes, transactionsRes, borrowingsRes, workRes] = await Promise.all([
        accounts.getAll(),
        transactions.getAll({
          startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          endDate: new Date(),
        }),
        borrowings.getAll(),
        workSchedule.getAll({
          startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          endDate: new Date(),
        }),
      ]);

      // Calculate total balance (converting all to USD)
      const totalBalance = accountsRes.data.reduce((sum, account) => {
        // You'll need to convert based on currency
        return sum + account.balance;
      }, 0);

      // Calculate monthly income and expenses
      const monthlyIncome = transactionsRes.data
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amountInUSD, 0);

      const monthlyExpense = transactionsRes.data
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amountInUSD, 0);

      // Calculate pending borrowings
      const pendingBorrowings = borrowingsRes.data
        .filter(b => !b.isPaid)
        .reduce((sum, b) => {
          return sum + (b.type === 'lent' ? b.amountInUSD : -b.amountInUSD);
        }, 0);

      // Get recent transactions
      const recentTransactions = transactionsRes.data.slice(0, 5);

      // Prepare monthly chart data
      const monthlyData = prepareMonthlyData(transactionsRes.data);

      // Prepare category pie chart data
      const categoryData = prepareCategoryData(transactionsRes.data);

      setData({
        totalBalance,
        monthlyIncome,
        monthlyExpense,
        pendingBorrowings,
        recentTransactions,
        monthlyData,
        categoryData,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const prepareMonthlyData = (transactions) => {
    const grouped = transactions.reduce((acc, t) => {
      const day = format(new Date(t.date), 'MMM dd');
      if (!acc[day]) {
        acc[day] = { date: day, income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        acc[day].income += t.amountInUSD;
      } else if (t.type === 'expense') {
        acc[day].expense += t.amountInUSD;
      }
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
  };

  const prepareCategoryData = (transactions) => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const grouped = expenses.reduce((acc, t) => {
      if (!acc[t.category]) {
        acc[t.category] = 0;
      }
      acc[t.category] += t.amountInUSD;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Financial Dashboard
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Balance
                  </Typography>
                  <Typography variant="h5">
                    ${data.totalBalance.toFixed(2)}
                  </Typography>
                </Box>
                <AccountBalance color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Monthly Income
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    ${data.monthlyIncome.toFixed(2)}
                  </Typography>
                </Box>
                <TrendingUp color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Monthly Expenses
                  </Typography>
                  <Typography variant="h5" color="error.main">
                    ${data.monthlyExpense.toFixed(2)}
                  </Typography>
                </Box>
                <TrendingDown color="error" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Pending Borrowings
                  </Typography>
                  <Typography variant="h5">
                    ${Math.abs(data.pendingBorrowings).toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {data.pendingBorrowings > 0 ? 'To receive' : 'To pay'}
                  </Typography>
                </Box>
                <AttachMoney color="action" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Income vs Expenses Trend
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="income" 
                  stroke="#00C49F" 
                  name="Income"
                />
                <Line 
                  type="monotone" 
                  dataKey="expense" 
                  stroke="#FF8042" 
                  name="Expenses"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Expense Categories
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: $${entry.value.toFixed(0)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Transactions */}
      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Recent Transactions
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Account</TableCell>
                <TableCell align="right">Amount (USD)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.recentTransactions.map((transaction) => (
                <TableRow key={transaction._id}>
                  <TableCell>
                    {format(new Date(transaction.date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell>{transaction.category}</TableCell>
                  <TableCell>{transaction.account?.name}</TableCell>
                  <TableCell 
                    align="right"
                    sx={{
                      color: transaction.type === 'income' ? 'success.main' : 'error.main',
                      fontWeight: 'medium',
                    }}
                  >
                    {transaction.type === 'income' ? '+' : '-'}$
                    {transaction.amountInUSD.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default Dashboard;

