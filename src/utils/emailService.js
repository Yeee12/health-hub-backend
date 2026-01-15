// src/utils/emailService.js - SendGrid with Anti-Spam Optimizations
const sgMail = require('@sendgrid/mail');

console.log('📧 Email Service Starting (SendGrid)...');
console.log('   API Key:', process.env.SENDGRID_API_KEY ? '✅ SET' : '❌ NOT SET');
console.log('   From:', process.env.EMAIL_USER || '❌ NOT SET');

if (!process.env.SENDGRID_API_KEY) {
  console.error('⚠️ WARNING: SENDGRID_API_KEY not set!');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configured!');
}

/**
 * Send OTP email with anti-spam optimizations
 */
const sendOtpEmail = async (email, otp, userName) => {
  console.log(`📧 Sending OTP to: ${email}`);

  const msg = {
    to: email,
    from: {
      email: process.env.EMAIL_USER,
      name: process.env.EMAIL_FROM_NAME || 'HealthHub'
    },
    replyTo: process.env.EMAIL_USER,
    subject: 'Your HealthHub Verification Code',
    // Anti-spam tracking settings
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking: { enable: true },
      subscriptionTracking: { enable: true }
    },
    // SendGrid categories for analytics
    categories: ['otp', 'verification', 'transactional'],
    // Custom arguments for tracking
    customArgs: {
      app: 'healthhub',
      type: 'otp',
      version: '1.0'
    },
    text: `Hello ${userName || 'User'},

Your HealthHub verification code is: ${otp}

This code expires in 10 minutes. Enter it in the app to complete your registration.

If you didn't request this code, please ignore this email.

Best regards,
The HealthHub Team

---
HealthHub Healthcare Services
Lagos, Nigeria

This is an automated message. Please do not reply to this email.`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Verify Your Email - HealthHub</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; padding: 0; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; }
          .otp-box { background: #f8f9fa; border: 2px dashed #667eea; border-radius: 10px; padding: 25px; text-align: center; margin: 25px 0; }
          .otp-code { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace; }
          .footer { text-align: center; padding: 20px; background-color: #f8f9fa; font-size: 12px; color: #666; border-top: 1px solid #e0e0e0; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .button { display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          a { color: #667eea; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🏥 HealthHub</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Email Verification</p>
          </div>
          <div class="content">
            <h2 style="color: #333; margin-bottom: 10px;">Hello ${userName || 'User'},</h2>
            <p style="color: #555; line-height: 1.8; margin-bottom: 20px;">Thank you for signing up with HealthHub. To complete your registration, please use the verification code below:</p>
            
            <div class="otp-box">
              <p style="margin: 0 0 15px 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Verification Code</p>
              <div class="otp-code">${otp}</div>
              <p style="margin: 20px 0 0 0; font-size: 13px; color: #999;">⏰ This code will expire in 10 minutes</p>
            </div>
            
            <p style="color: #555; line-height: 1.8; margin-top: 25px;">Enter this code in the HealthHub app to verify your email and access your account.</p>
            
            <div class="warning">
              <strong style="color: #856404; display: block; margin-bottom: 8px;">🔒 Security Notice</strong>
              <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">Never share this code with anyone. HealthHub staff will never ask for your verification code via email, phone, or any other medium.</p>
            </div>
            
            <p style="color: #555; line-height: 1.8; margin-top: 25px;">If you didn't create a HealthHub account, you can safely ignore this email. No further action is required.</p>
            
            <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #555; font-size: 14px;">Best regards,</p>
              <p style="margin: 5px 0 0 0; color: #667eea; font-weight: bold; font-size: 15px;">The HealthHub Team</p>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 8px 0; font-weight: 600;">HealthHub Healthcare Services</p>
            <p style="margin: 0 0 15px 0;">Lagos, Nigeria</p>
            <p style="margin: 0 0 8px 0;">This is an automated message. Please do not reply to this email.</p>
            <p style="margin: 0 0 15px 0; color: #999;">&copy; 2025 HealthHub. All rights reserved.</p>
            <p style="margin: 15px 0 0 0; font-size: 11px; color: #999;">
              <a href="#" style="color: #667eea; margin: 0 8px;">Privacy Policy</a> |
              <a href="#" style="color: #667eea; margin: 0 8px;">Terms of Service</a> |
              <a href="#" style="color: #667eea; margin: 0 8px;">Contact Support</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ OTP sent successfully to: ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ OTP failed for ${email}:`, error.message);
    if (error.response) {
      console.error('   SendGrid Response:', error.response.body);
    }
    return false;
  }
};

/**
 * Send welcome email after verification
 */
const sendWelcomeEmail = async (email, userName, userRole) => {
  console.log(`📧 Sending welcome email to: ${email}`);

  const msg = {
    to: email,
    from: {
      email: process.env.EMAIL_USER,
      name: process.env.EMAIL_FROM_NAME || 'HealthHub'
    },
    replyTo: process.env.EMAIL_USER,
    subject: 'Welcome to HealthHub! 🎉',
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking: { enable: true },
      subscriptionTracking: { enable: true }
    },
    categories: ['welcome', 'onboarding', 'transactional'],
    customArgs: {
      app: 'healthhub',
      type: 'welcome',
      role: userRole
    },
    text: `Hello ${userName}!

Welcome to HealthHub! Your email has been verified and your ${userRole} account is now active.

${userRole === 'patient' ? 
`Get started with HealthHub:
- Complete your medical profile
- Search and book appointments with doctors
- Chat with your healthcare providers
- Track your health records` : 
`Get started with HealthHub:
- Complete your professional profile
- Set your availability schedule
- Manage patient appointments
- Track your earnings`}

If you have any questions, feel free to contact our support team.

Best regards,
The HealthHub Team

---
HealthHub Healthcare Services
Lagos, Nigeria`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px; background: #ffffff; }
          .features { background: #f8f9fa; border-radius: 10px; padding: 25px; margin: 25px 0; border-left: 4px solid #667eea; }
          .footer { text-align: center; padding: 20px; background-color: #f8f9fa; font-size: 12px; color: #666; border-top: 1px solid #e0e0e0; }
          ul { padding-left: 20px; }
          li { margin: 12px 0; color: #555; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 32px;">🎉 Welcome to HealthHub!</h1>
            <p style="margin: 15px 0 0 0; font-size: 16px; opacity: 0.9;">Your account is now active</p>
          </div>
          <div class="content">
            <h2 style="color: #333; margin-bottom: 15px;">Hello ${userName}!</h2>
            <p style="color: #555; line-height: 1.8; margin-bottom: 20px;">Congratulations! Your email has been successfully verified and your <strong>${userRole}</strong> account is now active. Welcome to the HealthHub community!</p>
            
            <div class="features">
              <h3 style="color: #667eea; margin-top: 0; margin-bottom: 15px;">✨ Get Started:</h3>
              ${userRole === 'patient' ? `
                <ul style="margin: 0; padding-left: 20px;">
                  <li>📋 Complete your medical profile to help doctors serve you better</li>
                  <li>🔍 Search and book appointments with qualified healthcare providers</li>
                  <li>💬 Chat securely with your healthcare providers</li>
                  <li>📱 Track and manage your health records in one place</li>
                </ul>
              ` : `
                <ul style="margin: 0; padding-left: 20px;">
                  <li>👨‍⚕️ Complete your professional profile and credentials</li>
                  <li>📅 Set your availability schedule for appointments</li>
                  <li>👥 Manage patient appointments and consultations</li>
                  <li>💰 Track your earnings and patient feedback</li>
                </ul>
              `}
            </div>
            
            <p style="color: #555; line-height: 1.8; margin-top: 25px;">We're excited to have you on board! If you have any questions or need assistance, our support team is here to help.</p>
            
            <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #555; font-size: 14px;">Best regards,</p>
              <p style="margin: 5px 0 0 0; color: #667eea; font-weight: bold; font-size: 15px;">The HealthHub Team</p>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 8px 0; font-weight: 600;">HealthHub Healthcare Services</p>
            <p style="margin: 0 0 15px 0;">Lagos, Nigeria</p>
            <p style="margin: 0 0 15px 0; color: #999;">&copy; 2025 HealthHub. All rights reserved.</p>
            <p style="margin: 15px 0 0 0; font-size: 11px; color: #999;">
              <a href="#" style="color: #667eea; margin: 0 8px;">Privacy Policy</a> |
              <a href="#" style="color: #667eea; margin: 0 8px;">Terms of Service</a> |
              <a href="#" style="color: #667eea; margin: 0 8px;">Contact Support</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Welcome email sent successfully to: ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ Welcome email failed for ${email}:`, error.message);
    if (error.response) {
      console.error('   SendGrid Response:', error.response.body);
    }
    return false;
  }
};

/**
 * Test email connection
 */
const testEmailConnection = async () => {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ SENDGRID_API_KEY not configured');
    return false;
  }
  
  console.log('✅ SendGrid API key configured and ready!');
  return true;
};

/**
 * Send email with retry logic
 */
const sendEmailWithRetry = async (emailFunction, maxRetries = 2) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await emailFunction();
      if (result) {
        return true;
      }
      console.log(`⚠️ Email attempt ${attempt} returned false, retrying...`);
    } catch (error) {
      console.error(`❌ Email attempt ${attempt} failed:`, error.message);
    }
    
    if (attempt < maxRetries) {
      const waitTime = 1000 * attempt; // 1s, 2s
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  console.error('❌ All email retry attempts exhausted');
  return false;
};

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  testEmailConnection,
  sendEmailWithRetry,
};