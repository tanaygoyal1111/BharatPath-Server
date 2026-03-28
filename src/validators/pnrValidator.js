const { z } = require('zod');

const pnrSchema = z.object({
  params: z.object({
    pnr: z.string()
      .length(10, 'PNR must be exactly 10 digits')
      .regex(/^\d+$/, 'PNR must contain only digits')
  })
});

module.exports = {
  pnrSchema
};
