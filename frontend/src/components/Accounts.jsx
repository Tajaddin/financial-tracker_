
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Grid,
  MenuItem,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccountBalance as AccountBalanceIcon,
} from '@mui/icons-material';
import { accounts } from '../services/api';

const CURRENCIES = ['USD', 'EUR', 'AZN'];
const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  AZN: '₼',
};

const EXCHANGE_RATES = {
  USD: 1,
  AZN: 1.7015,
  EUR: 0.92,
};

function Accounts() {
  const [accountsList, setAccountsList] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    bankName: '',
    accountNumber: '',
    currency: 'USD',
    balance: 0,
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await accounts.getAll();
      setAccountsList(response.data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleOpenDialog = (account = null) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        currency: account.currency,
        balance: account.balance,
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: '',
        bankName: '',
        accountNumber: '',
        currency: 'USD',
        balance: 0,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingAccount(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'balance' ? parseFloat(value) || 0 : value,
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingAccount) {
        await accounts.update(editingAccount._id, formData);
      } else {
        await accounts.create(formData);
      }
      handleCloseDialog();
      fetchAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      try {
        await accounts.delete(id);
        fetchAccounts();
      } catch (error) {
        console.error('Error deleting account:', error);
      }
    }
  };

  const convertToUSD = (amount, currency) => {
    return amount / EXCHANGE_RATES[currency];
  };

  const getTotalBalanceUSD = () => {
    return accountsList.reduce((total, account) => {
      return total + convertToUSD(account.balance, account.currency);
    }, 0);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Bank Accounts</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Account
        </Button>
      </Box>

      <Card sx={{ mb: 3, bgcolor: 'primary.main', color: 'white' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Total Balance (USD)
          </Typography>
          <Typography variant="h3">
            ${getTotalBalanceUSD().toFixed(2)}
          </Typography>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {accountsList.map((account) => (
          <Grid item xs={12} md={6} lg={4} key={account._id}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <AccountBalanceIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">{account.name}</Typography>
                </Box>
                <Typography color="textSecondary" gutterBottom>
                  {account.bankName}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Account: {account.accountNumber}
                </Typography>
                <Box display="flex" alignItems="center" mt={2}>
                  <Chip
                    label={account.currency}
                    color="primary"
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Typography variant="h5">
                    {CURRENCY_SYMBOLS[account.currency]}
                    {account.balance.toFixed(2)}
                  </Typography>
                </Box>
                <Typography variant="body2" color="textSecondary" mt={1}>
                  ≈ ${convertToUSD(account.balance, account.currency).toFixed(2)} USD
                </Typography>
              </CardContent>
              <CardActions>
                <IconButton onClick={() => handleOpenDialog(account)} size="small">
                  <EditIcon />
                </IconButton>
                <IconButton
                  onClick={() => handleDelete(account._id)}
                  size="small"
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAccount ? 'Edit Account' : 'Add New Account'}
        </DialogTitle>
        <DialogContent>
          <TextField
            name="name"
            label="Account Name"
            fullWidth
            margin="normal"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
          <TextField
            name="bankName"
            label="Bank Name"
            fullWidth
            margin="normal"
            value={formData.bankName}
            onChange={handleInputChange}
            required
          />
          <TextField
            name="accountNumber"
            label="Account Number"
            fullWidth
            margin="normal"
            value={formData.accountNumber}
            onChange={handleInputChange}
            required
          />
          <TextField
            name="currency"
            label="Currency"
            select
            fullWidth
            margin="normal"
            value={formData.currency}
            onChange={handleInputChange}
            required
          >
            {CURRENCIES.map((currency) => (
              <MenuItem key={currency} value={currency}>
                {currency} ({CURRENCY_SYMBOLS[currency]})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            name="balance"
            label="Current Balance"
            type="number"
            fullWidth
            margin="normal"
            value={formData.balance}
            onChange={handleInputChange}
            inputProps={{ step: 0.01 }}
            required
          />
          {formData.currency !== 'USD' && (
            <Typography variant="body2" color="textSecondary" mt={1}>
              ≈ ${convertToUSD(formData.balance || 0, formData.currency).toFixed(2)} USD
              (Rate: 1 {formData.currency} = {(1 / EXCHANGE_RATES[formData.currency]).toFixed(4)} USD)
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingAccount ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Accounts;

