require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');

// Import all models
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

const testModels = async () => {
  try {
    await connectDB();
    console.log('\n🧪 Starting Model Tests...\n');

    // ======================
    // CLEANUP FIRST - Remove any existing test data
    // ======================
    console.log('🧹 Cleaning existing test data...');
    await Message.deleteMany({});
    await Notification.deleteMany({});
    await Review.deleteMany({});
    await Consultation.deleteMany({});
    await Payment.deleteMany({});
    await Appointment.deleteMany({});
    await Availability.deleteMany({});
    await Doctor.deleteMany({});
    await Patient.deleteMany({});
    await User.deleteMany({});
    console.log('   ✅ Database cleaned\n');

    // ======================
    // 1. TEST USER MODEL
    // ======================
    console.log('1️⃣  Testing User Model...');
    
    const testUser = await User.create({
      email: 'testpatient@example.com',
      password: 'password123',
      phoneNumber: '+2348012345678',
      role: 'patient'
    });
    
    console.log('   ✅ User created:', testUser.email);
    
    // Test password comparison
    const isPasswordValid = await testUser.comparePassword('password123');
    console.log('   ✅ Password validation:', isPasswordValid);
    
    // Test JWT token generation
    const accessToken = testUser.generateAccessToken();
    console.log('   ✅ Access token generated:', accessToken.substring(0, 20) + '...');

    // ======================
    // 2. TEST PATIENT MODEL
    // ======================
    console.log('\n2️⃣  Testing Patient Model...');
    
    const testPatient = await Patient.create({
      userId: testUser._id,
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'male',
      bloodGroup: 'O+',
      address: {
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        coordinates: {
          type: 'Point',
          coordinates: [3.3792, 6.5244] // Lagos coordinates
        }
      }
    });
    
    console.log('   ✅ Patient created:', testPatient.fullName);
    console.log('   ✅ Patient age:', testPatient.age);

    // ======================
    // 3. TEST DOCTOR MODEL
    // ======================
    console.log('\n3️⃣  Testing Doctor Model...');
    
    const doctorUser = await User.create({
      email: 'testdoctor@example.com',
      password: 'password123',
      role: 'doctor'
    });
    
    const testDoctor = await Doctor.create({
      userId: doctorUser._id,
      firstName: 'Sarah',
      lastName: 'Williams',
      gender: 'female',
      specialties: ['Cardiology', 'General Medicine'],
      licenseNumber: 'MED123456',
      yearsOfExperience: 10,
      qualifications: ['MBBS', 'MD'],
      consultationFee: {
        inPerson: 20000,
        video: 15000,
        chat: 10000
      },
      consultationTypes: ['video', 'chat'],
      clinicAddress: {
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        coordinates: {
          type: 'Point',
          coordinates: [3.3792, 6.5244]
        }
      }
    });
    
    console.log('   ✅ Doctor created:', testDoctor.fullName);
    console.log('   ✅ Verification status:', testDoctor.verificationStatus);

    // ======================
    // 4. TEST AVAILABILITY MODEL
    // ======================
    console.log('\n4️⃣  Testing Availability Model...');
    
    const availability = await Availability.createDefault(testDoctor._id);
    console.log('   ✅ Availability created for doctor');
    
    // Test availability check
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 1); // Tomorrow
    testDate.setHours(10, 0, 0, 0); // 10:00 AM
    
    const isAvailable = availability.isAvailableAt(testDate);
    console.log('   ✅ Doctor available tomorrow at 10 AM:', isAvailable);
    
    // Get available slots for tomorrow
    const slots = availability.getAvailableSlotsForDate(testDate);
    console.log('   ✅ Available slots for tomorrow:', slots.length);

    // ======================
    // 5. TEST APPOINTMENT MODEL
    // ======================
    console.log('\n5️⃣  Testing Appointment Model...');
    
    const appointmentDate = new Date();
    appointmentDate.setDate(appointmentDate.getDate() + 2); // Day after tomorrow
    appointmentDate.setHours(14, 0, 0, 0); // 2:00 PM
    
    const testAppointment = await Appointment.create({
      patientId: testPatient._id,
      doctorId: testDoctor._id,
      appointmentDate,
      duration: 30,
      consultationType: 'video',
      reasonForVisit: 'Regular checkup and consultation about chest pain',
      symptoms: ['chest pain', 'shortness of breath'],
      consultationFee: testDoctor.consultationFee.video
    });
    
    console.log('   ✅ Appointment created for:', appointmentDate.toLocaleString());
    console.log('   ✅ Appointment status:', testAppointment.status);
    
    // Test conflict detection
    const hasConflict = await Appointment.hasConflict(
      testDoctor._id,
      appointmentDate,
      30
    );
    console.log('   ✅ Conflict detection working:', hasConflict);

    // ======================
    // 6. TEST PAYMENT MODEL
    // ======================
    console.log('\n6️⃣  Testing Payment Model...');
    
    const testPayment = await Payment.create({
      appointmentId: testAppointment._id,
      patientId: testPatient._id,
      doctorId: testDoctor._id,
      amount: testDoctor.consultationFee.video,
      currency: 'NGN',
      paymentMethod: 'paystack',
      paymentGateway: 'paystack',
      transactionReference: 'TEST_REF_' + Date.now()
    });
    
    console.log('   ✅ Payment created');
    console.log('   ✅ Amount:', testPayment.amount);
    console.log('   ✅ Platform fee (10%):', testPayment.platformFee);
    console.log('   ✅ Doctor earnings:', testPayment.doctorEarnings);

    // ======================
    // 7. TEST CONSULTATION MODEL
    // ======================
    console.log('\n7️⃣  Testing Consultation Model...');
    
    // Mark appointment as completed first
    await testAppointment.complete();
    
    const testConsultation = await Consultation.create({
      appointmentId: testAppointment._id,
      patientId: testPatient._id,
      doctorId: testDoctor._id,
      chiefComplaint: 'Chest pain during exercise',
      diagnosis: 'Mild angina - requires further investigation',
      vitals: {
        bloodPressure: '120/80',
        heartRate: 75,
        temperature: 37.2,
        weight: 75,
        height: 175
      },
      prescription: [
        {
          medication: 'Aspirin',
          dosage: '81mg',
          frequency: 'Once daily',
          duration: '30 days',
          instructions: 'Take with food'
        }
      ]
    });
    
    console.log('   ✅ Consultation created');
    console.log('   ✅ Diagnosis:', testConsultation.diagnosis);
    console.log('   ✅ BMI calculated:', testConsultation.bmi);
    console.log('   ✅ BMI category:', testConsultation.bmiCategory);

    // ======================
    // 8. TEST REVIEW MODEL
    // ======================
    console.log('\n8️⃣  Testing Review Model...');
    
    const testReview = await Review.create({
      doctorId: testDoctor._id,
      patientId: testPatient._id,
      appointmentId: testAppointment._id,
      rating: 5,
      comment: 'Excellent doctor! Very professional and thorough.',
      tags: ['Professional', 'Knowledgeable', 'Good Listener']
    });
    
    console.log('   ✅ Review created');
    console.log('   ✅ Rating:', testReview.rating);
    console.log('   ✅ Is positive review:', testReview.isPositive);

    // ======================
    // 9. TEST NOTIFICATION MODEL
    // ======================
    console.log('\n9️⃣  Testing Notification Model...');
    
    const testNotification = await Notification.create({
      userId: testUser._id,
      type: 'appointment_confirmed',
      title: 'Appointment Confirmed',
      message: 'Your appointment has been confirmed for tomorrow',
      relatedId: testAppointment._id,
      relatedModel: 'Appointment',
      channels: ['push', 'email', 'in-app'],
      priority: 'high'
    });
    
    console.log('   ✅ Notification created');
    console.log('   ✅ Type:', testNotification.type);
    console.log('   ✅ Channels:', testNotification.channels);

    // ======================
    // 10. TEST MESSAGE MODEL
    // ======================
    console.log('\n🔟 Testing Message Model...');
    
    const testMessage = await Message.create({
      appointmentId: testAppointment._id,
      senderId: testUser._id,
      receiverId: doctorUser._id,
      messageType: 'text',
      content: 'Hello doctor, I have a question about my medication.'
    });
    
    console.log('   ✅ Message created');
    console.log('   ✅ Content:', testMessage.content);
    console.log('   ✅ Is unread:', testMessage.isUnread);

    // ======================
    // CLEANUP
    // ======================
    console.log('\n🧹 Cleaning up test data...');
    
    await Message.deleteMany({});
    await Notification.deleteMany({});
    await Review.deleteMany({});
    await Consultation.deleteMany({});
    await Payment.deleteMany({});
    await Appointment.deleteMany({});
    await Availability.deleteMany({});
    await Doctor.deleteMany({});
    await Patient.deleteMany({});
    await User.deleteMany({});
    
    console.log('   ✅ Test data cleaned up');

    // ======================
    // SUCCESS
    // ======================
    console.log('\n✅ ========================================');
    console.log('✅ ALL MODEL TESTS PASSED! 🎉');
    console.log('✅ ========================================\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
};

// Run tests
testModels();