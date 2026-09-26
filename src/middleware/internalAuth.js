// Guards internal endpoints (e.g. the call-ingestion route hit by the worker).
// If INTERNAL_API_TOKEN is unset, the guard is a no-op (handy for local dev).
const TOKEN = process.env.INTERNAL_API_TOKEN || '';

export function requireInternalToken(req, res, next) {
  if (!TOKEN) return next();
  const header = req.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : req.get('x-internal-token');
  if (provided && provided === TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
}
