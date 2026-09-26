import { z } from 'zod';

export const onboardSchema = z.object({
  business_name: z.string().min(1, 'business_name is required').max(255),
  contact_name: z.string().max(255).optional(),
  trade_type: z.string().max(100).optional(),
  service_requirements: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return Array.isArray(val) ? val.join(', ') : val;
    }),
  email: z.string().email('valid email is required').max(255),
  phone_number: z.string().min(5, 'phone_number is required').max(50),
  target_area_code: z
    .string()
    .regex(/^0\d{2,5}$/, 'target_area_code must be a UK area code, e.g. 01274'),
  ai_greeting: z.string().max(2000).optional(),
  business_hours: z
    .union([z.string(), z.record(z.any())])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          // allow a plain string like "Mon-Fri 8-6"
          return { text: val };
        }
      }
      return val;
    }),
  emergency_forward_number: z.string().max(50).optional(),
});

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'validation_error',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.validated = result.data;
    next();
  };
}
