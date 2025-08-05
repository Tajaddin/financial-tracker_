const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const auth = require('../middleware/auth');

// Get all accounts
router.get('/', auth, async (req, res) => {
  try {
    const accounts = await Account.find({ user: req.userId });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create account
router.post('/', auth, async (req, res) => {
  try {
    const account = new Account({
      ...req.body,
      user: req.userId,
    });
    await account.save();
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update account
router.put('/:id', auth, async (req, res) => {
  try {
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      req.body,
      { new: true }
    );
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete account
router.delete('/:id', auth, async (req, res) => {
  try {
    await Account.findOneAndDelete({ _id: req.params.id, user: req.userId });
    res.json({ message: 'Account deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;