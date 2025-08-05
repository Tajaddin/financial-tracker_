
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  MenuItem,
  Grid,
  Chip,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Done as DoneIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { borrowings } from '../services/api';

const CURRENCIES = ['USD', 'EUR', 'AZN'];
const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  AZN: '₼',
};

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function Borrowings() {
  const [borrowingsList, setBorrowingsList] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    type: 'lent',
    personName: '',
    amount: '',
    currency: 'USD',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    dueDate: '',
  });

  useEffect(() => {
    fetchBorrowings();
  }, []);

  const fetchBorrowings = async () => {
    try {
      const response = await borrowings.getAll();
      setBorrowingsList(response.data);
    } catch (error) {
      console.error('Error fetching borrowings:', error);
    }
  };

  const handleOpenDialog = (type = 'lent') => {
    setFormData({
      type,
      personName: '',
      amount: '',
      currency: 'USD',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      dueDate: '',
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async () => {
    try {
      await borrowings.create({
        ...formData,
        amount: parseFloat(formData.amount),
      });
      handleCloseDialog();
      fetchBorrowings();
    } catch (error) {
      console.error('Error creating borrowing:', error);
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      await borrowings.markPaid(id);
      fetchBorrowings();
    } catch (error) {
      console.error('Error marking as paid:', error);
    }
  };

  const getLentItems = () => borrowingsList.filter(b => b.type === 'lent');
  const getBorrowedItems = () => borrowingsList.filter(b => b.type === 'borrowed');

  const getTotalAmount = (items) => {
    return items.reduce((sum, item) => {
      return sum + (item.isPaid ? 0 : item.amountInUSD);
    }, 0);
  };

  const renderBorrowingCard = (item) => (
    <Grid item xs={12} md={6} key={item._id}>
      <Card sx={{ opacity: item.isPaid ? 0.7 : 1 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="start">
            <Box>
              <Box display="flex" alignItems="center" mb={1}>
                <PersonIcon sx={{ mr: 1 }} />
                <Typography variant="h6">{item.personName}</Typography>
              </Box>
              <Typography variant="h5" gutterBottom>
                {CURRENCY_SYMBOLS[item.currency]}{item.amount.toFixed(2)}
              </Typography>
              {item.currency !== 'USD' && (
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  ≈ ${item.amountInUSD.toFixed(2)} USD
                </Typography>
              )}
              {item.description && (
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {item.description}
                </Typography>
              )}
              <Box display="flex" alignItems="center" gap={2} mt={1}>
                <Typography variant="caption" color="textSecondary">
                  <CalendarIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                  {format(new Date(item.date), 'MMM dd, yyyy')}
                </Typography>
                {item.dueDate && (
                  <Typography variant="caption" color="textSecondary">
                    Due: {format(new Date(item.dueDate), 'MMM dd, yyyy')}
                  </Typography>
                )}
              </Box>
            </Box>
            <Box>
              {item.isPaid ? (
                <Chip label="Paid" color="success" size="small" />
              ) : (
                <IconButton
                  onClick={() => handleMarkPaid(item._id)}
                  color="primary"
                  title="Mark as paid"
                >
                  <DoneIcon />
                </IconButton>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Borrowings</Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total to Receive
              </Typography>
              <Typography variant="h3">
                ${getTotalAmount(getLentItems()).toFixed(2)}
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog('lent')}
                sx={{ mt: 2, bgcolor: 'white', color: 'success.main' }}
              >
                Add Money Lent
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: 'error.main', color: 'white' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total to Pay
              </Typography>
              <Typography variant="h3">
                ${getTotalAmount(getBorrowedItems()).toFixed(2)}
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog('borrowed')}
                sx={{ mt: 2, bgcolor: 'white', color: 'error.main' }}
              >
                Add Money Borrowed
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
        <Tab label={`Money Lent (${getLentItems().length})`} />
        <Tab label={`Money Borrowed (${getBorrowedItems().length})`} />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>
          {getLentItems().map(renderBorrowingCard)}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2}>
          {getBorrowedItems().map(renderBorrowingCard)}
        </Grid>
      </TabPanel>

      {/* Add Borrowing Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {formData.type === 'lent' ? 'Add Money Lent' : 'Add Money Borrowed'}
        </DialogTitle>
        <DialogContent>
          <TextField
            name="personName"
            label="Person Name"
            fullWidth
            margin="normal"
            value={formData.personName}
            onChange={handleInputChange}
            required
          />
          <Grid container spacing={2}>
            <Grid item xs={8}>
              <TextField
                name="amount"
                label="Amount"
                type="number"
                fullWidth
                margin="normal"
                value={formData.amount}
                onChange={handleInputChange}
                inputProps={{ step: 0.01 }}
                required
              />
            </Grid>
            <Grid item xs={4}>
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
                    {currency}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          <TextField
            name="description"
            label="Description/Notes"
            fullWidth
            margin="normal"
            value={formData.description}
            onChange={handleInputChange}
            multiline
            rows={2}
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
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
            </Grid>
            <Grid item xs={6}>
              <TextField
                name="dueDate"
                label="Due Date (Optional)"
                type="date"
                fullWidth
                margin="normal"
                value={formData.dueDate}
                onChange={handleInputChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Borrowings;
