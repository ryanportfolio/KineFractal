import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import sanitizeHtml from 'sanitize-html';
import type { Express, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Only rate-limit dynamic API traffic. A single SPA page load pulls dozens to
  // hundreds of static assets / bundler modules (especially Vite in dev, served
  // through this same Express instance); counting those against the limit trips
  // it on the first load and 429s the whole site. Static delivery is handled by
  // Vite/static middleware and does not need per-IP throttling here.
  skip: (req) => !req.path.startsWith('/api'),
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many API requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Rate limit exceeded for sensitive endpoint' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Alert preferences autosave after each settled edit and currently persist two
// alert kinds per save. Keep the endpoint bounded below the general API ceiling,
// but do not treat ordinary control tuning like a rare account mutation.
export const alertPrefsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 90,
  message: { error: 'Too many alert setting changes, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// /labels (charts.html hand-lines sync): outside /api so the general limiter
// skips it, and drawing fires one small POST per edit — generous but bounded.
export const linesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 240,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const csrfTokens = new Map<string, { token: string; expires: number }>();

function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateSessionId(): string {
  return crypto.randomBytes(16).toString('hex');
}

function cleanExpiredTokens() {
  const now = Date.now();
  const entries = Array.from(csrfTokens.entries());
  for (const [key, value] of entries) {
    if (value.expires < now) {
      csrfTokens.delete(key);
    }
  }
}

setInterval(cleanExpiredTokens, 60 * 60 * 1000);

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  
  if (safeMethod) {
    return next();
  }
  
  const tokenFromHeader = req.headers['x-csrf-token'] as string;
  const tokenFromBody = (req.body as any)?.csrfToken;
  const clientToken = tokenFromHeader || tokenFromBody;
  
  const sessionId = req.cookies?.['csrf-session'];
  
  if (!sessionId || !clientToken) {
    return res.status(419).json({ 
      error: 'CSRF session expired or missing', 
      code: 'CSRF_REFRESH_NEEDED',
      message: 'Please retry your request. The security token will be refreshed automatically.'
    });
  }
  
  const stored = csrfTokens.get(sessionId);
  
  if (!stored || stored.expires < Date.now()) {
    csrfTokens.delete(sessionId);
    res.clearCookie('csrf-session');
    return res.status(419).json({ 
      error: 'CSRF token expired',
      code: 'CSRF_REFRESH_NEEDED',
      message: 'Security token expired. Please retry your request.'
    });
  }
  
  if (clientToken !== stored.token) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
}

export function getCSRFToken(req: Request, res: Response) {
  let sessionId = req.cookies?.['csrf-session'];
  
  if (!sessionId) {
    sessionId = generateSessionId();
  }
  
  const token = generateCSRFToken();
  const expires = Date.now() + (60 * 60 * 1000);
  
  csrfTokens.set(sessionId, { token, expires });
  
  res.cookie('csrf-session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000
  });
  
  res.json({ csrfToken: token });
}

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

export function inputSanitizer(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    const sanitizedQuery = sanitizeObject(req.query);
    Object.keys(req.query).forEach(key => delete (req.query as Record<string, any>)[key]);
    Object.assign(req.query, sanitizedQuery);
  }
  next();
}

function sanitizeObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  if (typeof obj === 'string') {
    let decoded = obj;
    try {
      decoded = decodeURIComponent(obj);
    } catch (e) {
    }
    return sanitizeHtml(decoded, sanitizeOptions);
  }
  
  return obj;
}

export function setupSecurity(app: Express) {
  const isDev = process.env.NODE_ENV !== 'production';
  
  app.use(helmet({
    contentSecurityPolicy: isDev ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'", 
          "https://api.tiingo.com", 
          "https://www.alphavantage.co",
          "wss://*.replit.dev"
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xContentTypeOptions: true,
    xFrameOptions: { action: "deny" },
  }));

  app.use(generalLimiter);

  app.use('/api/', apiLimiter);

  app.use(inputSanitizer);

  app.get('/api/csrf-token', getCSRFToken);

  // P2 account surface: tight rate limit + CSRF on the mutating routes.
  // (/api/auth/* is mounted BEFORE this middleware stack in app.ts — Better
  // Auth carries its own CSRF/origin protection and rate limiting.)
  app.use('/api/tos', strictLimiter, csrfProtection);
  app.use('/api/watchlist', strictLimiter, csrfProtection);
  app.use('/api/alerts/prefs', alertPrefsLimiter, csrfProtection);

  // charts.html hand-lines sync. NO csrfProtection: the page sends no token
  // on this call; the POST is a
  // text/plain simple request, the session cookie is SameSite=Lax (cross-site
  // POSTs don't send it), and the payload is the user's own line list
  // (validated + size-capped in fearlab-charts.ts).
  app.use('/labels', linesLimiter);

  // charts.html "+ Add" ticker (site build path). Same no-CSRF posture as
  // /labels (no token; JSON POST preflights cross-site and
  // the session cookie is SameSite=Lax) — but builds are expensive, so the
  // strict limiter applies.
  app.use('/watchlist', strictLimiter);

  // charts.html ticker removal + ordering. Same shared-artifact/SameSite
  // posture; every mutation is account-scoped and rate-limited.
  app.use('/api/chart-symbols', strictLimiter);
  
  console.log('[Security] Security middleware initialized with enhanced protections');
}
