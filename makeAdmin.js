require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function makeAdmin(email) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { isAdmin: true },
      { new: true }
    );

    if (user) {
      console.log('✅ User made admin:', user.email);
      console.log('Name:', user.name);
      console.log('Role: Admin');
    } else {
      console.log('❌ User not found:', email);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: node makeAdmin.js <email>');
  process.exit(1);
}

makeAdmin(email);
