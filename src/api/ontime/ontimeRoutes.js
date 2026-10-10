const express = require('express');
const router = express.Router();
const controller = require('./ontimeController');
const validation = require('./ontimeValidation');
const { validate } = require('../middleware/validator');
const { authenticateRider } = require('../middleware/authMiddleware');

// OnTime Rider login with validation (unprotected)
router.post('/rider/send-otp', controller.riderSendOtp);
router.post('/send-otp', controller.riderSendOtp);
router.post('/rider/verify-otp', validate([validation.validateRiderLogin]), controller.riderVerifyOtp);
router.post('/verify-otp', validate([validation.validateRiderLogin]), controller.riderVerifyOtp);

router.use(authenticateRider);

// Rider assigned orders & delivery status updates with validation
router.get('/rider/:riderId/orders', controller.getRiderOrders);
router.get('/:riderId/orders', controller.getRiderOrders);
router.put('/orders/:id/rider-status', validate([validation.validateUpdateRiderStatus]), controller.updateRiderOrderStatus);

module.exports = router;
