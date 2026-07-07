const { z } = require('zod');

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member'], { errorMap: () => ({ message: 'Role must be admin or member' }) })
});

const acceptInviteSchema = z.object({
  token: z.string(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional()
});

module.exports = {
  inviteSchema,
  acceptInviteSchema
};
