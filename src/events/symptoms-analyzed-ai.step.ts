import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

const symptomsAnalyzedAISchema = z.object({
  request_id: z.string(),
  symptom_description: z.string(),
  patient_age: z.number().optional(),
  analysis: z.object({
    urgency_level: z.enum(['critical', 'moderate', 'mild']),
    urgency_score: z.number(),
    urgency_justification: z.string(),
    primary_specialty: z.string(),
    primary_confidence: z.number(),
    primary_reasons: z.array(z.string()),
    alternative_specialties: z.array(z.any()).optional(),
    critical_warnings: z.array(z.string()).optional(),
    recommended_actions: z.array(z.string())
  }),
  timestamp: z.string()
});

export const config: EventConfig = {
  name: 'SymptomsAnalyzedAI',
  type: 'event',
  description: 'Processes AI-analyzed symptoms and finds matching doctors',
  subscribes: ['symptoms-analyzed-ai'],
  emits: ['find-matching-doctors-ai', 'notify-patient-ai'],
  input: symptomsAnalyzedAISchema,
  flows: ['ai-symptom-analysis']
};

export const handler: Handlers['SymptomsAnalyzedAI'] = async (input, { emit, logger, state }) => {
  try {
    const { request_id, symptom_description, patient_age, analysis, timestamp } = input;

    logger.info('Processing AI-analyzed symptoms', {
      request_id,
      urgency: analysis.urgency_level,
      specialty: analysis.primary_specialty
    });

    // Store analysis results
    await state.set(`ai-analysis-${request_id}`, {
      request_id,
      symptom_description,
      patient_age,
      analysis,
      timestamp,
      processed_at: new Date().toISOString()
    }, { ttl: 86400 * 7 }); // 7 days

    // Task 1: Find matching doctors based on AI analysis
    await emit({
      topic: 'find-matching-doctors-ai',
      data: {
        request_id,
        specialty: analysis.primary_specialty,
        urgency_level: analysis.urgency_level,
        patient_age,
        critical_warnings: analysis.critical_warnings || []
      }
    });

    // Task 2: Notify patient of analysis results
    await emit({
      topic: 'notify-patient-ai',
      data: {
        request_id,
        urgency_level: analysis.urgency_level,
        primary_specialty: analysis.primary_specialty,
        recommended_actions: analysis.recommended_actions,
        critical_warnings: analysis.critical_warnings || []
      }
    });

    logger.info('AI analysis processing completed', {
      request_id,
      urgency: analysis.urgency_level
    });
  } catch (error) {
    logger.error('Failed to process AI-analyzed symptoms', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
