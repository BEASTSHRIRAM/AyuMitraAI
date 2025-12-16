import type { EventConfig, Handlers } from 'motia';
import { z } from 'zod';

// Define the input schema for this event
const userRegisteredSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  full_name: z.string(),
  role: z.enum(['patient', 'doctor', 'clinic_admin', 'hospital_admin']),
  created_at: z.string()
});

export const config: EventConfig = {
  name: 'UserRegistered',
  type: 'event',
  description: 'Handles post-registration tasks (email verification, welcome email, etc.)',
  subscribes: ['user-registered'], // Listen to this topic
  emits: ['send-welcome-email'], // Can emit to these topics
  input: userRegisteredSchema,
  flows: ['authentication']
};

export const handler: Handlers['UserRegistered'] = async (input, { emit, logger, state }) => {
  try {
    const { user_id, email, full_name, role, created_at } = input;

    logger.info('Processing user registration', { user_id, email, role });

    // Task 1: Send welcome email
    await emit({
      topic: 'send-welcome-email',
      data: {
        user_id,
        email,
        full_name,
        role,
        created_at
      }
    });



    // Task 3: Store registration event in state for analytics
    const registrationEvents = (await state.get('registration-events')) || [];
    registrationEvents.push({
      user_id,
      email,
      role,
      timestamp: new Date().toISOString()
    });
    await state.set('registration-events', registrationEvents, { ttl: 86400 * 30 }); // 30 days

    logger.info('User registration processed successfully', { user_id, email });
  } catch (error) {
    logger.error('Failed to process user registration', {
      error: error instanceof Error ? error.message : String(error)
    });
    // In Motia, failed events are automatically retried
    throw error;
  }
};
