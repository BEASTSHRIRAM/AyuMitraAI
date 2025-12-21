import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

const hospitalRegistrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Full name is required'),
  hospital_name: z.string().min(1, 'Hospital name is required'),
  hospital_address: z.string().min(1, 'Hospital address is required'),
  phone: z.string().min(10, 'Valid phone number required'),
  license_number: z.string().min(1, 'License number is required'),
  bed_count: z.number().int().min(1, 'Bed count must be at least 1')
});

export const config: ApiRouteConfig = {
  name: 'HospitalRegister',
  type: 'api',
  path: '/auth/register-hospital',
  method: 'POST',
  description: 'Register a new hospital administrator',
  emits: ['hospital-registered'],
  flows: ['authentication'],
  bodySchema: hospitalRegistrationSchema,
  responseSchema: {
    201: z.object({
      access_token: z.string(),
      token_type: z.string(),
      facility_id: z.string(),
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

export const handler: Handlers['HospitalRegister'] = async (req, { emit, logger, state }) => {
  try {
    // Validate request
    const hospitalData = hospitalRegistrationSchema.parse(req.body);

    logger.info('Hospital registration attempt', {
      email: hospitalData.email,
      hospital_name: hospitalData.hospital_name
    });

    // Check if email already exists
    const existingUsers = (await state.get('users')) || [];
    if (existingUsers.some((u: any) => u.email === hospitalData.email)) {
      logger.warn('Registration failed - email already exists', { email: hospitalData.email });
      return {
        status: 400,
        body: { error: 'Email already registered' }
      };
    }

    // Create hospital admin user document
    const adminId = crypto.randomUUID();
    const facilityId = crypto.randomUUID();
    const now = new Date().toISOString();

    const userDoc = {
      user_id: adminId,
      email: hospitalData.email,
      password: 'hashed_password_here', // TODO: Hash password
      full_name: hospitalData.full_name,
      role: 'hospital_admin',
      facility_id: facilityId,
      created_at: now
    };

    // Create hospital facility document
    const hospitalDoc = {
      facility_id: facilityId,
      facility_type: 'hospital',
      hospital_name: hospitalData.hospital_name,
      hospital_address: hospitalData.hospital_address,
      phone: hospitalData.phone,
      license_number: hospitalData.license_number,
      bed_count: hospitalData.bed_count,
      admin_id: adminId,
      admin_email: hospitalData.email,
      admin_name: hospitalData.full_name,
      departments: [],
      doctors: [],
      created_at: now
    };

    // Store user and hospital
    existingUsers.push(userDoc);
    await state.set('users', existingUsers, { ttl: 86400 * 365 });

    const hospitals = (await state.get('hospitals')) || [];
    hospitals.push(hospitalDoc);
    await state.set('hospitals', hospitals, { ttl: 86400 * 365 });

    // Create JWT token
    const token = 'jwt_token_here'; // TODO: Generate actual JWT

    // Emit event for post-registration tasks
    await emit({
      topic: 'hospital-registered',
      data: {
        facility_id: facilityId,
        admin_id: adminId,
        email: hospitalData.email,
        full_name: hospitalData.full_name,
        hospital_name: hospitalData.hospital_name,
        created_at: now
      }
    });

    logger.info('Hospital registered successfully', {
      facility_id: facilityId,
      admin_id: adminId,
      hospital_name: hospitalData.hospital_name
    });

    return {
      status: 201,
      body: {
        access_token: token,
        token_type: 'bearer',
        facility_id: facilityId,
        user: {
          email: hospitalData.email,
          full_name: hospitalData.full_name,
          role: 'hospital_admin',
          created_at: now
        }
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Hospital registration validation failed', { errors: error.errors });
      return {
        status: 400,
        body: { error: 'Validation failed' }
      };
    }

    logger.error('Hospital registration failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      status: 500,
      body: { error: 'Registration failed' }
    };
  }
};
