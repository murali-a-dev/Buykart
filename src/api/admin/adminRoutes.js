const express = require('express');
const router = express.Router();
const controller = require('./adminController');
const validation = require('./adminValidation');
const { validate } = require('../middleware/validator');
const { authenticateAdmin } = require('../middleware/authMiddleware');

// Admin Staff Login and Registration (unprotected)
router.post('/login', validate([validation.validateAdminLogin]), controller.login);
router.post('/addUser', validate([validation.validateAdminRegistration]), controller.addUser);

router.use(authenticateAdmin);

// Admin Users (protected)
router.get('/getUsers', controller.getUsers);
router.get('/users', controller.getUsers);

// Inventory routes (Direct Cloudinary base64 JSON upload - no multer)
router.get('/getInventory', controller.getInventory);
router.get('/inventory', controller.getInventory);
router.post('/addInventory', validate([validation.validateAddInventory]), controller.addInventory);
router.post('/inventory', validate([validation.validateAddInventory]), controller.addInventory);
router.put('/updateInventory/:id', controller.updateInventory);
router.put('/inventory/:id', controller.updateInventory);
router.delete('/deleteInventory/:id', controller.deleteInventory);
router.delete('/inventory/:id', controller.deleteInventory);

// Orders & Fulfillments routes with validation
router.get('/getOrders', controller.getOrders);
router.get('/orders', controller.getOrders);
router.put('/updateOrderStatus/:id', controller.updateOrderStatus);
router.put('/orders/:id/status', controller.updateOrderStatus);
router.put('/orders/:id/pack', validate([validation.validatePackOrder]), controller.packOrder);
router.put('/orders/:id/dispatch', validate([validation.validateDispatchOrder]), controller.dispatchOrder);

// Rider Master routes with validation
router.get('/riders', controller.getRiders);
router.post('/riders', validate([validation.validateAddRider]), controller.addRider);
router.put('/riders/:id', controller.updateRider);

// Stock Inward / Purchase Entry routes with validation
router.get('/purchases', controller.getPurchases);
router.post('/purchases', validate([validation.validatePurchaseEntry]), controller.createPurchaseEntry);

module.exports = router;
