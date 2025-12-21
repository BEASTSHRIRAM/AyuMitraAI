import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

const findMatchingDoctorsAISchema = z.object({
  request_id: z.string(),
  specialty: z.string(),
  urgency_level: z.enum(['critical', 'moderate', 'mild']),
  patient_age: z.number().optional(),
  critical_warnings: z.array(z.string()).optional()
});

export const config: EventConfig = {
  name: 'FindMatchingDoctorsAI',
  type: 'event',
  description: 'Finds available doctors matching AI-recommended specialty',
  subscribes: ['find-matching-doctors-ai'],
  emits: [],
  input: findMatchingDoctorsAISchema,
  flows: ['ai-symptom-analysis']
};

export const handler: Handlers['FindMatchingDoctorsAI'] = async (input, { logger, state }) => {
  try {
    const { request_id, specialty, urgency_level, patient_age, critical_warnings } = input;

    logger.info('Finding doctors for AI analysis', {
      request_id,
      specialty,
      urgency: urgency_level
    });

    // Get all doctors from state
    const doctors = (await state.get('doctors')) || [];

    // Filter doctors matching the specialty
    let matchingDoctors = doctors.filter((doctor: any) => {
      // Must be online
      if (!doctor.availability?.is_online) {
        return false;
      }

      // Check if session is still active
      const lastOnline = new Date(doctor.availability.last_online);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (lastOnline < fiveMinutesAgo) {
        return false;
      }

      // Match specialty
      const doctorSpec = doctor.specialization.toLowerCase();
      const filterSpec = specialty.toLowerCase();
      return doctorSpec.includes(filterSpec) || filterSpec.includes(doctorSpec);
    });

    // Sort by rating and experience
    matchingDoctors.sort((a: any, b: any) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return b.experience_years - a.experience_years;
    });

    // For critical cases, prioritize more experienced doctors
    if (urgency_level === 'critical') {
      matchingDoctors.sort((a: any, b: any) => b.experience_years - a.experience_years);
    }

    // Limit to top 5 doctors
    const topDoctors = matchingDoctors.slice(0, 5);

    logger.info('Matching doctors found', {
      request_id,
      total_found: matchingDoctors.length,
      top_doctors: topDoctors.length,
      urgency: urgency_level
    });

    // Store matching doctors for later retrieval
    await state.set(`matching-doctors-${request_id}`, {
      request_id,
      specialty,
      urgency_level,
      doctors: topDoctors,
      total_available: matchingDoctors.length,
      timestamp: new Date().toISOString()
    }, { ttl: 3600 }); // 1 hour

    logger.info('Matching doctors stored', {
      request_id,
      count: topDoctors.length
    });
  } catch (error) {
    logger.error('Failed to find matching doctors', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
