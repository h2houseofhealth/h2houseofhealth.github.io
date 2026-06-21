let serializeUserHandler = (_user, done) => done(null, null);
let deserializeUserHandler = (_id, done) => done(null, false);

function runWithAsyncHandler(handler, value, done) {
  try {
    handler(value, done);
  } catch (error) {
    done(error);
  }
}

function authenticate(_strategy, options = {}, callback) {
  return (req, res, next) => {
    if (typeof callback === 'function') {
      return callback(null, null, options);
    }
    return next();
  };
}

function initialize() {
  return (req, _res, next) => {
    req.login = req.logIn = (user, done) => {
      req.user = user || null;
      if (req.session) {
        req.session.passport = req.session.passport || {};
        req.session.passport.user = user?.id ?? null;
        if (typeof req.session.save === 'function') {
          req.session.save(() => {});
        }
      }
      if (typeof done === 'function') done();
    };
    req.logout = req.logOut = (done) => {
      req.user = null;
      if (req.session && req.session.passport) {
        delete req.session.passport.user;
      }
      if (typeof done === 'function') done();
    };
    next();
  };
}

function session() {
  return (req, _res, next) => {
    const sessionUserId = req.session?.passport?.user;
    if (sessionUserId == null) return next();
    runWithAsyncHandler(deserializeUserHandler, sessionUserId, (error, user) => {
      if (!error && user) {
        req.user = user;
      }
      next();
    });
  };
}

function serializeUser(handler) {
  if (typeof handler === 'function') serializeUserHandler = handler;
}

function deserializeUser(handler) {
  if (typeof handler === 'function') deserializeUserHandler = handler;
}

function use() {
  return undefined;
}

module.exports = {
  authenticate,
  initialize,
  session,
  serializeUser,
  deserializeUser,
  use,
};
