const { z } = require('zod');

const trainSearchSchema = z.object({
  query: z.object({
    from: z.string()
      .min(3)
      .max(4)
      .regex(/^[A-Z]+$/, 'Station code must be 3-4 uppercase letters'),
    to: z.string()
      .min(3)
      .max(4)
      .regex(/^[A-Z]+$/, 'Station code must be 3-4 uppercase letters'),
    date: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  })
});

const liveTrainSchema = z.object({
  params: z.object({
    trainNumber: z.string()
      .regex(/^\d{5}$/, 'Train number must be exactly 5 digits')
  })
});

module.exports = {
  trainSearchSchema,
  liveTrainSchema
};
