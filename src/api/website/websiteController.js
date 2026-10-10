const { db } = require('../firebase');
const { generateToken } = require('../middleware/authMiddleware');
const { cleanPhone } = require('../middleware/validator');

const COLLECTION_INVENTORY = 'inventory';
const COLLECTION_CUSTOMERS = 'customers';
const COLLECTION_ORDERS    = 'orders';

// ── Helper: restock items when an order is cancelled ──────────────
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

// ── Server-side promo code definitions ───────────────────────────
// Moving validation here means codes are NEVER visible in the client bundle.
const PROMO_CODES = {
    FRESH10: {
        type: 'percent',
        value: 10,
        minOrder: 0,
        description: '10% Off on Fresh Groceries',
    },
    BUYKART50: {
        type: 'flat',
        value: 50,
        minOrder: 200,
        description: '₹50 Flat Welcome Savings',
    },
};

// 1. Get All Products for Storefront
exports.getAllProducts = async (req, res) => {
    try {
        const snapshot = await db.collection(COLLECTION_INVENTORY).get();
        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Get Single Product By ID
exports.getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await db.collection(COLLECTION_INVENTORY).doc(id).get();
        if (!doc.exists) return res.status(404).json({ success: false, message: 'Product not found' });
        res.status(200).json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Send Customer OTP
// Hardcoded temporary code is 1234. Never exposed to client-side.
exports.customerSendOtp = async (req, res) => {
    try {
        const { mobile } = req.body;
        const cleanMobile = cleanPhone(mobile);
        if (!cleanMobile || cleanMobile.length < 10) {
            return res.status(400).json({ success: false, message: 'Invalid mobile number.' });
        }

        // Temporary hardcoded 4-digit code
        const otp = '1234';

        // Store in Firestore with 10-minute expiry
        await db.collection('otps').doc(cleanMobile).set({
            otp,
            expiresAt: Date.now() + 10 * 60 * 1000,
            attempts: 0,
        });

        console.log(`[DEV ONLY] Code for ${cleanMobile}: ${otp}`);

        // Never send code to client side
        res.status(200).json({ success: true, message: 'Code sent successfully to your mobile number.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. Verify Customer OTP
// Hardcoded temporary code is 1234.
exports.customerVerifyOtp = async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        const cleanMobile = cleanPhone(mobile);
        if (!cleanMobile || cleanMobile.length < 10) {
            return res.status(400).json({ success: false, message: 'Invalid mobile number.' });
        }

        const inputOtp = String(otp || '').trim();

        // Verify code is 1234
        if (inputOtp !== '1234') {
            return res.status(400).json({ success: false, message: 'Invalid code. Please check and try again.' });
        }

        // Clean up stored OTP record if exists
        try {
            await db.collection('otps').doc(cleanMobile).delete();
        } catch (cleanupErr) {
            // Ignore error
        }

        // Find or create customer record
        const snapshot = await db.collection(COLLECTION_CUSTOMERS).where('mobile', '==', cleanMobile).get();
        let customerDoc, customerData, isNew = false;

        if (snapshot.empty) {
            isNew = true;
            customerData = {
                did: '',
                name: '',
                mobile: cleanMobile,
                email: '',
                address: [],
                addresses: [],
                createdAt: new Date().toISOString()
            };
            const docRef = await db.collection(COLLECTION_CUSTOMERS).add(customerData);
            await docRef.update({ did: docRef.id });
            customerData.did = docRef.id;
            customerDoc = { id: docRef.id, data: () => customerData };
        } else {
            customerDoc = snapshot.docs[0];
            customerData = customerDoc.data();
            if (!customerData.did) {
                customerData.did = customerDoc.id;
                await db.collection(COLLECTION_CUSTOMERS).doc(customerDoc.id).update({ did: customerDoc.id }).catch(() => {});
            }
            if (customerData.address && !Array.isArray(customerData.address) && typeof customerData.address === 'object') {
                customerData.address = [customerData.address];
            } else if (!customerData.address) {
                customerData.address = Array.isArray(customerData.addresses) ? customerData.addresses : [];
            }
            isNew = !customerData.name || customerData.name.trim() === '';
        }

        const token = generateToken({ id: customerDoc.id, did: customerDoc.id, mobile: cleanMobile, role: 'customer' });

        res.status(200).json({
            success: true,
            message: isNew ? 'Code verified. Please complete your profile.' : 'Login successful.',
            isNew,
            token,
            customer: { id: customerDoc.id, did: customerDoc.id, ...customerData },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. Update/Save Customer Profile
// Structure: { did, name, mobile, email, address: [{ location, mapUrl, landmark, pincode }] }
exports.updateCustomerProfile = async (req, res) => {
    try {
        const { id, did, name, mobile, email, address, addresses } = req.body;

        // Prevent changing the verified mobile number
        const authenticatedMobile = req.customer?.mobile;
        const requestedMobile = cleanPhone(mobile);
        if (authenticatedMobile && requestedMobile && authenticatedMobile !== requestedMobile) {
            return res.status(403).json({ success: false, message: 'Mobile number cannot be changed without re-verification.' });
        }

        let docId = did || id;
        if (!docId) {
            const snap = await db.collection(COLLECTION_CUSTOMERS).where('mobile', '==', requestedMobile).get();
            if (!snap.empty) docId = snap.docs[0].id;
        }

        // Validate email format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
        }

        // Format address entry: { location, mapUrl, landmark, pincode }
        const formatAddressItem = (item) => {
            if (!item) return null;
            if (typeof item === 'string') {
                return {
                    location: item.trim(),
                    mapUrl: '',
                    landmark: '',
                    pincode: ''
                };
            }
            return {
                location: String(item.location || item.text || item.street || '').trim(),
                mapUrl: String(item.mapUrl || item.maplink || item.mapLink || '').trim(),
                landmark: String(item.landmark || '').trim(),
                pincode: String(item.pincode || item.Pincode || '').trim()
            };
        };

        let addressList = [];
        if (Array.isArray(address)) {
            addressList = address.map(formatAddressItem).filter(a => a && (a.location || a.mapUrl || a.landmark || a.pincode));
        } else if (address && typeof address === 'object') {
            const single = formatAddressItem(address);
            if (single && (single.location || single.mapUrl || single.landmark || single.pincode)) {
                addressList.push(single);
            }
        }

        if (Array.isArray(addresses) && addresses.length > 0) {
            addresses.forEach((a) => {
                const item = formatAddressItem(a);
                if (item && (item.location || item.mapUrl || item.landmark || item.pincode)) {
                    if (!addressList.some((existing) => existing.location === item.location)) {
                        addressList.push(item);
                    }
                }
            });
        }

        const customerPayload = {
            did: docId || '',
            name: name.trim(),
            mobile: requestedMobile,
            email: email ? email.trim() : '',
            address: addressList,
            addresses: addressList,
            updatedAt: new Date().toISOString(),
        };

        let savedId = docId;
        if (docId) {
            customerPayload.did = docId;
            await db.collection(COLLECTION_CUSTOMERS).doc(docId).update(customerPayload);
        } else {
            customerPayload.createdAt = new Date().toISOString();
            const docRef = await db.collection(COLLECTION_CUSTOMERS).add(customerPayload);
            savedId = docRef.id;
            customerPayload.did = savedId;
            await docRef.update({ did: savedId });
        }

        const token = generateToken({ id: savedId, did: savedId, mobile: customerPayload.mobile, role: 'customer' });
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully.',
            token,
            customer: { id: savedId, did: savedId, ...customerPayload }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 6. Get Customer Profile
exports.getCustomerProfile = async (req, res) => {
    try {
        const { idOrMobile } = req.params;
        let doc = await db.collection(COLLECTION_CUSTOMERS).doc(idOrMobile).get();
        if (doc.exists) {
            const data = doc.data();
            data.did = data.did || doc.id;
            return res.status(200).json({ id: doc.id, did: doc.id, ...data });
        }
        const snap = await db.collection(COLLECTION_CUSTOMERS).where('mobile', '==', idOrMobile).get();
        if (!snap.empty) {
            const d = snap.docs[0];
            const data = d.data();
            data.did = data.did || d.id;
            return res.status(200).json({ id: d.id, did: d.id, ...data });
        }
        res.status(404).json({ success: false, message: 'Customer profile not found.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 7. Validate Promo Code (Server-side — codes are never sent to the browser)
exports.validatePromo = async (req, res) => {
    try {
        const { code, cartTotal } = req.body;
        const cleanCode = String(code || '').trim().toUpperCase();
        const total = Number(cartTotal) || 0;

        const promo = PROMO_CODES[cleanCode];
        if (!promo) {
            return res.status(400).json({ success: false, message: 'Invalid promo code.' });
        }

        if (total < promo.minOrder) {
            return res.status(400).json({
                success: false,
                message: `Promo code "${cleanCode}" requires a minimum order of ₹${promo.minOrder}.`,
            });
        }

        const discountAmount = promo.type === 'percent'
            ? Math.round(total * promo.value / 100)
            : promo.value;

        res.status(200).json({
            success: true,
            code: cleanCode,
            discount: discountAmount,
            description: promo.description,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 8. Customer Checkout (Atomic Stock Transaction)
exports.checkout = async (req, res) => {
    try {
        const { cart, userId, userName, customerId, customerName, customerMobile, shippingDetails } = req.body;
        const itemsList = Object.values(cart || {});
        if (!itemsList.length) return res.status(400).json({ success: false, message: 'Cart is empty.' });

        // Atomic stock check + decrement
        await db.runTransaction(async (transaction) => {
            const updates = [];
            for (const item of itemsList) {
                if (item.id) {
                    const itemRef = db.collection(COLLECTION_INVENTORY).doc(item.id);
                    const itemDoc = await transaction.get(itemRef);
                    if (!itemDoc.exists) throw new Error(`Item "${item.itemName}" no longer exists.`);
                    const currentStock = Number(itemDoc.data().op_stock || 0);
                    if (currentStock < item.quantity) {
                        throw new Error(`Insufficient stock for "${item.itemName}". Available: ${currentStock}, Requested: ${item.quantity}`);
                    }
                    updates.push({ ref: itemRef, newStock: currentStock - item.quantity });
                }
            }
            for (const u of updates) transaction.update(u.ref, { op_stock: u.newStock });
        });

        const totalCalc = itemsList.reduce((sum, i) => sum + Number(i.price || 0) * (i.quantity || 1), 0);
        const discountAmount = Number(shippingDetails?.discount || 0);
        const finalTotal = Math.max(0, totalCalc - discountAmount);

        // Normalize structured address: { location, mapUrl, landmark, pincode }
        const rawAddr = shippingDetails?.address;
        const orderAddress = {
            location: String(shippingDetails?.location || (typeof rawAddr === 'object' ? rawAddr.location : rawAddr) || '').trim(),
            mapUrl: String(shippingDetails?.mapUrl || shippingDetails?.maplink || (typeof rawAddr === 'object' ? (rawAddr.mapUrl || rawAddr.maplink) : '') || '').trim(),
            landmark: String(shippingDetails?.landmark || (typeof rawAddr === 'object' ? rawAddr.landmark : '') || '').trim(),
            pincode: String(shippingDetails?.pincode || shippingDetails?.Pincode || (typeof rawAddr === 'object' ? (rawAddr.pincode || rawAddr.Pincode) : '') || '').trim()
        };

        const deliveryParts = [
            orderAddress.location,
            orderAddress.landmark ? `Landmark: ${orderAddress.landmark}` : '',
            orderAddress.pincode ? `Pincode: ${orderAddress.pincode}` : ''
        ].filter(Boolean);

        const orderData = {
            userId: userId || customerId || req.customer?.id || req.customer?.did || 'Customer',
            userName: userName || customerName || shippingDetails?.fullName || 'Customer',
            customerId: customerId || userId || req.customer?.id || req.customer?.did || null,
            customerName: customerName || userName || shippingDetails?.fullName || 'Customer',
            customerMobile: customerMobile || shippingDetails?.phone || req.customer?.mobile || '',
            items: cart,
            subtotal: totalCalc,
            discount: discountAmount,
            appliedCoupon: shippingDetails?.appliedCoupon || null,
            total: finalTotal,
            paymentMethod: shippingDetails?.paymentMethod || 'COD',
            paymentStatus: 'Pending',
            address: orderAddress,
            deliveryAddress: deliveryParts.join(', '),
            mapUrl: orderAddress.mapUrl,
            maplink: orderAddress.mapUrl,
            landmark: orderAddress.landmark,
            pincode: orderAddress.pincode,
            shippingDetails: {
                ...shippingDetails,
                address: orderAddress,
                location: orderAddress.location,
                mapUrl: orderAddress.mapUrl,
                maplink: orderAddress.mapUrl,
                landmark: orderAddress.landmark,
                pincode: orderAddress.pincode,
                Pincode: orderAddress.pincode
            },
            status: 'Pending',
            createdAt: new Date().toISOString(),
        };

        const docRef = await db.collection(COLLECTION_ORDERS).add(orderData);
        res.status(200).json({ success: true, message: 'Order placed successfully!', orderId: docRef.id });
    } catch (error) {
        console.error('Checkout Error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// 9. Get Customer Orders
exports.getOrders = async (req, res) => {
    try {
        const authCustomerId = req.customer?.id;
        const authCustomerMobile = cleanPhone(req.customer?.mobile);
        const customerId = authCustomerId || req.query.customerId;
        const mobile = authCustomerMobile || cleanPhone(req.query.mobile);

        if (!customerId && !mobile) return res.status(200).json([]);

        const snapshot = await db.collection(COLLECTION_ORDERS).orderBy('createdAt', 'desc').get();
        let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        orders = orders.filter(o => {
            const matchesId = customerId && (o.userId === customerId || o.customerId === customerId);
            const matchesMob = mobile && (cleanPhone(o.customerMobile) === mobile || cleanPhone(o.shippingDetails?.phone) === mobile);
            return matchesId || matchesMob;
        });

        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 10. Save Contact Us Message
exports.saveContactMessage = async (req, res) => {
    try {
        const { name, email, message } = req.body;
        if (!name || !email || !message) {
            return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
        }
        const doc = { name: name.trim(), email: email.trim(), message: message.trim(), createdAt: new Date().toISOString() };
        const docRef = await db.collection('contacts').add(doc);
        res.status(201).json({ success: true, message: 'Message received! We will get back to you soon.', id: docRef.id });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 11. Cancel Order (Customer self-service, Pending only)
exports.cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const authCustomerId = req.customer?.id;
        const authCustomerMobile = cleanPhone(req.customer?.mobile);

        const orderRef = db.collection(COLLECTION_ORDERS).doc(id);
        const orderDoc = await orderRef.get();
        if (!orderDoc.exists) return res.status(404).json({ success: false, message: 'Order not found.' });

        const orderData = orderDoc.data();
        const orderPhone = cleanPhone(orderData.customerMobile || orderData.shippingDetails?.phone);

        const isAuthorized =
            (authCustomerId && (orderData.customerId === authCustomerId || orderData.userId === authCustomerId)) ||
            (authCustomerMobile && orderPhone === authCustomerMobile);

        if (!isAuthorized) return res.status(403).json({ success: false, message: 'You are not authorised to cancel this order.' });

        const currentStatus = String(orderData.status || '').toLowerCase();
        if (currentStatus !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel order in "${orderData.status}" stage. Please contact customer support.`,
            });
        }

        await restockOrderItems(orderData);
        await orderRef.update({ status: 'Cancelled', cancellationReason: 'Cancelled by customer', cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

        res.status(200).json({ success: true, message: 'Order cancelled and items restocked to inventory.' });
    } catch (error) {
        console.error('Cancel Order Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
