import { z } from "zod";

export const profileSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    studentId: z.string().trim().min(1).max(100).optional(),
    bio: z.string().max(1000).optional(),
    avatar: z.string().max(1500000).optional(),
  })
  .strict();
