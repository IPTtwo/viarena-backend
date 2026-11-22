export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export const fail = (status, message) =>
  Object.assign(new Error(message), { status });
export function validId(id) {
  return /^[a-f\d]{24}$/i.test(id || "");
}
export function safeUser(u) {
  return u?.toJSON ? u.toJSON() : u;
}
