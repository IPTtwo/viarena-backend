import { z } from "zod";

export const emailRule = z
  .string()
  .email()
  .transform((value) => value.toLowerCase().trim());
export const passwordRule = z
  .string()
  .min(8)
  .max(128)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/);
export const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: emailRule,
  studentId: z.string().min(3).max(40),
  password: passwordRule,
});
export const loginSchema = z.object({ email: emailRule, password: z.string() });
export const forgotPasswordSchema = z.object({ email: emailRule });
export const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: passwordRule,
});
