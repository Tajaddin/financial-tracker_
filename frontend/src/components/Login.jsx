
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Tab,
  Tabs,
  Alert,
} from '@mui/material';
import { auth } from '../services/api';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function Login({ onLogin }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await auth.login(loginData);
      onLogin(response.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    
    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const response = await auth.register({
        name: registerData.name,
        email: registerData.email,
        password: registerData.password,
      });
      onLogin(response.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h4" sx={{ mb: 3 }}>
          Financial Tracker
        </Typography>
        <Paper elevation={3} sx={{ width: '100%' }}>
          <Tabs value={tab} onChange={handleTabChange} variant="fullWidth">
            <Tab label="Login" />
            <Tab label="Register" />
          </Tabs>

          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              {error}
            </Alert>
          )}

          <TabPanel value={tab} index={0}>
            <form onSubmit={handleLogin}>
              <TextField
                margin="normal"
                required
                fullWidth
                label="Email Address"
                type="email"
                autoComplete="email"
                autoFocus
                value={loginData.email}
                onChange={(e) =>
                  setLoginData({ ...loginData, email: e.target.value })
                }
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Password"
                type="password"
                autoComplete="current-password"
                value={loginData.password}
                onChange={(e) =>
                  setLoginData({ ...loginData, password: e.target.value })
                }
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
              >
                Sign In
              </Button>
            </form>
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <form onSubmit={handleRegister}>
              <TextField
                margin="normal"
                required
                fullWidth
                label="Full Name"
                autoFocus
                value={registerData.name}
                onChange={(e) =>
                  setRegisterData({ ...registerData, name: e.target.value })
                }
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Email Address"
                type="email"
                autoComplete="email"
                value={registerData.email}
                onChange={(e) =>
                  setRegisterData({ ...registerData, email: e.target.value })
                }
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Password"
                type="password"
                autoComplete="new-password"
                value={registerData.password}
                onChange={(e) =>
                  setRegisterData({ ...registerData, password: e.target.value })
                }
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Confirm Password"
                type="password"
                value={registerData.confirmPassword}
                onChange={(e) =>
                  setRegisterData({
                    ...registerData,
                    confirmPassword: e.target.value,
                  })
                }
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
              >
                Register
              </Button>
            </form>
          </TabPanel>
        </Paper>
      </Box>
    </Container>
  );
}

export default Login;
