const nodemailer = require('nodemailer');

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || host === 'smtp.example.com') {
    return null; // Development mode without configured SMTP
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Sends a password reset email to the specified user email address.
 * @param {string} toEmail - Recipient email address
 * @param {string} resetUrl - Complete password reset link with token
 */
const sendPasswordResetEmail = async (toEmail, resetUrl) => {
  const transporter = createTransporter();
  const fromEmail = process.env.EMAIL_FROM || '"SaaS Analytics" <noreply@example.com>';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #4f46e5; margin-bottom: 16px;">Reset Your Password</h2>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">
        You requested a password reset for your <strong>SaaS Analytics Dashboard</strong> account.
      </p>
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">
        Click the button below to set up a new password. This link is valid for 1 hour:
      </p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.4;">
        If you didn't request a password reset, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">
        Link not working? Copy and paste this URL into your browser:<br />
        <a href="${resetUrl}" style="color: #4f46e5; word-break: break-all;">${resetUrl}</a>
      </p>
    </div>
  `;

  if (!transporter) {
    console.log(`[Dev Mail Log] Password reset email requested for ${toEmail}`);
    console.log(`[Dev Mail Log] Reset Link: ${resetUrl}`);
    return { devMode: true, message: 'SMTP not configured; reset link logged to server console.' };
  }

  const mailOptions = {
    from: fromEmail,
    to: toEmail,
    subject: 'Password Reset Request - SaaS Analytics',
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${toEmail}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`Failed to send password reset email to ${toEmail}:`, err);
    throw new Error('Failed to deliver password reset email. Please check server SMTP configuration.');
  }
};

module.exports = {
  sendPasswordResetEmail,
};
