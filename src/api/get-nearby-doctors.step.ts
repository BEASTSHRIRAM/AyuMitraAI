import type { ApiRouteConfig, Handlers } from 'motia';
import { z } from 'zod';

const getNearbyDoctorsSchema = z.object({
  specialization: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radius_km: z.number().default(10),
  limit: z.number().int().min(1).max(50).default(10)
});

export const config: ApiRouteConfig = {
  name: 'GetNearbyDoctors',
  type: 'api',
  path: '/doctors/nearby',
  method: 'POST',
  description: 'Get list of nearby online doctors, optionally filtered by specialization',
  emits: [],
  flows: ['patient-discovery'],
  bodySchema: getNearbyDoctorsSchema,
  responseSchema: {
    200: z.object({
      doctors: z.array(z.object({
        doctor_id: z.string(),
        full_name: z.string(),
        specialization: z.string(),
        experience_years: z.number(),
        phone: z.string(),
        is_online: z.boolean(),
        last_online: z.string(),
        rating: z.number(),
        patients_treated: z.number(),
        availability: z.object({
          is_online: z.boolean(),
          time_slots: z.array(z.any())
        })
      })),
      total_count: z.number(),
      filtered_by: z.object({
        specialization: z.string().optional(),
        radius_km: z.number()
      })
    }),
    400: z.object({ error: z.string() }),
    500: z.object({ error: z.string() })
  }
};

export const handler: Handlers['GetNearbyDoctors'] = async (req, { logger, state }) => {
  try {
    // Validate request
    const filterData = getNearbyDoctorsSchema.parse(req.body);

    logger.info('Fetching nearby doctors', {
      specialization: filterData.specialization,
      radius_km: filterData.radius_km
    });

    // Get all doctors from state
    const allDoctors = (await state.get('doctors')) || [];

    // Filter doctors
    let filteredDoctors = allDoctors.filter((doctor: any) => {
      // Filter 1: Must be online
      if (!doctor.availability?.is_online) {
        return false;
      }

      // Filter 2: Check if session is still active (not expired)
      // In production, check Redis for active session
      const lastOnline = new Date(doctor.availability.last_online);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (lastOnline < fiveMinutesAgo) {
        // Session expired, mark as offline
        doctor.availability.is_online = false;
        return false;
      }

      // Filter 3: Match specialization if provided
      if (filterData.specialization) {
        const doctorSpec = doctor.specialization.toLowerCase();
        const filterSpec = filterData.specialization.toLowerCase();
        if (!doctorSpec.includes(filterSpec) && !filterSpec.includes(doctorSpec)) {
          return false;
        }
      }

      // Filter 4: Distance check (if coordinates provided)
      // TODO: Implement geolocation filtering
      // For now, return all matching doctors

      return true;
    });

    // Sort by rating and experience
    filteredDoctors.sort((a: any, b: any) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return b.experience_years - a.experience_years;
    });

    // Limit results
    const resultDoctors = filteredDoctors.slice(0, filterData.limit);

    logger.info('Nearby doctors fetched successfully', {
      total_found: filteredDoctors.length,
      returned: resultDoctors.length
    });

    return {
      status: 200,
      body: {
        doctors: resultDoctors.map((doctor: any) => ({
          doctor_id: doctor.doctor_id,
          full_name: doctor.full_name,
          specialization: doctor.specialization,
          experience_years: doctor.experience_years,
          phone: doctor.phone,
          is_online: doctor.availability.is_online,
          last_online: doctor.availability.last_online,
          rating: doctor.rating || 0,
          patients_treated: doctor.patients_treated || 0,
          availability: doctor.availability
        })),
        total_count: filteredDoctors.length,
        filtered_by: {
          specialization: filterData.specialization,
          radius_km: filterData.radius_km
        }
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Get doctors validation failed', { errors: error.errors });
      return {
        status: 400,
        body: { error: 'Validation failed' }
      };
    }

    logger.error('Failed to fetch nearby doctors', {
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      status: 500,
      body: { error: 'Failed to fetch doctors' }
    };
  }
};
