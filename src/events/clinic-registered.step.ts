import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

const clinicRegisteredSchema = z.object({
  facility_id: z.string(),
  admin_id: z.string(),
  email: z.string().email(),
  full_name: z.string(),
  clinic_name: z.string(),
  created_at: z.string()
});

export const config: EventConfig = {
  name: 'ClinicRegistered',
  type: 'event',
  description: 'Handles clinic registration completion',
  subscribes: ['clinic-registered'],
  emits: ['send-clinic-welcome-email'],
  input: clinicRegisteredSchema,
  flows: ['authentication']
};

export const handler: Handlers['ClinicRegistered'] = async (input, { emit, logger }) => {
  try {
    const { facility_id, admin_id, email, full_name, clinic_name, created_at } = input;

    logger.info('Processing clinic registration', {
      facility_id,
      admin_id,
      clinic_name
    });

    // Emit event to send welcome email
    await emit({
      topic: 'send-clinic-welcome-email',
      data: {
        facility_id,
        admin_id,
        email,
        full_name,
        clinic_name,
        created_at
      }
    });

    logger.info('Clinic registration processed successfully', {
      facility_id,
      clinic_name
    });
  } catch (error) {
    logger.error('Failed to process clinic registration', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
