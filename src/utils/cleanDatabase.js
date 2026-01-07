require('dotenv').config();
const connectDB = require('../config/database');

const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Availability = require('../models/Availability');
const Appointment = require('../models/Appointment');
const Consultation = require('../models/Consultation');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const Message = require('../models/Message');

const cleanDatabase = async () => {
  try {
    await connectDB();
    
    console.log('\n🧹 Cleaning database...\n');
    
    await Message.deleteMany({});
    console.log('   ✅ Messages deleted');
    
    await Notification.deleteMany({});
    console.log('   ✅ Notifications deleted');
    
    await Review.deleteMany({});
    console.log('   ✅ Reviews deleted');
    
    await Consultation.deleteMany({});
    console.log('   ✅ Consultations deleted');
    
    await Payment.deleteMany({});
    console.log('   ✅ Payments deleted');
    
    await Appointment.deleteMany({});
    console.log('   ✅ Appointments deleted');
    
    await Availability.deleteMany({});
    console.log('   ✅ Availability records deleted');
    
    await Doctor.deleteMany({});
    console.log('   ✅ Doctors deleted');
    
    await Patient.deleteMany({});
    console.log('   ✅ Patients deleted');
    
    await User.deleteMany({});
    console.log('   ✅ Users deleted');
    
    console.log('\n✅ Database cleaned successfully! 🎉\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    process.exit(1);
  }
};

cleanDatabase();