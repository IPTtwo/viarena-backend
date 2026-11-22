import { z } from "zod";

export const profileSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    bio: z.string().max(1000).optional(),
    avatar: z.string().max(2000).optional(),
  })
  .strict();
