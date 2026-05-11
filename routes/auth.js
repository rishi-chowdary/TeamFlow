const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { generateOTP, sendOTPEmail, storeOTP, verifyOTP, clearOTP } = require('../services/otp');
const supabase = require('../services/supabase');

const router = express.Router();

// POST /api/auth/send-otp — Step 1: Validate & send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    if (name.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Generate and send OTP
    const otp = generateOTP();
    storeOTP(email, otp, { name, password });

    const result = await sendOTPEmail(email, otp);

    res.json({
      message: 'Verification code sent to ' + email,
      method: result.method // 'email' or 'console'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
  }
});

// POST /api/auth/verify-otp — Step 2: Verify OTP & create account
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    // Verify OTP
    const verification = verifyOTP(email, otp);
    if (!verification.valid) {
      return res.status(400).json({ error: verification.error });
    }

    // Double-check user doesn't exist
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      clearOTP(email);
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Create the user
    const userCount = await User.countDocuments();
    const user = new User({
      name: verification.data.name,
      email,
      password: verification.data.password,
      isAdmin: userCount === 0
    });
    await user.save();

    // Clear OTP
    clearOTP(email);

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Email verified! Account created successfully.',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /api/auth/resend-otp — Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const otp = generateOTP();
    storeOTP(email, otp, { name: name || '', password: password || '' });
    await sendOTPEmail(email, otp);

    res.json({ message: 'New verification code sent!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resend code.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, loginAsAdmin } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (loginAsAdmin && !user.isAdmin) {
      return res.status(403).json({ error: 'This account does not have admin privileges. Please sign in as a Member.' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: loginAsAdmin ? 'Admin login successful!' : 'Login successful!',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({ user: req.user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/auth/users — search users by email
router.get('/users', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    if (!search || search.length < 2) {
      return res.json({ users: [] });
    }

    const users = await User.find({
      $or: [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ],
      _id: { $ne: req.userId }
    }).limit(10).select('name email avatarColor');

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/auth/supabase — Sync Supabase user with local DB
router.post('/supabase', async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required.' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Supabase is not configured.' });
    }

    // 1. Verify token and get user from Supabase
    const { data: { user: sbUser }, error } = await supabase.auth.getUser(access_token);
    
    if (error || !sbUser) {
      return res.status(401).json({ error: 'Invalid Supabase token.' });
    }

    // 2. Find or create user in MongoDB
    let user = await User.findOne({ email: sbUser.email.toLowerCase() });
    
    if (!user) {
      const userCount = await User.countDocuments();
      user = new User({
        name: sbUser.user_metadata.full_name || sbUser.user_metadata.name || sbUser.email.split('@')[0],
        email: sbUser.email.toLowerCase(),
        password: Math.random().toString(36).slice(-12), // Dummy password for oauth users
        isAdmin: userCount === 0,
        avatarColor: '#' + Math.floor(Math.random()*16777215).toString(16) // Random color
      });
      await user.save();
    }

    // 3. Generate local JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Supabase login successful!',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Supabase auth error:', error);
    res.status(500).json({ error: 'Server error during Supabase sync.' });
  }
});

// GET /api/auth/config — Expose Supabase public credentials
router.get('/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
});

module.exports = router;
