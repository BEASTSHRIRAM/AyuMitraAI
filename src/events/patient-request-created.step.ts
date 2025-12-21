import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

const patientRequestCreatedSchema = z.object({
  request_id: z.string(),
  patient_id: z.string(),
  doctor_id: z.string(),
  symptom_description: z.string(),
  urgency_level: z.enum(['critical', 'moderate', 'mild']),
  created_at: z.string()
});

export const config: EventConfig = {
  name: 'PatientRequestCreated',
  type: 'event',
  description: 'Handles new patient consultation requests',
  subscribes: ['patient-request-created'],
  emits: [],
  input: patientRequestCreatedSchema,
  flows: ['patient-doctor-connection']
};

export const handler: Handlers['PatientRequestCreated'] = async (input, { logger, state }) => {
  try {
    const { request_id, patient_id, doctor_id, symptom_description, urgency_level, created_at } = input;

    logger.info('Processing patient request', {
      request_id,
      patient_id,
      doctor_id,
      urgency_level
    });

    // Store request event for audit trail
    const requestEvents = (await state.get('patient-request-events')) || [];
    requestEvents.push({
      request_id,
      patient_id,
      doctor_id,
      urgency_level,
      timestamp: new Date().toISOString()
    });
    await state.set('patient-request-events', requestEvents, { ttl: 86400 * 30 });

    // TODO: In production, you could:
    // 1. Send real-time notification to doctor via WebSocket
    // 2. Store in database for persistence
    // 3. Create notification record for doctor dashboard
    // 4. Trigger analytics for request tracking
    // 5. Set up timeout for auto-rejection if not accepted within X minutes

    logger.info('Patient request processed successfully', {
      request_id,
      doctor_id,
      urgency: urgency_level
    });
  } catch (error) {
    logger.error('Failed to process patient request', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
