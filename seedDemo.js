const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

const seedDemoAccounts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create Admin
    const adminEmail = 'admin@teamflow.com';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = new User({
        name: 'Demo Admin',
        email: adminEmail,
        password: 'admin123',
        isAdmin: true
      });
      await admin.save();
      console.log('Demo Admin created');
    } else {
      admin.isAdmin = true;
      admin.password = 'admin123';
      await admin.save();
      console.log('Demo Admin updated');
    }

    // Create Member
    const memberEmail = 'member@teamflow.com';
    let member = await User.findOne({ email: memberEmail });
    if (!member) {
      member = new User({
        name: 'Demo Member',
        email: memberEmail,
        password: 'member123',
        isAdmin: false
      });
      await member.save();
      console.log('Demo Member created');
    } else {
      member.isAdmin = false;
      member.password = 'member123';
      await member.save();
      console.log('Demo Member updated');
    }

    console.log('Demo accounts seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding accounts:', err);
    process.exit(1);
  }
};

seedDemoAccounts();
