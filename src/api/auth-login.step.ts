import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

export const config: ApiRouteConfig = {
  name: 'AuthLogin',
  type: 'api',
  path: '/auth/login',
  method: 'POST',
  description: 'User login with email and password',
  emits: [],
  flows: ['authentication'],
  bodySchema: loginSchema,
  responseSchema: {
    200: z.object({
      access_token: z.string(),
      token_type: z.string(),
      user: z.object({
        user_id: z.string(),
        email: z.string(),
        full_name: z.string(),
        role: z.string(),
        created_at: z.string()
      })
    }),
    400: z.object({ error: z.string() }),
    401: z.object({ error: z.string() }),
    500: z.object({ error: z.string() })
  }
};

export const handler: Handlers['AuthLogin'] = async (req, { logger, state }) => {
  try {
    // Validate request
    const credentials = loginSchema.parse(req.body);

    logger.info('Login attempt', { email: credentials.email });

    // Get users from state
    const users = (await state.get('users')) || [];
    const user = users.find((u: any) => u.email === credentials.email);

    if (!user) {
      logger.warn('Login failed - user not found', { email: credentials.email });
      return {
        status: 401,
        body: { error: 'Invalid email or password' }
      };
    }

    // TODO: Verify password hash
    // For now, accept any password (development only)
    // In production, use bcrypt to verify hashed password

    // Create JWT token
    const token = 'jwt_token_here'; // TODO: Generate actual JWT

    logger.info('User logged in successfully', { user_id: user.user_id, email: credentials.email });

    return {
      status: 200,
      body: {
        access_token: token,
        token_type: 'bearer',
        user: {
          user_id: user.user_id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          created_at: user.created_at
        }
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Login validation failed', { errors: error.errors });
      return {
        status: 400,
        body: { error: 'Validation failed' }
      };
    }

    logger.error('Login failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      status: 500,
      body: { error: 'Login failed' }
    };
  }
};
