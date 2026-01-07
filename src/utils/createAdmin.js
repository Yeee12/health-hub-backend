require('dotenv').config();
const connectDB = require('../config/database');
const User = require('../models/User');

const createAdmin = async () => {
  await connectDB();
  
  const admin = await User.create({
    email: 'admin@healthhub.com',
    password: 'admin123456',
    role: 'admin'
  });
  
  console.log('✅ Admin created:', admin.email);
  process.exit(0);
};

createAdmin();