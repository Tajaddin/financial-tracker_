
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  FileUpload as FileUploadIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { transactions, accounts as accountsApi } from '../services/api';

const TRANSACTION_TYPES = ['income', 'expense', 'transfer'];
const CATEGORIES = {
  income: ['Salary', 'Tips', 'Freelance', 'Investment', 'Gift', 'Other Income'],
  expense: ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Rent', 'Healthcare', 'Other Expense'],
  transfer: ['Transfer'],
};

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  AZN: '₼',
};

function Transactions() {
  const [transactionsList, setTransactionsList] = useState([]);
  const [accountsList, setAccountsList] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [filters, setFilters] = useState({
    accountId: '',
    category: '',
    startDate: '',
    endDate: '',
    search: '',
  });
  const [formData, setFormData] = useState({
    accountId: '',
    type: 'expense',
    category: '',
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [importData, setImportData] = useState({
    accountId: '',
    file: null,
    fileType: '',
  });

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  const fetchAccounts = async () => {
    try {
      const response = await accountsApi.getAll();
      setAccountsList(response.data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const params = {};
      if (filters.accountId) params.accountId = filters.accountId;
      if (filters.category) params.category = filters.category;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await transactions.getAll(params);
      
      let filteredData = response.data;
      if (filters.search) {
        filteredData = filteredData.filter(t =>
          t.description?.toLowerCase().includes(filters.search.toLowerCase()) ||
          t.category?.toLowerCase().includes(filters.search.toLowerCase())
        );
      }
      
      setTransactionsList(filteredData);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      accountId: accountsList[0]?._id || '',
      type: 'expense',
      category: '',
      amount: '',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'type') {
      setFormData({
        ...formData,
        [name]: value,
        category: '', // Reset category when type changes
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const account = accountsList.find(a => a._id === formData.accountId);
      await transactions.create({
        ...formData,
        amount: parseFloat(formData.amount),
        currency: account.currency,
      });
      handleCloseDialog();
      fetchTransactions();
    } catch (error) {
      console.error('Error creating transaction:', error);
    }
  };

  const handleImportSubmit = async () => {
    if (!importData.file || !importData.accountId) return;

    const formData = new FormData();
    formData.append('statement', importData.file);
    formData.append('accountId', importData.accountId);
    formData.append('fileType', importData.fileType);

    try {
      await transactions.import(formData);
      setOpenImportDialog(false);
      fetchTransactions();
      alert('Transactions imported successfully!');
    } catch (error) {
      console.error('Error importing transactions:', error);
      alert('Error importing transactions');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const extension = file.name.split('.').pop().toLowerCase();
      setImportData({
        ...importData,
        file,
        fileType: extension,
      });
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'income':
        return 'success';
      case 'expense':
        return 'error';
      case 'transfer':
        return 'info';
      default:
        return 'default';
    }
  };

  const selectedAccount = accountsList.find(a => a._id === formData.accountId);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Transactions</Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={() => setOpenImportDialog(true)}
          >
            Import Statement
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
          >
            Add Transaction
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Search"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Account</InputLabel>
              <Select
                value={filters.accountId}
                onChange={(e) => setFilters({ ...filters, accountId: e.target.value })}
                label="Account"
              >
                <MenuItem value="">All</MenuItem>
                {accountsList.map((account) => (
                  <MenuItem key={account._id} value={account._id}>
                    {account.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                label="Category"
              >
                <MenuItem value="">All</MenuItem>
                {Object.values(CATEGORIES).flat().map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="End Date"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Transactions Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Account</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">USD Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactionsList.map((transaction) => (
              <TableRow key={transaction._id}>
                <TableCell>
                  {format(new Date(transaction.date), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell>
                  <Chip
                    label={transaction.type}
                    color={getTypeColor(transaction.type)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{transaction.category}</TableCell>
                <TableCell>{transaction.description}</TableCell>
                <TableCell>{transaction.account?.name}</TableCell>
                <TableCell align="right">
                  {transaction.type === 'expense' ? '-' : '+'}
                  {CURRENCY_SYMBOLS[transaction.originalCurrency]}
                  {transaction.originalAmount.toFixed(2)}
                </TableCell>
                <TableCell align="right">
                  {transaction.type === 'expense' ? '-' : '+'}$
                  {transaction.amountInUSD.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Transaction Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Transaction</DialogTitle>
        <DialogContent>
          <TextField
            name="accountId"
            label="Account"
            select
            fullWidth
            margin="normal"
            value={formData.accountId}
            onChange={handleInputChange}
            required
          >
            {accountsList.map((account) => (
              <MenuItem key={account._id} value={account._id}>
                {account.name} ({account.currency})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            name="type"
            label="Type"
            select
            fullWidth
            margin="normal"
            value={formData.type}
            onChange={handleInputChange}
            required
          >
            {TRANSACTION_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            name="category"
            label="Category"
            select
            fullWidth
            margin="normal"
            value={formData.category}
            onChange={handleInputChange}
            required
          >
            {CATEGORIES[formData.type]?.map((category) => (
              <MenuItem key={category} value={category}>
                {category}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            name="amount"
            label="Amount"
            type="number"
            fullWidth
            margin="normal"
            value={formData.amount}
            onChange={handleInputChange}
            inputProps={{ step: 0.01 }}
            InputProps={{
              startAdornment: selectedAccount && (
                <InputAdornment position="start">
                  {CURRENCY_SYMBOLS[selectedAccount.currency]}
                </InputAdornment>
              ),
            }}
            required
          />
          <TextField
            name="description"
            label="Description"
            fullWidth
            margin="normal"
            value={formData.description}
            onChange={handleInputChange}
            multiline
            rows={2}
          />
          <TextField
            name="date"
            label="Date"
            type="date"
            fullWidth
            margin="normal"
            value={formData.date}
            onChange={handleInputChange}
            InputLabelProps={{ shrink: true }}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={openImportDialog} onClose={() => setOpenImportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import Bank Statement</DialogTitle>
        <DialogContent>
          <TextField
            label="Account"
            select
            fullWidth
            margin="normal"
            value={importData.accountId}
            onChange={(e) => setImportData({ ...importData, accountId: e.target.value })}
            required
          >
            {accountsList.map((account) => (
              <MenuItem key={account._id} value={account._id}>
                {account.name} ({account.currency})
              </MenuItem>
            ))}
          </TextField>
          <Box mt={2}>
            <input
              accept=".csv,.xlsx,.xls,.pdf"
              style={{ display: 'none' }}
              id="file-upload"
              type="file"
              onChange={handleFileChange}
            />
            <label htmlFor="file-upload">
              <Button variant="outlined" component="span" fullWidth>
                {importData.file ? importData.file.name : 'Choose File'}
              </Button>
            </label>
          </Box>
          <Typography variant="caption" color="textSecondary" mt={1}>
            Supported formats: CSV, Excel (.xlsx, .xls), PDF
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenImportDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleImportSubmit} 
            variant="contained"
            disabled={!importData.file || !importData.accountId}
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Transactions;
