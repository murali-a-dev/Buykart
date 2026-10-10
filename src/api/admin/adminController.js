const { db } = require('../firebase');
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcryptjs');
const { uploadBase64ToCloudinary, deleteFromCloudinary, generateImageVariants, cloudinary } = require('../utils/cloudinary');
const { generateToken } = require('../middleware/authMiddleware');

const SALT_ROUNDS = 10;
const COLLECTION_INVENTORY = 'inventory';
const COLLECTION_USERS = 'users';
const COLLECTION_ORDERS = 'orders';
const COLLECTION_RIDERS = 'riders';
const COLLECTION_PURCHASES = 'purchases';

// Helper to restock items into inventory when order is cancelled or failed
const restockOrderItems = async (orderData) => {
    if (!orderData || !orderData.items) return;
    const itemsList = Object.values(orderData.items);
    for (const item of itemsList) {
        if (item.id && item.quantity) {
            const itemRef = db.collection(COLLECTION_INVENTORY).doc(item.id);
            const itemDoc = await itemRef.get();
            if (itemDoc.exists) {
                const currentStock = Number(itemDoc.data().op_stock || 0);
                await itemRef.update({ op_stock: currentStock + Number(item.quantity) });
            }
        }
    }
};

// --- INVENTORY MANAGEMENT controllers (Direct Cloudinary base64 upload - no multer) ---
exports.addInventory = async (req, res) => {
    try {
        const { category, itemName, unit, price, op_stock, description, imageBase64, image: existingImage } = req.body;
        
        let image = {};
        let imageId = '';

        // Check if an image is provided as Base64 data URI or HTTP URL
        const imagePayload = imageBase64 || (typeof existingImage === 'string' && existingImage.startsWith('data:') ? existingImage : null);

        if (imagePayload) {
            try {
                const result = await uploadBase64ToCloudinary(imagePayload);
                image = generateImageVariants(result.secure_url);
                imageId = result.public_id;
            } catch (uploadErr) {
                console.error('[AddInventory] Cloudinary upload error:', uploadErr);
                return res.status(500).json({ 
                    success: false, 
                    message: `Cloudinary upload failed: ${uploadErr.message || 'Service error'}` 
                });
            }
        } else if (typeof existingImage === 'string' && existingImage.startsWith('http')) {
            image = generateImageVariants(existingImage);
        }

        const newInventory = {
            category,
            itemName,
            unit,
            price: Number(price),
            op_stock: Number(op_stock),
            description: description || '',
            image: image,
            imageId: imageId,
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection(COLLECTION_INVENTORY).add(newInventory);
        res.status(200).json({ success: true, message: 'Inventory item added successfully', id: docRef.id, data: newInventory });
    } catch (error) {
        console.error('[AddInventory] Internal error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateInventory = async (req, res) => {
    try {
        const { id } = req.params;
        const { category, itemName, unit, price, op_stock, description, removeImage, imageBase64, image: existingImage } = req.body;
        const updateData = { category, itemName, unit, description };

        if (price !== undefined) updateData.price = Number(price);
        if (op_stock !== undefined) updateData.op_stock = Number(op_stock);

        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
        updateData.updatedAt = new Date().toISOString();
        
        // Fetch current document to know existing imageId for cleanup if needed
        let existingDocData = null;
        const itemRef = db.collection(COLLECTION_INVENTORY).doc(id);

        const imagePayload = imageBase64 || (typeof existingImage === 'string' && existingImage.startsWith('data:') ? existingImage : null);

        if (imagePayload) {
            try {
                const docSnap = await itemRef.get();
                if (docSnap.exists) {
                    existingDocData = docSnap.data();
                }

                const result = await uploadBase64ToCloudinary(imagePayload);
                updateData.image = generateImageVariants(result.secure_url);
                updateData.imageId = result.public_id;

                // Delete replaced previous image from Cloudinary in background
                if (existingDocData && existingDocData.imageId) {
                    deleteFromCloudinary(existingDocData.imageId);
                }
            } catch (uploadErr) {
                console.error('[UpdateInventory] Cloudinary upload error:', uploadErr);
                return res.status(500).json({ 
                    success: false, 
                    message: `Cloudinary upload failed: ${uploadErr.message || 'Service error'}` 
                });
            }
        } else if (removeImage === 'true' || removeImage === true) {
            try {
                const docSnap = await itemRef.get();
                if (docSnap.exists) {
                    existingDocData = docSnap.data();
                }
                if (existingDocData && existingDocData.imageId) {
                    deleteFromCloudinary(existingDocData.imageId);
                }
            } catch (cleanupErr) {
                console.warn('[UpdateInventory] Cloudinary cleanup notice:', cleanupErr.message);
            }
            updateData.image = {};
            updateData.imageId = '';
        }

        await itemRef.update(updateData);
        res.status(200).json({ success: true, message: 'Inventory item updated successfully' });
    } catch (error) {
        console.error('[UpdateInventory] Internal error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteInventory = async (req, res) => {
    try {
        const { id } = req.params;
        const itemRef = db.collection(COLLECTION_INVENTORY).doc(id);
        const docSnap = await itemRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data && data.imageId) {
                deleteFromCloudinary(data.imageId);
            }
        }
        await itemRef.delete();
        res.status(200).json({ success: true, message: 'Inventory item deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getInventory = async (req, res) => {
    try {
        const snapshot = await db.collection(COLLECTION_INVENTORY).orderBy('createdAt', 'desc').get();
        const inventory = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        res.status(200).json(inventory);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- ORDER FULFILLMENT & STATUS CONTROLLERS ---
exports.getOrders = async (req, res) => {
    try {
        let snapshot;
        try {
            snapshot = await db.collection(COLLECTION_ORDERS).orderBy('createdAt', 'desc').get();
        } catch (orderErr) {
            snapshot = await db.collection(COLLECTION_ORDERS).get();
        }
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, failureReason, packingRemarks, packedItems } = req.body;
        
        const orderRef = db.collection(COLLECTION_ORDERS).doc(id);
        const orderDoc = await orderRef.get();
        
        if (orderDoc.exists) {
            const previousStatus = orderDoc.data().status;
            const isTargetCancelOrFailed = status === 'Cancelled' || status === 'Delivery Failed';
            const wasAlreadyRestocked = previousStatus === 'Cancelled' || previousStatus === 'Delivery Failed';

            if (isTargetCancelOrFailed && !wasAlreadyRestocked) {
                await restockOrderItems(orderDoc.data());
            }
        }

        const updateObj = {
            status,
            updatedAt: new Date().toISOString()
        };
        if (failureReason !== undefined) updateObj.failureReason = failureReason;
        if (packingRemarks !== undefined) updateObj.packingRemarks = packingRemarks;
        if (packedItems !== undefined) updateObj.packedItems = packedItems;

        await orderRef.update(updateObj);
        res.status(200).json({ success: true, message: "Order status updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.packOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { packedItems, packingRemarks } = req.body;
        
        await db.collection(COLLECTION_ORDERS).doc(id).update({
            status: "Packed",
            packedItems: packedItems || [],
            packingRemarks: packingRemarks || '',
            packedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        res.status(200).json({ success: true, message: "Order marked as Packed successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.dispatchOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { riderId, riderName, riderMobile, vehicleDetails, dispatchTime } = req.body;

        await db.collection(COLLECTION_ORDERS).doc(id).update({
            status: "Dispatched",
            assignedRiderId: riderId,
            assignedRiderName: riderName || '',
            assignedRiderMobile: riderMobile || '',
            vehicleDetails: vehicleDetails || '',
            dispatchTime: dispatchTime || new Date().toLocaleTimeString(),
            dispatchedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        res.status(200).json({ success: true, message: "Order dispatched and Rider assigned successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- RIDER MASTER ADMIN CONTROLLERS ---
exports.getRiders = async (req, res) => {
    try {
        const snap = await db.collection(COLLECTION_RIDERS).get();
        const riders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(riders);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addRider = async (req, res) => {
    try {
        const { name, mobile, bikeNumber, rcNumber, licenseNumber, status } = req.body;
        
        const snap = await db.collection(COLLECTION_RIDERS).where('mobile', '==', mobile).get();
        if (!snap.empty) {
            return res.status(400).json({ success: false, message: "A rider with this mobile number already exists" });
        }

        const newRider = {
            name: name.trim(),
            mobile: String(mobile).trim(),
            bikeNumber: bikeNumber || '',
            rcNumber: rcNumber || '',
            licenseNumber: licenseNumber || '',
            status: status || 'Active',
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection(COLLECTION_RIDERS).add(newRider);
        res.status(201).json({ success: true, message: "Rider account created successfully", rider: { id: docRef.id, ...newRider } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateRider = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        data.updatedAt = new Date().toISOString();

        await db.collection(COLLECTION_RIDERS).doc(id).update(data);
        res.status(200).json({ success: true, message: "Rider details updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- STOCK INWARD / PURCHASE ENTRY CONTROLLERS ---
exports.createPurchaseEntry = async (req, res) => {
    try {
        const { vendorName, invoiceNo, date, productId, productName, purchaseRate, quantity, totalCost, remarks } = req.body;
        
        const purchaseRecord = {
            vendorName: vendorName.trim(),
            invoiceNo: invoiceNo || `INV-${Date.now()}`,
            date: date || new Date().toISOString().split('T')[0],
            productId,
            productName: productName || 'Product',
            purchaseRate: Number(purchaseRate || 0),
            quantity: Number(quantity || 0),
            totalCost: Number(totalCost || (Number(purchaseRate || 0) * Number(quantity || 0))),
            remarks: remarks || '',
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection(COLLECTION_PURCHASES).add(purchaseRecord);

        // Update product opening stock (op_stock) in inventory collection
        const itemRef = db.collection(COLLECTION_INVENTORY).doc(productId);
        const itemDoc = await itemRef.get();
        if (itemDoc.exists) {
            const currentStock = Number(itemDoc.data().op_stock || 0);
            const updatedStock = currentStock + Number(quantity);
            await itemRef.update({ op_stock: updatedStock });
        }

        res.status(201).json({ success: true, message: "Stock Inward Purchase recorded & inventory stock updated!", id: docRef.id });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPurchases = async (req, res) => {
    try {
        const snap = await db.collection(COLLECTION_PURCHASES).orderBy('createdAt', 'desc').get();
        const purchases = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(purchases);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- ADMIN STAFF LOGIN & USER MANAGEMENT CONTROLLERS ---
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const trimmedInput = String(username || '').trim();
        const plainPassword = String(password || '');

        if (!trimmedInput || !plainPassword) {
            if (typeof req.incrementLoginAttempts === 'function') req.incrementLoginAttempts();
            return res.status(400).json({ success: false, message: 'Please enter both username and password' });
        }

        const cleanPhone = trimmedInput.replace(/\D/g, '');
        const usersRef = db.collection(COLLECTION_USERS);

        let userDoc = null;
        let userData = null;

        // 1. Check by exact name
        let snapshot = await usersRef.where('name', '==', trimmedInput).get();

        // 2. Check by normalized lowercase name
        if (snapshot.empty) {
            snapshot = await usersRef.where('normalizedName', '==', trimmedInput.toLowerCase()).get();
        }

        // 3. Check by lowercase/uppercase name field
        if (snapshot.empty) {
            snapshot = await usersRef.where('name', '==', trimmedInput.toLowerCase()).get();
        }

        // 4. Check by phone number
        if (snapshot.empty && cleanPhone.length >= 10) {
            snapshot = await usersRef.where('phone', '==', cleanPhone).get();
            if (snapshot.empty) {
                snapshot = await usersRef.where('phone', '==', trimmedInput).get();
            }
        }

        // 5. Scan collection if still empty for case-insensitive match or default admin bootstrap
        if (snapshot.empty) {
            const allUsersSnap = await usersRef.get();
            for (const doc of allUsersSnap.docs) {
                const data = doc.data();
                const dName = String(data.name || '').trim().toLowerCase();
                const dPhone = String(data.phone || '').trim().replace(/\D/g, '');
                if (dName === trimmedInput.toLowerCase() || (cleanPhone.length >= 10 && dPhone === cleanPhone)) {
                    userDoc = doc;
                    userData = data;
                    break;
                }
            }

            // Bootstrap default admin if no admin exists yet
            if (!userDoc) {
                const adminUsers = allUsersSnap.docs.filter(d => (d.data().role || '').toLowerCase() === 'admin');
                if (adminUsers.length === 0 && trimmedInput.toLowerCase() === 'admin' && plainPassword === 'admin123') {
                    const hashedPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
                    const newAdmin = {
                        name: 'Admin',
                        normalizedName: 'admin',
                        phone: '9876543210',
                        role: 'admin',
                        password: hashedPassword,
                        createdAt: new Date().toISOString()
                    };
                    const docRef = await usersRef.add(newAdmin);
                    const token = generateToken({ id: docRef.id, name: 'Admin', role: 'admin' });
                    if (typeof req.clearLoginAttempts === 'function') req.clearLoginAttempts();
                    return res.status(200).json({
                        success: true,
                        message: 'Admin account initialized successfully',
                        token,
                        user: { id: docRef.id, name: 'Admin', phone: '9876543210', role: 'admin' }
                    });
                }

                if (typeof req.incrementLoginAttempts === 'function') req.incrementLoginAttempts();
                return res.status(401).json({ success: false, message: 'Invalid username or password' });
            }
        } else {
            userDoc = snapshot.docs[0];
            userData = userDoc.data();
        }

        if (!userData || !userData.password) {
            if (typeof req.incrementLoginAttempts === 'function') req.incrementLoginAttempts();
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const passwordMatch = await bcrypt.compare(plainPassword, userData.password);
        if (!passwordMatch) {
            if (typeof req.incrementLoginAttempts === 'function') req.incrementLoginAttempts();
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const role = (userData.role || 'admin').toLowerCase();
        if (role !== 'admin') {
            if (typeof req.incrementLoginAttempts === 'function') req.incrementLoginAttempts();
            return res.status(403).json({
                success: false,
                message: 'Access denied: This account does not have administrator privileges.'
            });
        }

        if (typeof req.clearLoginAttempts === 'function') req.clearLoginAttempts();

        const token = generateToken({ id: userDoc.id, name: userData.name, role: 'admin' });

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: { id: userDoc.id, name: userData.name, phone: userData.phone, role: 'admin' }
        });
    } catch (error) {
        console.error('[Admin Login Error]:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addUser = async (req, res) => {
    try {
        const { name, phone, password, role } = req.body || {};
        const trimmedName = String(name || '').trim();
        const trimmedPhone = String(phone || '').trim().replace(/\D/g, '');
        const plainPassword = String(password || '');

        if (!trimmedName || !plainPassword) {
            return res.status(400).json({ success: false, message: 'Username and password are required.' });
        }

        const usersRef = db.collection(COLLECTION_USERS);

        // Check if username already exists (case-insensitive)
        const nameQuery = await usersRef.where('name', '==', trimmedName).get();
        if (!nameQuery.empty) {
            return res.status(409).json({ success: false, message: 'An account with this username already exists.' });
        }

        const normQuery = await usersRef.where('normalizedName', '==', trimmedName.toLowerCase()).get();
        if (!normQuery.empty) {
            return res.status(409).json({ success: false, message: 'An account with this username already exists.' });
        }

        if (trimmedPhone) {
            const phoneQuery = await usersRef.where('phone', '==', trimmedPhone).get();
            if (!phoneQuery.empty) {
                return res.status(409).json({ success: false, message: 'An account with this phone number already exists.' });
            }
        }

        const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
        const newUser = {
            name: trimmedName,
            normalizedName: trimmedName.toLowerCase(),
            phone: trimmedPhone || String(phone || '').trim(),
            role: role || 'admin',
            password: hashedPassword,
            createdAt: new Date().toISOString()
        };

        const docRef = await usersRef.add(newUser);
        res.status(200).json({ success: true, message: 'Admin account created successfully!', id: docRef.id });
    } catch (error) {
        console.error('[AddUser Error]:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const snapshot = await db.collection(COLLECTION_USERS).orderBy('createdAt', 'desc').get();
        const users = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            phone: doc.data().phone,
            role: doc.data().role || 'admin',
            createdAt: doc.data().createdAt
        }));
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
