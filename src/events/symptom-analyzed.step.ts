import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

const symptomAnalyzedSchema = z.object({
  request_id: z.string(),
  symptom_description: z.string(),
  patient_age: z.number().optional(),
  analysis: z.object({
    urgency_level: z.enum(['critical', 'moderate', 'mild']),
    primary_specialty: z.string(),
    recommended_actions: z.array(z.string())
  }),
  patient_location: z.object({
    lat: z.number().optional(),
    lon: z.number().optional(),
    address: z.string().optional()
  }).optional()
});

export const config: EventConfig = {
  name: 'SymptomAnalyzed',
  type: 'event',
  description: 'Processes analyzed symptoms to find matching doctors and facilities',
  subscribes: ['symptom-analyzed'],
  emits: ['find-matching-doctors', 'notify-patient'],
  input: symptomAnalyzedSchema,
  flows: ['symptom-analysis']
};

export const handler: Handlers['SymptomAnalyzed'] = async (input, { emit, logger, state }) => {
  try {
    const { request_id, symptom_description, patient_age, analysis, patient_location } = input;

    logger.info('Processing analyzed symptoms', {
      request_id,
      specialty: analysis.primary_specialty,
      urgency: analysis.urgency_level
    });

    // Task 1: Find matching doctors based on specialty and urgency
    await emit({
      topic: 'find-matching-doctors',
      data: {
        request_id,
        specialty: analysis.primary_specialty,
        urgency_level: analysis.urgency_level,
        patient_location,
        patient_age
      }
    });

    // Task 2: Notify patient of analysis results
    await emit({
      topic: 'notify-patient',
      data: {
        request_id,
        urgency_level: analysis.urgency_level,
        primary_specialty: analysis.primary_specialty,
        recommended_actions: analysis.recommended_actions
      }
    });

    // Store processing event for audit trail
    const processingEvents = (await state.get('symptom-processing-events')) || [];
    processingEvents.push({
      request_id,
      specialty: analysis.primary_specialty,
      urgency: analysis.urgency_level,
      timestamp: new Date().toISOString()
    });
    await state.set('symptom-processing-events', processingEvents, { ttl: 86400 * 30 }); // 30 days

    logger.info('Symptom analysis processing completed', { request_id });
  } catch (error) {
    logger.error('Failed to process analyzed symptoms', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error; // Motia will retry
  }
};
