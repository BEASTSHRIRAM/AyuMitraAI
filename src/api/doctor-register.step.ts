import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

const doctorRegistrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Full name is required'),
  specialization: z.string().min(1, 'Specialization is required'),
  experience_years: z.number().int().min(0, 'Experience years must be non-negative'),
  license_number: z.string().min(1, 'License number is required'),
  phone: z.string().min(10, 'Valid phone number required'),
  facility_id: z.string().min(1, 'Facility ID is required')
});

export const config: ApiRouteConfig = {
  name: 'DoctorRegister',
  type: 'api',
  path: '/auth/register-doctor',
  method: 'POST',
  description: 'Register a new doctor with their facility',
  emits: ['doctor-registered'],
  flows: ['authentication'],
  bodySchema: doctorRegistrationSchema,
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
    404: z.object({ error: z.string() }),
    500: z.object({ error: z.string() })
  }
};

export const handler: Handlers['DoctorRegister'] = async (req, { emit, logger, state }) => {
  try {
    // Validate request
    const doctorData = doctorRegistrationSchema.parse(req.body);

    logger.info('Doctor registration attempt', {
      email: doctorData.email,
      specialization: doctorData.specialization,
      facility_id: doctorData.facility_id
    });

    // Check if email already exists
    const existingUsers = (await state.get('users')) || [];
    if (existingUsers.some((u: any) => u.email === doctorData.email)) {
      logger.warn('Registration failed - email already exists', { email: doctorData.email });
      return {
        status: 400,
        body: { error: 'Email already registered' }
      };
    }

    // TODO: Verify facility exists in database
    // For now, we'll assume it exists
    const facilityId = doctorData.facility_id;

    // Create doctor user document
    const doctorId = crypto.randomUUID();
    const userDoc = {
      user_id: doctorId,
      email: doctorData.email,
      password: 'hashed_password_here', // TODO: Hash password
      full_name: doctorData.full_name,
      role: 'doctor',
      created_at: new Date().toISOString()
    };

    // Create doctor profile
    const doctorProfile = {
      doctor_id: doctorId,
      full_name: doctorData.full_name,
      email: doctorData.email,
      specialization: doctorData.specialization,
      experience_years: doctorData.experience_years,
      license_number: doctorData.license_number,
      phone: doctorData.phone,
      facility_id: facilityId,
      availability: {
        is_online: false,
        time_slots: [],
        last_online: null
      },
      patients_treated: 0,
      rating: 0,
      created_at: new Date().toISOString()
    };

    // Store user and doctor profile
    existingUsers.push(userDoc);
    await state.set('users', existingUsers, { ttl: 86400 * 365 });

    const doctors = (await state.get('doctors')) || [];
    doctors.push(doctorProfile);
    await state.set('doctors', doctors, { ttl: 86400 * 365 });

    // Create JWT token
    const token = 'jwt_token_here'; // TODO: Generate actual JWT

    // Emit event for post-registration tasks
    await emit({
      topic: 'doctor-registered',
      data: {
        doctor_id: doctorId,
        email: doctorData.email,
        full_name: doctorData.full_name,
        specialization: doctorData.specialization,
        facility_id: facilityId,
        created_at: userDoc.created_at
      }
    });

    logger.info('Doctor registered successfully', {
      doctor_id: doctorId,
      email: doctorData.email,
      specialization: doctorData.specialization
    });

    return {
      status: 201,
      body: {
        access_token: token,
        token_type: 'bearer',
        user: {
          email: doctorData.email,
          full_name: doctorData.full_name,
          role: 'doctor',
          created_at: userDoc.created_at
        }
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Doctor registration validation failed', { errors: error.errors });
      return {
        status: 400,
        body: { error: 'Validation failed' }
      };
    }

    logger.error('Doctor registration failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      status: 500,
      body: { error: 'Registration failed' }
    };
  }
};
