import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

const findDoctorsSchema = z.object({
  request_id: z.string(),
  specialty: z.string(),
  urgency_level: z.enum(['critical', 'moderate', 'mild']),
  patient_location: z.object({
    lat: z.number().optional(),
    lon: z.number().optional(),
    address: z.string().optional()
  }).optional(),
  patient_age: z.number().optional()
});

export const config: EventConfig = {
  name: 'FindMatchingDoctors',
  type: 'event',
  description: 'Finds available doctors matching the required specialty and urgency level',
  subscribes: ['find-matching-doctors'],
  emits: ['doctors-found', 'notify-doctors'],
  input: findDoctorsSchema,
  flows: ['symptom-analysis']
};

export const handler: Handlers['FindMatchingDoctors'] = async (input, { emit, logger, state }) => {
  try {
    const { request_id, specialty, urgency_level, patient_location, patient_age } = input;

    logger.info('Searching for matching doctors', {
      request_id,
      specialty,
      urgency: urgency_level
    });

    // TODO: Query database for matching doctors
    // For now, mock data
    const matchingDoctors = [
      {
        doctor_id: 'doc-001',
        full_name: 'Dr. Sarah Johnson',
        specialization: specialty,
        experience_years: 12,
        facility_name: 'City Medical Center',
        is_online: true,
        rating: 4.8
      },
      {
        doctor_id: 'doc-002',
        full_name: 'Dr. Michael Chen',
        specialization: specialty,
        experience_years: 8,
        facility_name: 'Health Plus Clinic',
        is_online: true,
        rating: 4.6
      }
    ];

    logger.info('Found matching doctors', {
      request_id,
      doctor_count: matchingDoctors.length
    });

    // Emit event to notify doctors of new patient request
    await emit({
      topic: 'notify-doctors',
      data: {
        request_id,
        doctors: matchingDoctors,
        urgency_level,
        specialty
      }
    });

    // Store doctor matches in state
    await state.set(`doctors-${request_id}`, matchingDoctors, { ttl: 3600 }); // 1 hour TTL

    // Emit event for patient notification with doctor list
    await emit({
      topic: 'doctors-found',
      data: {
        request_id,
        doctors: matchingDoctors,
        doctor_count: matchingDoctors.length
      }
    });

    logger.info('Doctor matching completed', { request_id });
  } catch (error) {
    logger.error('Failed to find matching doctors', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error; // Motia will retry
  }
};
