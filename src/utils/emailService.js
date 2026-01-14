// src/utils/emailService.js - WORKING CONFIGURATION ✅
const nodemailer = require('nodemailer');

console.log('📧 Email Service Starting...');
console.log('   USER:', process.env.EMAIL_USER || '❌ NOT SET');
console.log('   PASS:', process.env.EMAIL_PASSWORD ? '✅ SET' : '❌ NOT SET');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
  console.error('⚠️ WARNING: Email credentials missing!');
}

// ✅ WORKING CONFIG - Port 465 SSL (Tested Successfully)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// Test connection (non-blocking)
(async () => {
  try {
    await transporter.verify();
    console.log('✅ Email service ready! (Port 465 SSL)');
  } catch (error) {
    console.error('❌ Email connection failed:', error.message);
    if (error.code === 'EAUTH') {
      console.error('   💡 Generate new App Password: https://myaccount.google.com/apppasswords');
    }
  }
})();

/**
 * Send OTP email
 */
const sendOtpEmail = async (email, otp, userName) => {
  console.log(`📧 Sending OTP to: ${email}`);

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'HealthHub'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - HealthHub',
      text: `Hello ${userName || 'User'}! Your HealthHub OTP is: ${otp}. Valid for 10 minutes.`,
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
              <p>Thank you for registering with HealthHub. Please verify your email using the OTP below:</p>
              
              <div class="otp-box">
                <p style="margin: 0; font-size: 14px; color: #666;">Your OTP Code</p>
                <div class="otp-code">${otp}</div>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Valid for 10 minutes</p>
              </div>
              
              <p>Enter this code in the app to verify your email address.</p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> Never share this OTP with anyone.
              </div>
              
              <p>If you didn't create an account, please ignore this email.</p>
              
              <p>Best regards,<br><strong>The HealthHub Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
              <p>&copy; 2025 HealthHub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`✅ OTP sent! ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ OTP failed:`, error.message);
    return false;
  }
};

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (email, userName, userRole) => {
  console.log(`📧 Sending welcome to: ${email}`);

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'HealthHub'}" <${process.env.EMAIL_USER}>`,
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
              <p>Your email has been verified and your ${userRole} account is now active.</p>
              
              <div class="features">
                <h3>✨ Get Started:</h3>
                ${userRole === 'patient' ? `
                  <ul>
                    <li>📋 Complete your medical profile</li>
                    <li>🔍 Book appointments with doctors</li>
                    <li>💬 Chat with healthcare providers</li>
                    <li>📱 Track your health records</li>
                  </ul>
                ` : `
                  <ul>
                    <li>👨‍⚕️ Complete your professional profile</li>
                    <li>📅 Set your availability</li>
                    <li>👥 Manage patient appointments</li>
                    <li>💰 Track your earnings</li>
                  </ul>
                `}
              </div>
              
              <p>If you have questions, contact our support team.</p>
              
              <p>Best regards,<br><strong>The HealthHub Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; 2025 HealthHub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`✅ Welcome sent! ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Welcome failed:`, error.message);
    return false;
  }
};

/**
 * Test connection
 */
const testEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Test passed!');
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
};

/**
 * Retry wrapper
 */
const sendEmailWithRetry = async (emailFunction, maxRetries = 2) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await emailFunction();
      if (result) return true;
      console.log(`⚠️ Attempt ${attempt} failed, retrying...`);
    } catch (error) {
      console.error(`❌ Attempt ${attempt}:`, error.message);
    }
    
    if (attempt < maxRetries) {
      const wait = 1000 * attempt;
      await new Promise(r => setTimeout(r, wait));
    }
  }
  return false;
};

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  testEmailConnection,
  sendEmailWithRetry,
};