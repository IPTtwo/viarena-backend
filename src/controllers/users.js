import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";
import { profileSchema } from "../validators/user.js";
import { updateProfile } from "../services/user.js";

export const updateMe = [
  requireAuth,
  asyncHandler(async (req, res) => {
    const updates = profileSchema.parse(req.body);
    res.json({ user: await updateProfile(req.user._id, updates) });
  }),
];
