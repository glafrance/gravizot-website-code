const express = require('express');
const { postContact, getCsrf } = require('../controllers/contact.controller');

const router = express.Router();

router.get('/csrf', getCsrf);
router.post('/', postContact);

module.exports = router;
