const express = require('express');
const router = express.Router();
const controller = require('./websiteController');
const validation = require('./websiteValidation');
const { validate } = require('../middleware/validator');
const { authenticateCustomer } = require('../middleware/authMiddleware');

// 1. Customer Auth OTP routes (unprotected)
router.post('/customer/send-otp', validate([validation.validateSendOtp]), controller.customerSendOtp);
router.post('/send-otp', validate([validation.validateSendOtp]), controller.customerSendOtp);
router.post('/customer/verify-otp', validate([validation.validateVerifyOtp]), controller.customerVerifyOtp);
router.post('/verify-otp', validate([validation.validateVerifyOtp]), controller.customerVerifyOtp);

// 2. Public Products & Inventory storefront catalog routes (unprotected)
router.get('/products', controller.getAllProducts);
router.get('/products/:id', controller.getProductById);
router.get('/inventory', controller.getAllProducts);
router.get('/getInventory', controller.getAllProducts);

// 3. Contact Us message submission (unprotected)
router.post('/contact', controller.saveContactMessage);

// 4. Authenticated Customer Scope
// Customer Profile routes with validation
router.post('/customer/profile', authenticateCustomer, validate([validation.validateUpdateProfile]), controller.updateCustomerProfile);
router.get('/customer/profile/:idOrMobile', authenticateCustomer, controller.getCustomerProfile);

// Promo code validation (server-side — codes are never sent to the client)
router.post('/promo/validate', authenticateCustomer, controller.validatePromo);

// Checkout & Orders routes with validation
router.post('/checkout', authenticateCustomer, validate([validation.validateCheckout]), controller.checkout);
router.get('/orders', authenticateCustomer, controller.getOrders);
router.get('/getOrders', authenticateCustomer, controller.getOrders);
router.put('/orders/:id/cancel', authenticateCustomer, controller.cancelOrder);
router.put('/customer/orders/:id/cancel', authenticateCustomer, controller.cancelOrder);

module.exports = router;
