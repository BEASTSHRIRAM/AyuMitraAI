import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

const hospitalRegisteredSchema = z.object({
  facility_id: z.string(),
  admin_id: z.string(),
  email: z.string().email(),
  full_name: z.string(),
  hospital_name: z.string(),
  created_at: z.string()
});

export const config: EventConfig = {
  name: 'HospitalRegistered',
  type: 'event',
  description: 'Handles hospital registration completion',
  subscribes: ['hospital-registered'],
  emits: ['send-hospital-welcome-email'],
  input: hospitalRegisteredSchema,
  flows: ['authentication']
};

export const handler: Handlers['HospitalRegistered'] = async (input, { emit, logger }) => {
  try {
    const { facility_id, admin_id, email, full_name, hospital_name, created_at } = input;

    logger.info('Processing hospital registration', {
      facility_id,
      admin_id,
      hospital_name
    });

    // Emit event to send welcome email
    await emit({
      topic: 'send-hospital-welcome-email',
      data: {
        facility_id,
        admin_id,
        email,
        full_name,
        hospital_name,
        created_at
      }
    });

    logger.info('Hospital registration processed successfully', {
      facility_id,
      hospital_name
    });
  } catch (error) {
    logger.error('Failed to process hospital registration', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
