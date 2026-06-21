const crypto = require('crypto');

const sessionStore = new Map();

function parseCookies(header = '') {
  return String(header || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const eqIndex = part.indexOf('=');
      if (eqIndex < 0) return acc;
      const key = part.slice(0, eqIndex).trim();
      const value = part.slice(eqIndex + 1).trim();
      if (key) acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  const sameSite = options.sameSite;
  if (sameSite) parts.push(`SameSite=${String(sameSite).charAt(0).toUpperCase()}${String(sameSite).slice(1)}`);
  if (options.secure === true) parts.push('Secure');
  if (Number.isFinite(Number(options.maxAge)) && Number(options.maxAge) <= 0) parts.push('Max-Age=0');
  return parts.join('; ');
}

function cloneSession(value = {}) {
  return JSON.parse(JSON.stringify(value || {}));
}

module.exports = function sessionFallback(options = {}) {
  const name = String(options.name || 'sid').trim() || 'sid';
  const cookieOptions = options.cookie || {};

  return (req, res, next) => {
    const cookies = parseCookies(req.headers?.cookie || '');
    const sid = String(cookies[name] || '').trim();
    let isNewSession = false;
    let sessionData = sid && sessionStore.has(sid) ? cloneSession(sessionStore.get(sid)) : null;

    if (!sessionData) {
      isNewSession = true;
      sessionData = {};
    }

    sessionData.id = sid || crypto.randomUUID();
    sessionData.destroy = (callback) => {
      sessionStore.delete(sessionData.id);
      res.setHeader('Set-Cookie', serializeCookie(name, '', { ...cookieOptions, path: '/', maxAge: 0 }));
      if (typeof callback === 'function') callback();
    };
    sessionData.regenerate = (callback) => {
      const nextId = crypto.randomUUID();
      sessionStore.delete(sessionData.id);
      sessionData.id = nextId;
      if (typeof callback === 'function') callback();
    };
    sessionData.save = (callback) => {
      sessionStore.set(sessionData.id, cloneSession(sessionData));
      if (typeof callback === 'function') callback();
    };

    req.sessionID = sessionData.id;
    req.session = sessionData;

    const persistSession = () => {
      const serializable = cloneSession(sessionData);
      delete serializable.destroy;
      delete serializable.regenerate;
      delete serializable.save;
      if (Object.keys(serializable).length === 0 && options.saveUninitialized === false && isNewSession) {
        return;
      }
      sessionStore.set(sessionData.id, serializable);
      res.setHeader('Set-Cookie', serializeCookie(name, sessionData.id, cookieOptions));
    };

    const originalEnd = res.end;
    res.end = function patchedEnd(...args) {
      try {
        persistSession();
      } catch {
        // Ignore persistence errors in the fallback store.
      }
      return originalEnd.apply(this, args);
    };

    next();
  };
};
