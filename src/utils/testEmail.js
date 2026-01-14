// testEmail.js - Run this to diagnose email issues
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmailConnection() {
  console.log('🔍 Starting Email Diagnostics...\n');

  // Step 1: Check environment variables
  console.log('📋 Step 1: Environment Variables');
  console.log('EMAIL_USER:', process.env.EMAIL_USER || '❌ NOT SET');
  console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ SET (length: ' + process.env.EMAIL_PASSWORD.length + ')' : '❌ NOT SET');
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('\n❌ FAILED: Email credentials missing in .env file!');
    return;
  }

  // Step 2: Test different SMTP configurations
  const configs = [
    {
      name: 'Gmail with service',
      config: {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      }
    },
    {
      name: 'Gmail with explicit host (TLS)',
      config: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false
        }
      }
    },
    {
      name: 'Gmail with SSL (port 465)',
      config: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      }
    }
  ];

  for (const { name, config } of configs) {
    console.log(`\n🧪 Testing: ${name}`);
    console.log('   Config:', JSON.stringify({
      host: config.host || 'gmail service',
      port: config.port || 'default',
      secure: config.secure || false
    }));

    try {
      const transporter = nodemailer.createTransport(config);
      
      // Test connection
      console.log('   ⏳ Verifying connection...');
      await transporter.verify();
      console.log('   ✅ Connection successful!');

      // Try sending test email
      console.log('   ⏳ Sending test email...');
      const info = await transporter.sendMail({
        from: `"HealthHub Test" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER, // Send to yourself
        subject: 'HealthHub Email Test - ' + new Date().toISOString(),
        text: 'This is a test email from HealthHub. If you receive this, your email configuration is working!',
        html: '<p>✅ <strong>Email configuration is working correctly!</strong></p>'
      });

      console.log('   ✅ Test email sent successfully!');
      console.log('   📧 Message ID:', info.messageId);
      console.log('\n🎉 SUCCESS! Use this configuration in your app.\n');
      return config;

    } catch (error) {
      console.error('   ❌ Failed:', error.message);
      if (error.code) {
        console.error('   Error Code:', error.code);
      }
      
      // Provide specific guidance
      if (error.code === 'EAUTH') {
        console.error('   💡 FIX: Invalid credentials. Check your app password.');
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
        console.error('   💡 FIX: Connection timeout. Try a different port or check firewall.');
      } else if (error.code === 'ECONNECTION') {
        console.error('   💡 FIX: Cannot connect. Check your internet connection.');
      }
    }
  }

  console.log('\n❌ All configurations failed. See troubleshooting steps below.\n');
  printTroubleshooting();
}

function printTroubleshooting() {
  console.log('🔧 TROUBLESHOOTING STEPS:\n');
  console.log('1. Generate NEW Gmail App Password:');
  console.log('   → Go to: https://myaccount.google.com/apppasswords');
  console.log('   → Create password for "Mail" → "Other" → "HealthHub"');
  console.log('   → Copy the 16-character password (REMOVE SPACES!)');
  console.log('   → Update EMAIL_PASSWORD in .env\n');
  
  console.log('2. Enable Less Secure App Access (if needed):');
  console.log('   → Go to: https://myaccount.google.com/lesssecureapps');
  console.log('   → Turn ON "Allow less secure apps"\n');
  
  console.log('3. Check 2-Factor Authentication:');
  console.log('   → You MUST use App Password if 2FA is enabled');
  console.log('   → Regular password will NOT work\n');
  
  console.log('4. Firewall/Network Issues:');
  console.log('   → Check if ports 587 or 465 are blocked');
  console.log('   → Try from a different network');
  console.log('   → Contact your hosting provider\n');
  
  console.log('5. Alternative: Use a Different Email Service:');
  console.log('   → SendGrid (free tier: 100 emails/day)');
  console.log('   → AWS SES (free tier: 62,000 emails/month)');
  console.log('   → Mailgun, Postmark, etc.\n');
}

// Run the test
testEmailConnection()
  .then(() => {
    console.log('✅ Diagnostics complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Diagnostics failed:', error);
    process.exit(1);
  });