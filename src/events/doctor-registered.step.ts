import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

const doctorRegisteredSchema = z.object({
  doctor_id: z.string(),
  email: z.string().email(),
  full_name: z.string(),
  specialization: z.string(),
  facility_id: z.string(),
  created_at: z.string()
});

export const config: EventConfig = {
  name: 'DoctorRegistered',
  type: 'event',
  description: 'Handles post-registration tasks for doctors',
  subscribes: ['doctor-registered'],
  emits: ['send-doctor-welcome-email'],
  input: doctorRegisteredSchema,
  flows: ['authentication']
};

export const handler: Handlers['DoctorRegistered'] = async (input, { emit, logger, state }) => {
  try {
    const { doctor_id, email, full_name, specialization, facility_id, created_at } = input;

    logger.info('Processing doctor registration', {
      doctor_id,
      email,
      specialization
    });

    // Task 1: Send welcome email to doctor
    await emit({
      topic: 'send-doctor-welcome-email',
      data: {
        doctor_id,
        email,
        full_name,
        specialization,
        facility_id,
        created_at
      }
    });

    // Task 2: Store registration event for analytics
    const registrationEvents = (await state.get('doctor-registration-events')) || [];
    registrationEvents.push({
      doctor_id,
      email,
      specialization,
      facility_id,
      timestamp: new Date().toISOString()
    });
    await state.set('doctor-registration-events', registrationEvents, { ttl: 86400 * 30 });

    logger.info('Doctor registration processed successfully', { doctor_id, email });
  } catch (error) {
    logger.error('Failed to process doctor registration', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
