const { db } = require('../firebase');
const { generateToken } = require('../middleware/authMiddleware');
const { cleanPhone } = require('../middleware/validator');

const COLLECTION_RIDERS = 'riders';
const COLLECTION_ORDERS = 'orders';
const COLLECTION_INVENTORY = 'inventory';

// Helper to restock items into inventory when delivery fails
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

// 1. Send Rider OTP (Server-side log only, never exposed to client)
exports.riderSendOtp = async (req, res) => {
    try {
        const { mobile } = req.body || {};
        const cleanMobile = cleanPhone(mobile) || String(mobile || '').replace(/\D/g, '').slice(-10);
        if (!cleanMobile || cleanMobile.length < 10) {
            return res.status(400).json({ success: false, message: "Please enter a valid 10-digit mobile number." });
        }

        console.log(`[DEV ONLY] Code for rider ${cleanMobile}: 1234`);
        res.status(200).json({ success: true, message: "Code sent successfully to rider mobile number." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Rider Login OTP Verification (Hardcoded 1234, safe lookup)
exports.riderVerifyOtp = async (req, res) => {
    try {
        const { mobile, otp } = req.body || {};
        const inputOtp = String(otp || '').trim();

        if (inputOtp !== "1234") {
            return res.status(400).json({ success: false, message: "Invalid code. Please check and try again." });
        }

        const cleanMobile = cleanPhone(mobile) || String(mobile || '').replace(/\D/g, '').slice(-10);
        if (!cleanMobile || cleanMobile.length < 10) {
            return res.status(400).json({ success: false, message: "Please provide a valid 10-digit mobile number." });
        }

        let snap = await db.collection(COLLECTION_RIDERS).where('mobile', '==', cleanMobile).get();

        if (snap.empty) {
            snap = await db.collection(COLLECTION_RIDERS).where('mobile', '==', Number(cleanMobile)).get();
        }

        // Scan fallback in case mobile is stored with country code or spaces
        if (snap.empty) {
            const allRidersSnap = await db.collection(COLLECTION_RIDERS).get();
            const matchedDoc = allRidersSnap.docs.find(d => {
                const rMobile = String(d.data().mobile || '').replace(/\D/g, '').slice(-10);
                return rMobile === cleanMobile;
            });
            if (matchedDoc) {
                snap = { empty: false, docs: [matchedDoc] };
            }
        }

        if (snap.empty) {
            return res.status(404).json({
                success: false,
                message: "No registered rider account found with this mobile number. Please contact Admin."
            });
        }

        const riderDoc = snap.docs[0];
        const riderData = riderDoc.data();

        if (riderData.status && String(riderData.status).toLowerCase() === 'inactive') {
            return res.status(403).json({
                success: false,
                message: "Your rider account is inactive. Please contact Admin."
            });
        }

        const token = generateToken({ id: riderDoc.id, mobile: riderData.mobile, role: 'rider' });

        res.status(200).json({
            success: true,
            message: "Rider login successful",
            token,
            rider: { id: riderDoc.id, ...riderData }
        });
    } catch (error) {
        console.error('[Rider Login Error]:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Get Orders Assigned to a Specific Rider
exports.getRiderOrders = async (req, res) => {
    try {
        const { riderId } = req.params;
        const snap = await db.collection(COLLECTION_ORDERS).get();
        const allOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const cleanParam = cleanPhone(riderId) || riderId;
        const riderOrders = allOrders.filter(o =>
            o.assignedRiderId === riderId ||
            o.assignedRiderMobile === riderId ||
            (cleanParam && cleanPhone(o.assignedRiderMobile) === cleanParam)
        );
        res.status(200).json(riderOrders);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Update Order Delivery Status (Validated: Out For Delivery, Delivered, Delivery Failed)
exports.updateRiderOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, failureReason } = req.body;

        const orderRef = db.collection(COLLECTION_ORDERS).doc(id);
        const orderDoc = await orderRef.get();

        if (orderDoc.exists) {
            const previousStatus = orderDoc.data().status;
            if (status === 'Delivery Failed' && previousStatus !== 'Delivery Failed' && previousStatus !== 'Cancelled') {
                await restockOrderItems(orderDoc.data());
            }
        }

        const updateData = {
            status,
            updatedAt: new Date().toISOString()
        };
        if (failureReason) updateData.failureReason = failureReason;

        await orderRef.update(updateData);
        res.status(200).json({ success: true, message: `Order status updated to ${status}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
