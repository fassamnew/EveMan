import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Standard SMTP configuration (easily usable locally or on a VPS)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

interface EmailContent {
  to: string;
  subject: string;
  fullName: string;
  badgePath?: string;
}

export async function sendBadgeEmail({ to, subject, fullName, badgePath }: EmailContent) {
  const attachments = [];
  
  if (badgePath) {
    attachments.push({
      filename: `Badge_${fullName.replace(/\s+/g, '_')}.pdf`,
      path: path.join(__dirname, '..', badgePath)
    });
  }

  const mailOptions = {
    from: `"NH Event Team" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <h2>Hello ${fullName},</h2>
        <p>Thank you for registering for the <strong>NH Event 2026</strong>.</p>
        <p>Your registration is confirmed. Please find your digital badge and QR code attached to this email.</p>
        <p>Please have this badge ready (on your phone or printed) for quick entry at the event.</p>
        <br/>
        <p>Best regards,<br/>NH Event Team</p>
      </div>
    `,
    attachments
  };

  return transporter.sendMail(mailOptions);
}

export async function sendBulkReminder(attendees: { email: string, fullName: string }[], subject: string, message: string) {
    const results = { success: 0, failure: 0 };
    
    for (const attendee of attendees) {
        try {
            await transporter.sendMail({
                from: `"NH Event Team" <${process.env.EMAIL_USER}>`,
                to: attendee.email,
                subject: subject,
                html: `
                    <div style="font-family: sans-serif; line-height: 1.6;">
                        <p>Dear ${attendee.fullName},</p>
                        <p>${message}</p>
                        <br/>
                        <p>Best regards,<br/>NH Event Team</p>
                    </div>
                `
            });
            results.success++;
        } catch (error) {
            console.error(`Failed to send email to ${attendee.email}:`, error);
            results.failure++;
        }
    }
    return results;
}
