import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

const clinicRegistrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Full name is required'),
  clinic_name: z.string().min(1, 'Clinic name is required'),
  clinic_address: z.string().min(1, 'Clinic address is required'),
  phone: z.string().min(10, 'Valid phone number required'),
  license_number: z.string().min(1, 'License number is required'),
  // Optional extended fields
  location: z.object({
    address: z.string().optional(),
    lat: z.string().optional(),
    lon: z.string().optional()
  }).optional(),
  doctor: z.object({
    name: z.string().optional(),
    specialization: z.string().optional(),
    experience: z.string().optional(),
    availability_hours: z.string().optional()
  }).optional(),
  has_nurses: z.boolean().optional(),
  has_medicine_shop: z.boolean().optional(),
  accepts_emergencies: z.boolean().optional(),
  fees: z.string().optional()
});

export const config: ApiRouteConfig = {
  name: 'ClinicRegister',
  type: 'api',
  path: '/auth/register-clinic',
  method: 'POST',
  description: 'Register a new clinic administrator',
  emits: ['clinic-registered'],
  flows: ['authentication'],
  bodySchema: clinicRegistrationSchema,
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

export const handler: Handlers['ClinicRegister'] = async (req, { emit, logger, state }) => {
  try {
    // Validate request
    const clinicData = clinicRegistrationSchema.parse(req.body);

    logger.info('Clinic registration attempt', {
      email: clinicData.email,
      clinic_name: clinicData.clinic_name
    });

    // Check if email already exists
    const existingUsers = (await state.get('users')) || [];
    if (existingUsers.some((u: any) => u.email === clinicData.email)) {
      logger.warn('Registration failed - email already exists', { email: clinicData.email });
      return {
        status: 400,
        body: { error: 'Email already registered' }
      };
    }

    // Create clinic admin user document
    const adminId = crypto.randomUUID();
    const facilityId = crypto.randomUUID();
    const now = new Date().toISOString();

    const userDoc = {
      user_id: adminId,
      email: clinicData.email,
      password: 'hashed_password_here', // TODO: Hash password
      full_name: clinicData.full_name,
      role: 'clinic_admin',
      facility_id: facilityId,
      created_at: now
    };

    // Create clinic facility document
    const clinicDoc = {
      facility_id: facilityId,
      facility_type: 'clinic',
      clinic_name: clinicData.clinic_name,
      clinic_address: clinicData.clinic_address,
      phone: clinicData.phone,
      license_number: clinicData.license_number,
      admin_id: adminId,
      admin_email: clinicData.email,
      admin_name: clinicData.full_name,
      location: clinicData.location || { address: clinicData.clinic_address, lat: '', lon: '' },
      doctor: clinicData.doctor || null,
      has_nurses: clinicData.has_nurses || false,
      has_medicine_shop: clinicData.has_medicine_shop || false,
      accepts_emergencies: clinicData.accepts_emergencies || false,
      fees: clinicData.fees || '',
      doctors: [],
      created_at: now
    };

    // Store user and clinic
    existingUsers.push(userDoc);
    await state.set('users', existingUsers, { ttl: 86400 * 365 });

    const clinics = (await state.get('clinics')) || [];
    clinics.push(clinicDoc);
    await state.set('clinics', clinics, { ttl: 86400 * 365 });

    // Create JWT token
    const token = 'jwt_token_here'; // TODO: Generate actual JWT

    // Emit event for post-registration tasks
    await emit({
      topic: 'clinic-registered',
      data: {
        facility_id: facilityId,
        admin_id: adminId,
        email: clinicData.email,
        full_name: clinicData.full_name,
        clinic_name: clinicData.clinic_name,
        created_at: now
      }
    });

    logger.info('Clinic registered successfully', {
      facility_id: facilityId,
      admin_id: adminId,
      clinic_name: clinicData.clinic_name
    });

    return {
      status: 201,
      body: {
        access_token: token,
        token_type: 'bearer',
        facility_id: facilityId,
        user: {
          email: clinicData.email,
          full_name: clinicData.full_name,
          role: 'clinic_admin',
          created_at: now
        }
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Clinic registration validation failed', { errors: error.errors });
      return {
        status: 400,
        body: { error: 'Validation failed' }
      };
    }

    logger.error('Clinic registration failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      status: 500,
      body: { error: 'Registration failed' }
    };
  }
};
