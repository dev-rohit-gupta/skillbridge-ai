import z from 'zod';

export const env = z.object({
  BACKEND_URL: z.url(),
})
.parse(process.env);