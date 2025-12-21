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

const sendHospitalWelcomeEmailSchema = z.object({
  facility_id: z.string(),
  admin_id: z.string(),
  email: z.string().email(),
  full_name: z.string(),
  hospital_name: z.string(),
  created_at: z.string()
});

export const config: EventConfig = {
  name: 'SendHospitalWelcomeEmail',
  type: 'event',
  description: 'Sends welcome email to newly registered hospital administrator',
  subscribes: ['send-hospital-welcome-email'],
  emits: [],
  input: sendHospitalWelcomeEmailSchema,
  flows: ['authentication']
};

export const handler: Handlers['SendHospitalWelcomeEmail'] = async (input, { logger }) => {
  try {
    const { facility_id, admin_id, email, full_name, hospital_name } = input;

    logger.info('Sending hospital welcome email', { email, facility_id });

    if (!mailgun || !MAILGUN_DOMAIN) {
      logger.warn('Mailgun not configured - email not sent (development mode)', {
        email,
        facility_id
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
            .section { margin: 15px 0; }
            .button { display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .info-box { background: #e8f4f8; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to AyuMitraAI! 🏥</h1>
            </div>
            <div class="content">
              <p>Hi ${full_name},</p>
              <p>Thank you for registering your hospital on AyuMitraAI. Your hospital account has been successfully created.</p>
              
              <div class="section">
                <h3>Your Hospital Information:</h3>
                <ul>
                  <li><strong>Hospital Name:</strong> ${hospital_name}</li>
                  <li><strong>Facility ID:</strong> ${facility_id}</li>
                  <li><strong>Account Type:</strong> Hospital Administrator</li>
                </ul>
              </div>

              <div class="info-box">
                <strong>Next Steps:</strong>
                <ol>
                  <li>Log in to your hospital dashboard</li>
                  <li>Share your Facility ID (${facility_id}) with your doctors</li>
                  <li>Doctors can use this ID to register and join your hospital</li>
                  <li>Manage your hospital's departments, doctors, and consultations</li>
                </ol>
              </div>

              <p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/hospital-dashboard" class="button">Go to Hospital Dashboard</a>
              </p>

              <div class="section" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666;">
                <p><strong>Important:</strong> Share your Facility ID with your doctors so they can register under your hospital.</p>
                <p><strong>Support:</strong> If you have any questions, please contact our support team at support@ayumitra.ai</p>
              </div>
            </div>
            <div class="footer">
              <p>&copy; 2024 AyuMitraAI. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await mailgun.messages.create(MAILGUN_DOMAIN, {
      from: FROM_EMAIL,
      to: email,
      subject: 'Welcome to AyuMitraAI - Hospital Account Created',
      html: htmlContent,
      text: `Welcome to AyuMitraAI, ${full_name}!\n\nYour hospital account has been created.\n\nHospital Name: ${hospital_name}\nFacility ID: ${facility_id}\n\nShare your Facility ID with your doctors so they can register.\n\nBest regards,\nAyuMitraAI Team`
    });

    logger.info('Hospital welcome email sent successfully', { email, facility_id });
  } catch (error) {
    logger.error('Failed to send hospital welcome email', {
      email: input.email,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
