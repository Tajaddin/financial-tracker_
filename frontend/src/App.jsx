// src/App.jsx
import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import Accounts from './components/Accounts';
import Transactions from './components/Transactions';
import Borrowings from './components/Borrowings';
import WorkSchedule from './components/WorkSchedule';
import Login from './components/Login';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

return (
  <>
    <Navigation onLogout={handleLogout} />
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/accounts" element={<Accounts />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/borrowings" element={<Borrowings />} />
      <Route path="/work-schedule" element={<WorkSchedule />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </>
);
}

export default App;
