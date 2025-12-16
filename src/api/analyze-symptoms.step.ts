import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

// Define request schema
const symptomAnalysisSchema = z.object({
  symptom_description: z.string().min(10, 'Symptom description must be at least 10 characters').max(2000),
  patient_age: z.number().int().min(0).max(150).optional(),
  patient_location: z.object({
    lat: z.number().optional(),
    lon: z.number().optional(),
    address: z.string().optional()
  }).optional()
});

export const config: ApiRouteConfig = {
  name: 'AnalyzeSymptoms',
  type: 'api',
  path: '/analyze-symptoms',
  method: 'POST',
  description: 'Analyze patient symptoms and provide routing recommendations',
  emits: ['symptom-analyzed'], // Emit after analysis for further processing
  flows: ['symptom-analysis'],
  bodySchema: symptomAnalysisSchema,
  responseSchema: {
    200: z.object({
      request_id: z.string(),
      routing_decision: z.object({
        urgency: z.object({
          level: z.enum(['critical', 'moderate', 'mild']),
          score: z.number(),
          justification: z.string()
        }),
        primary_specialty: z.object({
          specialty: z.string(),
          confidence: z.number(),
          reasons: z.array(z.string())
        }),
        alternative_specialties: z.array(z.any()).optional(),
        recommended_facilities: z.array(z.any()).optional(),
        recommended_actions: z.array(z.string())
      }),
      analysis_timestamp: z.string(),
      processing_time_ms: z.number()
    }),
    400: z.object({ error: z.string() }),
    500: z.object({ error: z.string() })
  }
};

export const handler: Handlers['AnalyzeSymptoms'] = async (req, { emit, logger, state }) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Validate request
    const analysisRequest = symptomAnalysisSchema.parse(req.body);

    logger.info('Symptom analysis request received', {
      request_id: requestId,
      symptom_length: analysisRequest.symptom_description.length,
      patient_age: analysisRequest.patient_age
    });

    // TODO: Call Cerebras AI service for analysis
    // For now, we'll use mock data
    const analysis = {
      urgency_level: 'moderate',
      urgency_score: 0.65,
      urgency_justification: 'Symptoms suggest moderate urgency requiring specialist consultation',
      primary_specialty: 'Neurology',
      primary_confidence: 0.85,
      primary_reasons: [
        'Headache and dizziness mentioned',
        'Neurological symptoms present',
        'Age and symptom combination suggests neurological evaluation'
      ],
      alternative_specialties: [
        {
          specialty: 'General Medicine',
          confidence: 0.6,
          reasons: ['Initial consultation recommended']
        }
      ],
      recommended_actions: [
        'Schedule appointment with neurologist',
        'Avoid strenuous activities',
        'Monitor symptoms for changes',
        'Seek emergency care if symptoms worsen'
      ],
      critical_warnings: []
    };

    // Store analysis in state for later retrieval
    const analysisData = {
      request_id: requestId,
      symptom_description: analysisRequest.symptom_description,
      patient_age: analysisRequest.patient_age,
      analysis,
      timestamp: new Date().toISOString()
    };

    await state.set(`analysis-${requestId}`, analysisData, { ttl: 86400 }); // 24 hour TTL

    // Emit event for further processing (finding doctors, sending notifications, etc.)
    await emit({
      topic: 'symptom-analyzed',
      data: {
        request_id: requestId,
        symptom_description: analysisRequest.symptom_description,
        patient_age: analysisRequest.patient_age,
        analysis,
        patient_location: analysisRequest.patient_location
      }
    });

    const processingTime = Date.now() - startTime;

    logger.info('Symptom analysis completed', {
      request_id: requestId,
      specialty: analysis.primary_specialty,
      urgency: analysis.urgency_level,
      processing_time_ms: processingTime
    });

    return {
      status: 200,
      body: {
        request_id: requestId,
        routing_decision: {
          urgency: {
            level: analysis.urgency_level,
            score: analysis.urgency_score,
            justification: analysis.urgency_justification
          },
          primary_specialty: {
            specialty: analysis.primary_specialty,
            confidence: analysis.primary_confidence,
            reasons: analysis.primary_reasons
          },
          alternative_specialties: analysis.alternative_specialties,
          recommended_facilities: [],
          recommended_actions: analysis.recommended_actions
        },
        analysis_timestamp: new Date().toISOString(),
        processing_time_ms: processingTime
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Symptom analysis validation failed', {
        request_id: requestId,
        errors: error.errors
      });
      return {
        status: 400,
        body: { error: 'Validation failed' }
      };
    }

    logger.error('Symptom analysis failed', {
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      status: 500,
      body: { error: 'Analysis failed' }
    };
  }
};
