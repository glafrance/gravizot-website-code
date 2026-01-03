// server/src/routes/auth.routes.js
const express = require('express');
const router = express.Router();

// Import without destructuring so it works for both "module.exports = { ... }" and "module.exports = fn"
const auth = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

// Tiny guard to fail fast with clear errors if a handler isn't a function
function mustBeFn(obj, name) {
  if (!obj || typeof obj[name] !== 'function') {
    throw new Error(`Controller or middleware '${name}' is not a function`);
  }
}

// Public: CSRF planter (always 200; cookie is set by ensureCsrfCookie middleware)
router.get('/csrf', (req, res) => res.json({ ok: true }));

// Validate required handlers exist
mustBeFn(auth, 'requireAuth');
mustBeFn(ctrl, 'signup');
mustBeFn(ctrl, 'login');
mustBeFn(ctrl, 'logout');
mustBeFn(ctrl, 'refresh');
mustBeFn(ctrl, 'me');

// Auth flow
router.post('/signup', ctrl.signup);
router.post('/login', ctrl.login);
router.post('/logout', ctrl.logout);
router.post('/refresh', ctrl.refresh);

// Protected 'me' (401 when logged out)
router.get('/me', auth.requireAuth, ctrl.me);

module.exports = router;
