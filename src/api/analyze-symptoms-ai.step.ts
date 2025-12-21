import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

const symptomAnalysisAISchema = z.object({
  symptom_description: z.string().min(10, 'Symptom description must be at least 10 characters').max(2000),
  patient_age: z.number().int().min(0).max(150).optional(),
  patient_location: z.object({
    lat: z.number().optional(),
    lon: z.number().optional(),
    address: z.string().optional()
  }).optional()
});

export const config: ApiRouteConfig = {
  name: 'AnalyzeSymptomsAI',
  type: 'api',
  path: '/analyze-symptoms-ai',
  method: 'POST',
  description: 'Analyze patient symptoms using AI (LangChain + Groq)',
  emits: ['analyze-symptoms-ai'],
  flows: ['ai-symptom-analysis'],
  bodySchema: symptomAnalysisAISchema,
  responseSchema: {
    202: z.object({
      request_id: z.string(),
      status: z.string(),
      message: z.string(),
      analysis_timestamp: z.string()
    }),
    400: z.object({ error: z.string() }),
    500: z.object({ error: z.string() })
  }
};

export const handler: Handlers['AnalyzeSymptomsAI'] = async (req, { emit, logger, state }) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Validate request
    const analysisRequest = symptomAnalysisAISchema.parse(req.body);

    logger.info('AI symptom analysis request received', {
      request_id: requestId,
      symptom_length: analysisRequest.symptom_description.length,
      patient_age: analysisRequest.patient_age
    });

    // Emit event to trigger Python LangChain agent
    await emit({
      topic: 'analyze-symptoms-ai',
      data: {
        request_id: requestId,
        symptom_description: analysisRequest.symptom_description,
        patient_age: analysisRequest.patient_age,
        patient_location: analysisRequest.patient_location
      }
    });

    logger.info('AI analysis event emitted', { request_id: requestId });

    // Return 202 Accepted (async processing)
    return {
      status: 202,
      body: {
        request_id: requestId,
        status: 'processing',
        message: 'Your symptoms are being analyzed by our AI. Results will be available shortly.',
        analysis_timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('AI analysis validation failed', { errors: error.errors });
      return {
        status: 400,
        body: { error: 'Validation failed' }
      };
    }

    logger.error('AI analysis request failed', {
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      status: 500,
      body: { error: 'Analysis request failed' }
    };
  }
};
