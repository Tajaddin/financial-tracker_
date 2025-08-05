
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Work as WorkIcon,
  AttachMoney as MoneyIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { workSchedule, accounts as accountsApi } from '../services/api';

const POSITIONS = ['Cashier', 'Server', 'Manager', 'Delivery', 'Other'];

function WorkSchedule() {
  const [scheduleList, setScheduleList] = useState([]);
  const [accountsList, setAccountsList] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    position: 'Cashier',
    hourlyRate: 11,
    startTime: '09:00',
    endTime: '17:00',
    tips: 0,
    notes: '',
    accountId: '',
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [selectedMonth]);

  const fetchAccounts = async () => {
    try {
      const response = await accountsApi.getAll();
      setAccountsList(response.data);
      if (response.data.length > 0 && !formData.accountId) {
        setFormData(prev => ({ ...prev, accountId: response.data[0]._id }));
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchSchedule = async () => {
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));
      
      const response = await workSchedule.getAll({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      });
      setScheduleList(response.data);
    } catch (error) {
      console.error('Error fetching schedule:', error);
    }
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'hourlyRate' || name === 'tips' ? parseFloat(value) || 0 : value,
    });
  };

  const handleSubmit = async () => {
    try {
      await workSchedule.create(formData);
      handleCloseDialog();
      fetchSchedule();
    } catch (error) {
      console.error('Error creating work entry:', error);
    }
  };

  const calculateHours = (startTime, endTime) => {
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    let hours = (end - start) / (1000 * 60 * 60);
    if (hours < 0) hours += 24; // Handle overnight shifts
    return hours;
  };

  const getMonthlyStats = () => {
    const stats = scheduleList.reduce(
      (acc, entry) => ({
        totalHours: acc.totalHours + entry.hoursWorked,
        totalEarnings: acc.totalEarnings + entry.totalEarnings,
        totalTips: acc.totalTips + entry.tips,
        daysWorked: acc.daysWorked + 1,
      }),
      { totalHours: 0, totalEarnings: 0, totalTips: 0, daysWorked: 0 }
    );
    
    stats.averagePerDay = stats.daysWorked > 0 ? stats.totalEarnings / stats.daysWorked : 0;
    stats.averageHourly = stats.totalHours > 0 ? stats.totalEarnings / stats.totalHours : 0;
    
    return stats;
  };

  const monthlyStats = getMonthlyStats();

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Work Schedule</Typography>
        <Box display="flex" gap={2} alignItems="center">
          <TextField
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            size="small"
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
          >
            Add Work Entry
          </Button>
        </Box>
      </Box>

      {/* Monthly Statistics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Earnings
                  </Typography>
                  <Typography variant="h5">
                    ${monthlyStats.totalEarnings.toFixed(2)}
                  </Typography>
                </Box>
                <MoneyIcon color="primary" fontSize="large" />
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
                    Hours Worked
                  </Typography>
                  <Typography variant="h5">
                    {monthlyStats.totalHours.toFixed(1)}h
                  </Typography>
                </Box>
                <TimeIcon color="primary" fontSize="large" />
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
                    Total Tips
                  </Typography>
                  <Typography variant="h5">
                    ${monthlyStats.totalTips.toFixed(2)}
                  </Typography>
                </Box>
                <MoneyIcon color="success" fontSize="large" />
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
                    Days Worked
                  </Typography>
                  <Typography variant="h5">
                    {monthlyStats.daysWorked}
                  </Typography>
                </Box>
                <WorkIcon color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Schedule Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Position</TableCell>
              <TableCell>Time</TableCell>
              <TableCell align="center">Hours</TableCell>
              <TableCell align="right">Rate/Hour</TableCell>
              <TableCell align="right">Regular</TableCell>
              <TableCell align="right">Tips</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {scheduleList.map((entry) => (
              <TableRow key={entry._id}>
                <TableCell>
                  {format(new Date(entry.date), 'EEE, MMM dd')}
                </TableCell>
                <TableCell>
                  <Chip label={entry.position} size="small" />
                </TableCell>
                <TableCell>
                  {entry.startTime} - {entry.endTime}
                </TableCell>
                <TableCell align="center">
                  {entry.hoursWorked.toFixed(1)}
                </TableCell>
                <TableCell align="right">
                  ${entry.hourlyRate.toFixed(2)}
                </TableCell>
                <TableCell align="right">
                  ${entry.regularEarnings.toFixed(2)}
                </TableCell>
                <TableCell align="right">
                  {entry.tips > 0 && (
                    <Typography color="success.main">
                      +${entry.tips.toFixed(2)}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight="medium">
                    ${entry.totalEarnings.toFixed(2)}
                  </Typography>
                </TableCell>
                <TableCell>{entry.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Work Entry Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add Work Entry</DialogTitle>
        <DialogContent>
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
          <TextField
            name="position"
            label="Position"
            select
            fullWidth
            margin="normal"
            value={formData.position}
            onChange={handleInputChange}
            required
          >
            {POSITIONS.map((position) => (
              <MenuItem key={position} value={position}>
                {position}
              </MenuItem>
            ))}
          </TextField>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                name="startTime"
                label="Start Time"
                type="time"
                fullWidth
                margin="normal"
                value={formData.startTime}
                onChange={handleInputChange}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                name="endTime"
                label="End Time"
                type="time"
                fullWidth
                margin="normal"
                value={formData.endTime}
                onChange={handleInputChange}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
          </Grid>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1, mb: 2 }}>
            Hours: {calculateHours(formData.startTime, formData.endTime).toFixed(1)}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                name="hourlyRate"
                label="Hourly Rate ($)"
                type="number"
                fullWidth
                margin="normal"
                value={formData.hourlyRate}
                onChange={handleInputChange}
                inputProps={{ step: 0.01 }}
                required
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                name="tips"
                label="Tips ($)"
                type="number"
                fullWidth
                margin="normal"
                value={formData.tips}
                onChange={handleInputChange}
                inputProps={{ step: 0.01 }}
              />
            </Grid>
          </Grid>
          <TextField
            name="accountId"
            label="Deposit to Account"
            select
            fullWidth
            margin="normal"
            value={formData.accountId}
            onChange={handleInputChange}
            helperText="Select account to automatically create income transactions"
          >
            <MenuItem value="">None (Don't create transactions)</MenuItem>
            {accountsList.map((account) => (
              <MenuItem key={account._id} value={account._id}>
                {account.name} ({account.currency})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            name="notes"
            label="Notes"
            fullWidth
            margin="normal"
            value={formData.notes}
            onChange={handleInputChange}
            multiline
            rows={2}
          />
          <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
            <Typography variant="body2" color="textSecondary">
              Estimated Earnings:
            </Typography>
            <Typography variant="h6">
              ${(calculateHours(formData.startTime, formData.endTime) * formData.hourlyRate + formData.tips).toFixed(2)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default WorkSchedule;
