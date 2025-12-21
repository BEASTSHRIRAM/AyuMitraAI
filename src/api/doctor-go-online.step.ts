import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

const goOnlineSchema = z.object({
  is_online: z.boolean(),
  time_slots: z.array(z.object({
    day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    start_time: z.string(),
    end_time: z.string(),
    slot_duration_minutes: z.number().int().min(10).max(120).default(40),
    max_patients: z.number().int().min(1)
  })).optional()
});

export const config: ApiRouteConfig = {
  name: 'DoctorGoOnline',
  type: 'api',
  path: '/doctor/availability',
  method: 'PUT',
  description: 'Update doctor online status and availability time slots',
  emits: ['doctor-status-changed'],
  flows: ['doctor-management'],
  bodySchema: goOnlineSchema,
  responseSchema: {
    200: z.object({
      message: z.string(),
      doctor_id: z.string(),
      is_online: z.boolean(),
      last_online: z.string()
    }),
    400: z.object({ error: z.string() }),
    401: z.object({ error: z.string() }),
    500: z.object({ error: z.string() })
  }
};

export const handler: Handlers['DoctorGoOnline'] = async (req, { emit, logger, state }) => {
  try {
    // TODO: Get doctor_id from JWT token in headers
    // For now, we'll use a mock doctor_id
    const doctorId = 'doctor-123'; // Should come from auth middleware

    // Validate request
    const availabilityData = goOnlineSchema.parse(req.body);

    logger.info('Doctor status update', {
      doctor_id: doctorId,
      is_online: availabilityData.is_online
    });

    // Get all doctors from state
    const doctors = (await state.get('doctors')) || [];
    const doctorIndex = doctors.findIndex((d: any) => d.doctor_id === doctorId);

    if (doctorIndex === -1) {
      logger.warn('Doctor not found', { doctor_id: doctorId });
      return {
        status: 400,
        body: { error: 'Doctor not found' }
      };
    }

    // Update doctor availability
    const now = new Date().toISOString();
    doctors[doctorIndex].availability = {
      is_online: availabilityData.is_online,
      time_slots: availabilityData.time_slots || [],
      last_online: now
    };

    // Store updated doctors list
    await state.set('doctors', doctors, { ttl: 86400 * 365 });

    // Store in Redis-like cache for real-time tracking (using state with short TTL)
    if (availabilityData.is_online) {
      await state.set(`doctor-session-${doctorId}`, {
        doctor_id: doctorId,
        online_since: now,
        last_heartbeat: now
      }, { ttl: 300 }); // 5 minute TTL
    } else {
      // Remove from active sessions
      await state.set(`doctor-session-${doctorId}`, null, { ttl: 1 });
    }

    // Emit event for status change
    await emit({
      topic: 'doctor-status-changed',
      data: {
        doctor_id: doctorId,
        is_online: availabilityData.is_online,
        timestamp: now,
        time_slots: availabilityData.time_slots
      }
    });

    logger.info('Doctor status updated successfully', {
      doctor_id: doctorId,
      is_online: availabilityData.is_online
    });

    return {
      status: 200,
      body: {
        message: `Doctor is now ${availabilityData.is_online ? 'online' : 'offline'}`,
        doctor_id: doctorId,
        is_online: availabilityData.is_online,
        last_online: now
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Availability update validation failed', { errors: error.errors });
      return {
        status: 400,
        body: { error: 'Validation failed' }
      };
    }

    logger.error('Availability update failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      status: 500,
      body: { error: 'Update failed' }
    };
  }
};
