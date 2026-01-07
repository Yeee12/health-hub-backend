const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const crypto = require('crypto');
const https = require('https');

// @desc    Initialize payment
// @route   POST /api/payments/initialize
// @access  Private (Patient only)
exports.initializePayment = async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'Appointment ID is required'
      });
    }

    // Get appointment
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientId')
      .populate('doctorId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if user is the patient
    const patient = await Patient.findOne({ userId: req.user._id });
    if (!patient || appointment.patientId._id.toString() !== patient._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if already paid
    if (appointment.paymentId) {
      const existingPayment = await Payment.findById(appointment.paymentId);
      if (existingPayment && existingPayment.status === 'successful') {
        return res.status(400).json({
          success: false,
          message: 'Appointment already paid for'
        });
      }
    }

    // Generate unique reference
    const reference = `HLTH_${Date.now()}_${appointmentId}`;

    // Create payment record
    const payment = await Payment.create({
      appointmentId: appointment._id,
      patientId: appointment.patientId._id,
      doctorId: appointment.doctorId._id,
      amount: appointment.consultationFee,
      currency: 'NGN',
      paymentMethod: 'paystack',
      paymentGateway: 'paystack',
      transactionReference: reference,
      status: 'pending'
    });

    // Update appointment with payment ID
    appointment.paymentId = payment._id;
    await appointment.save();

    // For development: Return mock payment URL
    if (process.env.NODE_ENV === 'development' && !process.env.PAYSTACK_SECRET_KEY) {
      return res.status(200).json({
        success: true,
        message: 'Payment initialized (DEV MODE - No Paystack)',
        data: {
          paymentId: payment._id,
          reference: reference,
          authorizationUrl: `http://localhost:3000/mock-payment/${reference}`,
          accessCode: 'DEV_ACCESS_CODE',
          devMode: true
        }
      });
    }

    // Initialize Paystack payment
    const paystackData = JSON.stringify({
      email: req.user.email,
      amount: appointment.consultationFee * 100, // Convert to kobo
      reference: reference,
      callback_url: `${process.env.CLIENT_URL}/appointments/${appointmentId}/payment-success`,
      metadata: {
        appointmentId: appointmentId,
        patientId: patient._id.toString(),
        doctorId: appointment.doctorId._id.toString()
      }
    });

    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transaction/initialize',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(paystackData)
      }
    };

    const paystackRequest = https.request(options, (paystackRes) => {
      let data = '';

      paystackRes.on('data', (chunk) => {
        data += chunk;
      });

      paystackRes.on('end', async () => {
        try {
          const response = JSON.parse(data);

          if (response.status) {
            res.status(200).json({
              success: true,
              message: 'Payment initialized successfully',
              data: {
                paymentId: payment._id,
                reference: reference,
                authorizationUrl: response.data.authorization_url,
                accessCode: response.data.access_code
              }
            });
          } else {
            await Payment.findByIdAndDelete(payment._id);
            
            res.status(400).json({
              success: false,
              message: 'Payment initialization failed',
              error: response.message
            });
          }
        } catch (error) {
          console.error('Paystack response error:', error);
          res.status(500).json({
            success: false,
            message: 'Error processing payment response',
            error: error.message
          });
        }
      });
    });

    paystackRequest.on('error', (error) => {
      console.error('Paystack request error:', error);
      res.status(500).json({
        success: false,
        message: 'Payment gateway error',
        error: error.message
      });
    });

    paystackRequest.write(paystackData);
    paystackRequest.end();

  } catch (error) {
    console.error('Initialize payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initializing payment',
      error: error.message
    });
  }
};

// @desc    Verify payment (Webhook)
// @route   POST /api/payments/webhook
// @access  Public (Paystack only)
exports.paystackWebhook = async (req, res) => {
  try {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || 'test')
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const { reference } = event.data;

      const payment = await Payment.findOne({ transactionReference: reference });

      if (!payment) {
        console.error('Payment not found:', reference);
        return res.status(404).send();
      }

      await payment.markSuccessful(event.data);

      const appointment = await Appointment.findById(payment.appointmentId);
      if (appointment && appointment.status === 'pending') {
        await appointment.confirm(appointment.patientId);
      }

      const doctor = await Doctor.findById(payment.doctorId);
      if (doctor) {
        await doctor.addEarnings(payment.doctorEarnings);
      }

      console.log('Payment successful:', reference);
    }

    res.status(200).send();
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send();
  }
};

// @desc    Verify payment manually
// @route   GET /api/payments/verify/:reference
// @access  Private
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const payment = await Payment.findOne({ transactionReference: reference });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message
    });
  }
};

// @desc    Get payment by ID
// @route   GET /api/payments/:id
// @access  Private
exports.getPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('appointmentId')
      .populate('patientId', 'firstName lastName')
      .populate('doctorId', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment',
      error: error.message
    });
  }
};

// @desc    Get my payments
// @route   GET /api/payments/my/payments
// @access  Private (Patient only)
exports.getMyPayments = async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user._id });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    const payments = await Payment.find({ patientId: patient._id })
      .populate('doctorId', 'firstName lastName')
      .populate('appointmentId', 'appointmentDate')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Get my payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payments',
      error: error.message
    });
  }
};

// @desc    Get doctor earnings
// @route   GET /api/payments/doctor/earnings
// @access  Private (Doctor only)
exports.getDoctorEarnings = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }

    const earnings = await Payment.getDoctorEarnings(doctor._id);

    res.status(200).json({
      success: true,
      data: earnings
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching earnings',
      error: error.message
    });
  }
};

// @desc    Get platform revenue
// @route   GET /api/payments/admin/revenue
// @access  Private (Admin only)
exports.getPlatformRevenue = async (req, res) => {
  try {
    const revenue = await Payment.getPlatformRevenue();

    res.status(200).json({
      success: true,
      data: revenue
    });
  } catch (error) {
    console.error('Get revenue error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching revenue',
      error: error.message
    });
  }
};