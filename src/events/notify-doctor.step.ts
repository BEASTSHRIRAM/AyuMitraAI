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

const notifyDoctorSchema = z.object({
  request_id: z.string(),
  doctor_id: z.string(),
  patient_id: z.string(),
  symptom_description: z.string(),
  urgency_level: z.enum(['critical', 'moderate', 'mild'])
});

export const config: EventConfig = {
  name: 'NotifyDoctor',
  type: 'event',
  description: 'Sends notification to doctor about new patient request',
  subscribes: ['notify-doctor'],
  emits: [],
  input: notifyDoctorSchema,
  flows: ['patient-doctor-connection']
};

export const handler: Handlers['NotifyDoctor'] = async (input, { logger, state }) => {
  try {
    const { request_id, doctor_id, patient_id, symptom_description, urgency_level } = input;

    logger.info('Notifying doctor of new patient request', {
      request_id,
      doctor_id,
      urgency_level
    });

    // Get doctor details from state
    const doctors = (await state.get('doctors')) || [];
    const doctor = doctors.find((d: any) => d.doctor_id === doctor_id);

    if (!doctor) {
      logger.warn('Doctor not found for notification', { doctor_id });
      return;
    }

    // TODO: Send real-time notification via:
    // 1. WebSocket/Socket.io for instant UI update
    // 2. Push notification to mobile app
    // 3. Email notification (optional)

    // For now, store notification in state
    const notifications = (await state.get(`doctor-notifications-${doctor_id}`)) || [];
    notifications.push({
      notification_id: crypto.randomUUID(),
      request_id,
      patient_id,
      symptom_description,
      urgency_level,
      created_at: new Date().toISOString(),
      read: false
    });
    await state.set(`doctor-notifications-${doctor_id}`, notifications, { ttl: 86400 * 7 });

    // Optional: Send email notification for critical cases
    if (urgency_level === 'critical' && mailgun && MAILGUN_DOMAIN) {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; padding: 20px; border-radius: 5px; }
              .content { padding: 20px; background: #f9f9f9; border-radius: 5px; margin-top: 20px; }
              .urgency-badge { display: inline-block; background: #ff6b6b; color: white; padding: 5px 10px; border-radius: 3px; font-weight: bold; }
              .button { display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🚨 New Patient Request - CRITICAL</h1>
              </div>
              <div class="content">
                <p>Hi Dr. ${doctor.full_name},</p>
                <p>You have received a new patient consultation request with <span class="urgency-badge">CRITICAL</span> urgency.</p>
                
                <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ff6b6b; margin: 15px 0;">
                  <p><strong>Patient Symptoms:</strong></p>
                  <p>${symptom_description}</p>
                </div>

                <p><strong>Request ID:</strong> ${request_id}</p>
                <p><strong>Urgency Level:</strong> CRITICAL</p>

                <p>Please review this request as soon as possible and respond to the patient.</p>

                <p>
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/doctor-dashboard" class="button">View Request in Dashboard</a>
                </p>
              </div>
              <div class="footer">
                <p>&copy; 2024 AyuMitraAI. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      try {
        await mailgun.messages.create(MAILGUN_DOMAIN, {
          from: FROM_EMAIL,
          to: doctor.email,
          subject: '🚨 CRITICAL: New Patient Request - Immediate Action Required',
          html: htmlContent,
          text: `CRITICAL: New patient request received.\n\nSymptoms: ${symptom_description}\n\nPlease log in to your dashboard to respond.`
        });
        logger.info('Critical notification email sent to doctor', { doctor_id });
      } catch (emailError) {
        logger.warn('Failed to send critical notification email', {
          doctor_id,
          error: emailError instanceof Error ? emailError.message : String(emailError)
        });
      }
    }

    logger.info('Doctor notification processed', {
      request_id,
      doctor_id,
      urgency_level
    });
  } catch (error) {
    logger.error('Failed to notify doctor', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
