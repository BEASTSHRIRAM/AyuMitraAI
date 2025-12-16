import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

// Define request schema with validation
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Full name is required'),
  role: z.enum(['patient', 'doctor', 'clinic_admin', 'hospital_admin']).default('patient')
});

export const config: ApiRouteConfig = {
  name: 'AuthRegister',
  type: 'api',
  path: '/auth/register',
  method: 'POST',
  description: 'Register a new user account',
  emits: ['user-registered'], // Emit event after successful registration
  flows: ['authentication'],
  bodySchema: registerSchema,
  responseSchema: {
    201: z.object({
      access_token: z.string(),
      token_type: z.string(),
      user: z.object({
        email: z.string(),
        full_name: z.string(),
        role: z.string(),
        created_at: z.string()
      })
    }),
    400: z.object({ error: z.string() }),
    500: z.object({ error: z.string() })
  }
};

export const handler: Handlers['AuthRegister'] = async (req, { emit, logger, state }) => {
  try {
    // Validate request body
    const userData = registerSchema.parse(req.body);
    
    logger.info('User registration attempt', { email: userData.email, role: userData.role });

    // TODO: Replace with actual database call
    // For now, we'll use state to simulate storage
    const existingUsers = (await state.get('users')) || [];
    
    if (existingUsers.some((u: any) => u.email === userData.email)) {
      logger.warn('Registration failed - email already exists', { email: userData.email });
      return {
        status: 400,
        body: { error: 'Email already registered' }
      };
    }

    // Create user document
    const userId = crypto.randomUUID();
    const userDoc = {
      user_id: userId,
      email: userData.email,
      password: 'hashed_password_here', // TODO: Hash password
      full_name: userData.full_name,
      role: userData.role,
      created_at: new Date().toISOString()
    };

    // Store user (using state for now, replace with DB)
    existingUsers.push(userDoc);
    await state.set('users', existingUsers, { ttl: 86400 * 365 }); // 1 year TTL

    // Create JWT token
    const token = 'jwt_token_here'; // TODO: Generate actual JWT

    // Emit event for post-registration tasks (email verification, etc.)
    await emit({
      topic: 'user-registered',
      data: {
        user_id: userId,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        created_at: userDoc.created_at
      }
    });

    logger.info('User registered successfully', { user_id: userId, email: userData.email });

    return {
      status: 201,
      body: {
        access_token: token,
        token_type: 'bearer',
        user: {
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
          created_at: userDoc.created_at
        }
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Registration validation failed', { errors: error.errors });
      return {
        status: 400,
        body: { error: 'Validation failed' }
      };
    }

    logger.error('Registration failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      status: 500,
      body: { error: 'Registration failed' }
    };
  }
};
