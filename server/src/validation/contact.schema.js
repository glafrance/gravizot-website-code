const { z } = require('zod');

// Validation rules for incoming contact messages
const contactSchema = z.object({
  topic: z.string().trim().min(15, 'Topic must be 15 - 120 characters').max(120),
  email: z.string().trim().email('Invalid email').max(254),
  message: z.string().trim().min(30, 'Message must be 30 - 1000 characters').max(1000),
});

module.exports = { contactSchema };
