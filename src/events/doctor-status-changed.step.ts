import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

const doctorStatusChangedSchema = z.object({
  doctor_id: z.string(),
  is_online: z.boolean(),
  timestamp: z.string(),
  time_slots: z.array(z.any()).optional()
});

export const config: EventConfig = {
  name: 'DoctorStatusChanged',
  type: 'event',
  description: 'Handles doctor online/offline status changes',
  subscribes: ['doctor-status-changed'],
  emits: [],
  input: doctorStatusChangedSchema,
  flows: ['doctor-management']
};

export const handler: Handlers['DoctorStatusChanged'] = async (input, { logger, state }) => {
  try {
    const { doctor_id, is_online, timestamp, time_slots } = input;

    logger.info('Doctor status changed', {
      doctor_id,
      is_online,
      timestamp
    });

    // Store status change event for audit trail
    const statusEvents = (await state.get('doctor-status-events')) || [];
    statusEvents.push({
      doctor_id,
      is_online,
      timestamp,
      time_slots: time_slots || []
    });
    await state.set('doctor-status-events', statusEvents, { ttl: 86400 * 30 });

    // TODO: In production, you could:
    // 1. Send push notification to patients following this doctor
    // 2. Update search indices for real-time availability
    // 3. Trigger analytics events
    // 4. Update WebSocket connections for real-time UI updates

    logger.info('Doctor status change processed', {
      doctor_id,
      is_online,
      action: is_online ? 'went_online' : 'went_offline'
    });
  } catch (error) {
    logger.error('Failed to process doctor status change', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};
