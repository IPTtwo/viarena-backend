import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import auth from './routes/auth.js';
import users from './routes/users.js';
import events from './routes/events.js';
import registrations from './routes/registrations.js';
import admin from './routes/admin.js';
import workspace from './routes/workspace.js';
export const app = express();
// Set only for a known hosting proxy topology; local requests trust no proxy.
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5)
  throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 5.');
app.set('trust proxy', proxyHops);
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'https:'],
        'frame-src': [
          "'self'",
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
          'https://player.twitch.tv',
        ],
      },
    },
  }),
);
app.use(
  cors({
    origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(','),
    credentials: true,
  }),
);
app.use(express.json({ limit: '3mb' }));
app.use(cookieParser());
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
  auth,
);
app.use('/api/users', users);
app.use('/api/events', events);
app.use('/api', registrations);
app.use('/api/admin', admin);
app.use('/api/workspace', workspace);
const clientDist = fileURLToPath(new URL('../../frontend/client/dist/', import.meta.url));
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) =>
    res.sendFile('index.html', { root: clientDist }),
  );
}
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, _req, res, _next) => {
  if (err instanceof ZodError)
    return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
  if (err.code === 11000) return res.status(409).json({ error: 'Duplicate value' });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid identifier' });
  if (err.code === 112 || err.codeName === 'WriteConflict' || err.name === 'VersionError')
    return res.status(409).json({ error: 'Concurrent update; please retry' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});
