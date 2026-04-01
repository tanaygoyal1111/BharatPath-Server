const { z } = require('zod');

const amenitiesQuerySchema = z.object({
  query: z.object({
    lat: z.string()
      .regex(/^-?\d+(\.\d+)?$/, 'lat must be a valid number')
      .transform(Number)
      .refine(val => val >= -90 && val <= 90, 'lat must be between -90 and 90'),
    lng: z.string()
      .regex(/^-?\d+(\.\d+)?$/, 'lng must be a valid number')
      .transform(Number)
      .refine(val => val >= -180 && val <= 180, 'lng must be between -180 and 180')
  })
});

module.exports = {
  amenitiesQuerySchema
};
