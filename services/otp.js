const nodemailer = require('nodemailer');

// In-memory OTP store: { email: { otp, expiresAt, name, password } }
const otpStore = new Map();

// OTP expiry time (5 minutes)
const OTP_EXPIRY = 5 * 60 * 1000;

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create transporter
function createTransporter() {
  // If SMTP is configured, use real email
  if (process.env.SMTP_USER && process.env.SMTP_USER !== 'your-email@gmail.com') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return null;
}

// Send OTP email
async function sendOTPEmail(email, otp) {
  const transporter = createTransporter();

  const htmlContent = `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:480px;margin:0 auto;background:#0a0a1a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
      <div style="background:linear-gradient(135deg,#6C5CE7,#00CEC9);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800">TeamFlow</h1>
        <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Email Verification</p>
      </div>
      <div style="padding:32px;text-align:center">
        <p style="color:#f0f0ff;font-size:16px;margin:0 0 8px">Your verification code is:</p>
        <div style="background:rgba(108,92,231,0.15);border:2px solid #6C5CE7;border-radius:12px;padding:20px;margin:20px 0">
          <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#a29bfe;font-family:monospace">${otp}</span>
        </div>
        <p style="color:#8888aa;font-size:13px;margin:16px 0 0">This code expires in <strong style="color:#f0f0ff">5 minutes</strong></p>
        <p style="color:#555577;font-size:12px;margin:16px 0 0">If you didn't request this, please ignore this email.</p>
      </div>
      <div style="background:rgba(255,255,255,0.03);padding:16px;text-align:center;border-top:1px solid rgba(255,255,255,0.06)">
        <p style="color:#555577;font-size:11px;margin:0">© ${new Date().getFullYear()} TeamFlow. All rights reserved.</p>
      </div>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"TeamFlow" <noreply@teamflow.com>',
        to: email,
        subject: 'TeamFlow — Your Verification Code: ' + otp,
        html: htmlContent
      });
      console.log('📧 OTP sent to:', email);
      return { sent: true, method: 'email' };
    } catch (err) {
      console.error('📧 Email send failed:', err.message);
      // Fall back to console-only
      console.log('📧 OTP for ' + email + ': ' + otp);
      return { sent: true, method: 'console' };
    }
  } else {
    // No SMTP configured — log to console for development
    console.log('═══════════════════════════════════════');
    console.log('📧 OTP for ' + email + ': ' + otp);
    console.log('═══════════════════════════════════════');
    return { sent: true, method: 'console' };
  }
}

// Store OTP with user data
function storeOTP(email, otp, userData) {
  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY,
    name: userData.name,
    password: userData.password
  });

  // Auto-cleanup after expiry
  setTimeout(() => {
    const entry = otpStore.get(email.toLowerCase());
    if (entry && entry.otp === otp) {
      otpStore.delete(email.toLowerCase());
    }
  }, OTP_EXPIRY + 1000);
}

// Verify OTP
function verifyOTP(email, otp) {
  const entry = otpStore.get(email.toLowerCase());
  if (!entry) {
    return { valid: false, error: 'OTP expired or not found. Please request a new one.' };
  }
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return { valid: false, error: 'OTP has expired. Please request a new one.' };
  }
  if (entry.otp !== otp) {
    return { valid: false, error: 'Invalid OTP. Please check and try again.' };
  }
  return { valid: true, data: { name: entry.name, password: entry.password } };
}

// Clear OTP after successful verification
function clearOTP(email) {
  otpStore.delete(email.toLowerCase());
}

module.exports = { generateOTP, sendOTPEmail, storeOTP, verifyOTP, clearOTP };
