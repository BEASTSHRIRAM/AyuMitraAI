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

const notifyPatientAISchema = z.object({
  request_id: z.string(),
  urgency_level: z.enum(['critical', 'moderate', 'mild']),
  primary_specialty: z.string(),
  recommended_actions: z.array(z.string()),
  critical_warnings: z.array(z.string()).optional()
});

export const config: EventConfig = {
  name: 'NotifyPatientAI',
  type: 'event',
  description: 'Sends AI analysis results to patient',
  subscribes: ['notify-patient-ai'],
  emits: [],
  input: notifyPatientAISchema,
  flows: ['ai-symptom-analysis']
};

export const handler: Handlers['NotifyPatientAI'] = async (input, { logger, state }) => {
  try {
    const { request_id, urgency_level, primary_specialty, recommended_actions, critical_warnings } = input;

    logger.info('Notifying patient of AI analysis', {
      request_id,
      urgency: urgency_level
    });

    // Store notification for patient dashboard
    const notifications = (await state.get('patient-ai-notifications')) || [];
    notifications.push({
      notification_id: crypto.randomUUID(),
      request_id,
      urgency_level,
      primary_specialty,
      recommended_actions,
      critical_warnings: critical_warnings || [],
      created_at: new Date().toISOString(),
      read: false
    });
    await state.set('patient-ai-notifications', notifications, { ttl: 86400 * 30 });

    // TODO: Send real-time notification via WebSocket
    // For now, store in state for patient to retrieve

    // Optional: Send email for critical cases
    if (urgency_level === 'critical' && mailgun && MAILGUN_DOMAIN) {
      // TODO: Get patient email from database
      // For now, just log
      logger.info('Critical case - would send urgent email to patient', {
        request_id,
        specialty: primary_specialty
      });
    }

    logger.info('Patient notification processed', {
      request_id,
      urgency: urgency_level
    });
  } catch (error) {
    logger.error('Failed to notify patient', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
