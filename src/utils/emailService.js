// src/utils/emailService.js
const nodemailer = require('nodemailer');

// Verify environment variables
console.log('📧 Email Configuration:');
console.log('EMAIL_USER:', process.env.EMAIL_USER || '❌ NOT SET');
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ SET' : '❌ NOT SET');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
  console.error('⚠️ WARNING: Email credentials missing in .env file!');
}

// Create transporter with proper timeout settings
const createTransporter = () => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      // Add timeout settings to prevent hanging
      connectionTimeout: 15000, // 15 seconds
      greetingTimeout: 15000,
      socketTimeout: 15000,
      debug: false, // Set to true only for debugging
      logger: false, // Set to true only for debugging
    });

    console.log('✅ Email transporter created');
    return transporter;
  } catch (error) {
    console.error('❌ Failed to create transporter:', error.message);
    throw error;
  }
};

const transporter = createTransporter();

// Test connection on startup (non-blocking)
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email server connection FAILED:', error.message);
    console.error('⚠️ Emails will fail to send. Please check your EMAIL_USER and EMAIL_PASSWORD in .env');
  } else {
    console.log('✅ Email server connection successful!');
  }
});

/**
 * Send OTP email to user (ASYNC - doesn't block)
 */
const sendOtpEmail = async (email, otp, userName) => {
  console.log('📧 Queuing OTP email to:', email);

  const mailOptions = {
    from: `"HealthHub" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email - HealthHub',
    text: `Hello ${userName || 'User'}! Your HealthHub OTP is: ${otp}. This code is valid for 10 minutes.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed #667eea; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
          .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: monospace; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 HealthHub</h1>
            <p>Email Verification</p>
          </div>
          <div class="content">
            <h2>Hello ${userName || 'User'}!</h2>
            <p>Thank you for registering with HealthHub. To complete your registration, please verify your email address using the OTP below:</p>
            
            <div class="otp-box">
              <p style="margin: 0; font-size: 14px; color: #666;">Your OTP Code</p>
              <div class="otp-code">${otp}</div>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Valid for 10 minutes</p>
            </div>
            
            <p>Enter this code in the app to verify your email address and get started with HealthHub.</p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> Never share this OTP with anyone. HealthHub staff will never ask for your OTP.
            </div>
            
            <p>If you didn't create an account with HealthHub, please ignore this email.</p>
            
            <p>Best regards,<br><strong>The HealthHub Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; 2025 HealthHub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    console.log('📤 Sending OTP email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ OTP email sent successfully to:', email);
    console.log('   Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send OTP email to:', email);
    console.error('   Error:', error.message);
    
    // Log specific error types
    if (error.code === 'EAUTH') {
      console.error('   → SMTP Authentication failed!');
      console.error('   → Check EMAIL_USER and EMAIL_PASSWORD in .env');
      console.error('   → For Gmail, use App Password (not regular password)');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
      console.error('   → Connection timeout. Network or firewall issue.');
    } else if (error.code === 'ECONNECTION') {
      console.error('   → Cannot connect to SMTP server.');
    }
    
    // Don't throw - just log and return false
    // This prevents blocking the registration process
    return false;
  }
};

/**
 * Send welcome email after verification (ASYNC)
 */
const sendWelcomeEmail = async (email, userName, userRole) => {
  console.log('📧 Queuing welcome email to:', email);

  const mailOptions = {
    from: `"HealthHub" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to HealthHub! 🎉',
    text: `Hello ${userName}! Welcome to HealthHub. Your ${userRole} account is now active.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .features { background: white; border-radius: 10px; padding: 20px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to HealthHub!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Congratulations! Your email has been successfully verified and your ${userRole} account is now active.</p>
            
            <div class="features">
              <h3>✨ Get Started:</h3>
              ${userRole === 'patient' ? `
                <ul>
                  <li>📋 Complete your medical profile</li>
                  <li>🔍 Search and book appointments with doctors</li>
                  <li>💬 Chat with your healthcare providers</li>
                  <li>📱 Track your health records</li>
                </ul>
              ` : `
                <ul>
                  <li>👨‍⚕️ Complete your professional profile</li>
                  <li>📅 Set your availability schedule</li>
                  <li>👥 Manage patient appointments</li>
                  <li>💰 Track your earnings</li>
                </ul>
              `}
            </div>
            
            <p>If you have any questions, feel free to reach out to our support team.</p>
            
            <p>Best regards,<br><strong>The HealthHub Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2025 HealthHub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent successfully to:', email);
    console.log('   Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send welcome email to:', email);
    console.error('   Error:', error.message);
    return false;
  }
};

/**
 * Test email connection
 */
const testEmailConnection = async () => {
  try {
    console.log('🔍 Testing email connection...');
    await transporter.verify();
    console.log('✅ Email connection test successful!');
    return true;
  } catch (error) {
    console.error('❌ Email connection test failed:', error.message);
    return false;
  }
};

/**
 * Send email with retry logic (use this wrapper for important emails)
 */
const sendEmailWithRetry = async (emailFunction, maxRetries = 2) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await emailFunction();
      return result;
    } catch (error) {
      console.error(`❌ Email send attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error('❌ All email send attempts exhausted');
        return false;
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⏳ Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  testEmailConnection,
  sendEmailWithRetry,
};