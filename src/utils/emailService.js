const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_APP_PASSWORD, // Gmail App Password (not regular password)
  },
});

/**
 * Send OTP email to user
 */
const sendOtpEmail = async (email, otp, userName) => {
  const mailOptions = {
    from: `HealthHub <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email - HealthHub',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed #667eea; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
          .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
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
    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
};

/**
 * Send welcome email after verification
 */
const sendWelcomeEmail = async (email, userName, userRole) => {
  const mailOptions = {
    from: `HealthHub <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to HealthHub! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
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
            
            <p style="text-align: center;">
              <a href="${process.env.APP_URL || 'https://healthhub.com'}" class="button">Open HealthHub</a>
            </p>
            
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
    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw error for welcome email - it's not critical
    return false;
  }
};

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
};