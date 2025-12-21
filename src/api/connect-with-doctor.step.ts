import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

const connectWithDoctorSchema = z.object({
  doctor_id: z.string().min(1, 'Doctor ID is required'),
  symptom_description: z.string().min(10, 'Symptom description required').max(2000),
  patient_age: z.number().int().min(0).max(150).optional(),
  urgency_level: z.enum(['critical', 'moderate', 'mild']).optional()
});

export const config: ApiRouteConfig = {
  name: 'ConnectWithDoctor',
  type: 'api',
  path: '/patient/connect-with-doctor',
  method: 'POST',
  description: 'Patient requests consultation with a specific doctor',
  emits: ['patient-request-created', 'notify-doctor'],
  flows: ['patient-doctor-connection'],
  bodySchema: connectWithDoctorSchema,
  responseSchema: {
    201: z.object({
      request_id: z.string(),
      status: z.string(),
      doctor_id: z.string(),
      patient_id: z.string(),
      created_at: z.string(),
      message: z.string()
    }),
    400: z.object({ error: z.string() }),
    404: z.object({ error: z.string() }),
    500: z.object({ error: z.string() })
  }
};

export const handler: Handlers['ConnectWithDoctor'] = async (req, { emit, logger, state }) => {
  try {
    // TODO: Get patient_id from JWT token
    const patientId = 'patient-123'; // Should come from auth middleware

    // Validate request
    const requestData = connectWithDoctorSchema.parse(req.body);
    const requestId = crypto.randomUUID();
    const now = new Date().toISOString();

    logger.info('Patient requesting doctor connection', {
      request_id: requestId,
      patient_id: patientId,
      doctor_id: requestData.doctor_id
    });

    // Verify doctor exists and is online
    const doctors = (await state.get('doctors')) || [];
    const doctor = doctors.find((d: any) => d.doctor_id === requestData.doctor_id);

    if (!doctor) {
      logger.warn('Doctor not found', { doctor_id: requestData.doctor_id });
      return {
        status: 404,
        body: { error: 'Doctor not found' }
      };
    }

    if (!doctor.availability?.is_online) {
      logger.warn('Doctor is offline', { doctor_id: requestData.doctor_id });
      return {
        status: 400,
        body: { error: 'Doctor is currently offline' }
      };
    }

    // Create patient request document
    const patientRequest = {
      request_id: requestId,
      patient_id: patientId,
      doctor_id: requestData.doctor_id,
      symptom_description: requestData.symptom_description,
      patient_age: requestData.patient_age,
      urgency_level: requestData.urgency_level || 'moderate',
      status: 'pending', // pending, accepted, rejected, completed
      created_at: now,
      accepted_at: null,
      completed_at: null
    };

    // Store patient request
    const patientRequests = (await state.get('patient-requests')) || [];
    patientRequests.push(patientRequest);
    await state.set('patient-requests', patientRequests, { ttl: 86400 * 7 }); // 7 days

    // Emit event to notify doctor
    await emit({
      topic: 'patient-request-created',
      data: {
        request_id: requestId,
        patient_id: patientId,
        doctor_id: requestData.doctor_id,
        symptom_description: requestData.symptom_description,
        urgency_level: requestData.urgency_level || 'moderate',
        created_at: now
      }
    });

    // Emit event to notify doctor (separate event for real-time notification)
    await emit({
      topic: 'notify-doctor',
      data: {
        request_id: requestId,
        doctor_id: requestData.doctor_id,
        patient_id: patientId,
        symptom_description: requestData.symptom_description,
        urgency_level: requestData.urgency_level || 'moderate'
      }
    });

    logger.info('Patient request created successfully', {
      request_id: requestId,
      doctor_id: requestData.doctor_id,
      patient_id: patientId
    });

    return {
      status: 201,
      body: {
        request_id: requestId,
        status: 'pending',
        doctor_id: requestData.doctor_id,
        patient_id: patientId,
        created_at: now,
        message: 'Request sent to doctor. Waiting for response...'
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Connection request validation failed', { errors: error.errors });
      return {
        status: 400,
        body: { error: 'Validation failed' }
      };
    }

    logger.error('Failed to create connection request', {
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      status: 500,
      body: { error: 'Failed to create request' }
    };
  }
};
