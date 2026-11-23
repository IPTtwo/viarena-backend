import { asyncHandler, fail } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "../validators/auth.js";
import {
  authenticate,
  createParticipant,
  issuePasswordReset,
  removeSession,
  resetPassword,
} from "../services/auth.js";

const cookieName = () => process.env.COOKIE_NAME || "viarena_session";
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});

export const signup = asyncHandler(async (req, res) => {
  const body = signupSchema.parse(req.body);
  const domain = process.env.SCHOOL_EMAIL_DOMAIN || "adnu.edu.ph";
  if (!body.email.endsWith(`@${domain}`))
    throw fail(400, "School email required");
  res.status(201).json({ user: await createParticipant(body) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const { user, rawToken, days } = await authenticate(email, password);
  res.cookie(cookieName(), rawToken, {
    ...cookieOptions(),
    maxAge: days * 86400000,
  });
  res.json({ user: user.toJSON() });
});

export const logout = asyncHandler(async (req, res) => {
  await removeSession(req.cookies?.[cookieName()]);
  res.clearCookie(cookieName(), cookieOptions());
  res.json({ message: "Logged out" });
});

export const me = [requireAuth, (req, res) => res.json({ user: req.user })];

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  const token = await issuePasswordReset(email);
  if (token && process.env.NODE_ENV !== "production")
    console.log(
      "DEV RESET LINK:",
      `${process.env.RESET_BASE_URL || "http://localhost:5173/reset-password"}?token=${token}`,
    );
  res.json({
    message: "If the account exists, recovery instructions will be sent.",
  });
});

export const reset = asyncHandler(async (req, res) => {
  const { token, password } = resetPasswordSchema.parse(req.body);
  await resetPassword(token, password);
  res.json({ message: "Password updated" });
});
