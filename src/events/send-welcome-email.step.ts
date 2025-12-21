import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@ayumitra.ai';

let mailgun: any = null;
if (MAILGUN_API_KEY && MAILGUN_DOMAIN) {
  const mg = new Mailgun(FormData);
  mailgun = mg.client({ username: 'api', key: MAILGUN_API_KEY });
}

const welcomeEmailSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  full_name: z.string(),
  role: z.enum(['patient', 'doctor', 'clinic_admin', 'hospital_admin']),
  created_at: z.string()
});

export const config: EventConfig = {
  name: 'SendWelcomeEmail',
  type: 'event',
  description: 'Sends welcome email to newly registered users via Mailgun',
  subscribes: ['send-welcome-email'],
  emits: [],
  input: welcomeEmailSchema,
  flows: ['authentication']
};

export const handler: Handlers['SendWelcomeEmail'] = async (input, { logger }) => {
  try {
    const { user_id, email, full_name, role } = input;

    logger.info('Sending welcome email', { email, user_id });

    if (!mailgun || !MAILGUN_DOMAIN) {
      logger.warn('Mailgun not configured - email not sent (development mode)', {
        email,
        user_id
      });
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 5px; }
            .content { padding: 20px; background: #f9f9f9; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .button { display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to AyuMitraAI! 🏥</h1>
            </div>
            <div class="content">
              <p>Hi ${full_name},</p>
              <p>Thank you for joining AyuMitraAI! Your account has been successfully created.</p>
              <p><strong>Account Type:</strong> ${role.replace('_', ' ').toUpperCase()}</p>
              <p>You can now log in to your dashboard and start using our services.</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="button">Go to Dashboard</a>
              <p style="margin-top: 20px; font-size: 14px; color: #666;">
                If you didn't create this account, please ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>&copy; 2024 AyuMitraAI. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send via Mailgun
    await mailgun.messages.create(MAILGUN_DOMAIN, {
      from: FROM_EMAIL,
      to: email,
      subject: 'Welcome to AyuMitraAI - Your Account is Ready!',
      html: htmlContent,
      text: `Welcome to AyuMitraAI, ${full_name}!\n\nYour account has been created as a ${role}.\n\nGet started by logging in to your dashboard.\n\nBest regards,\nAyuMitraAI Team`
    });

    logger.info('Welcome email sent successfully', { email, user_id });
  } catch (error) {
    logger.error('Failed to send welcome email', {
      email: input.email,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
