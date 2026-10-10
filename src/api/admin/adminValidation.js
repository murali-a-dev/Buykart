// Validation rules for Admin App & Purchase Entry
exports.validateAdminLogin = (req) => {
  const { username, password } = req.body || {};
  if (!username || String(username).trim().length < 2) {
    return 'Username or mobile phone number is required.';
  }
  if (!password || String(password).trim().length < 3) {
    return 'Password is required (minimum 3 characters).';
  }
  return null;
};

exports.validateAdminRegistration = (req) => {
  const { name, phone, password, confirmPassword } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    return 'Username is required (minimum 2 characters).';
  }
  const cleanPhone = String(phone || '').trim().replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    return 'A valid 10-digit mobile number is required.';
  }
  if (!password || String(password).trim().length < 4) {
    return 'Password must be at least 4 characters.';
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return 'Passwords do not match.';
  }
  return null;
};

exports.validateAddInventory = (req) => {
  const { category, itemName, unit, price, op_stock } = req.body;
  if (!itemName || String(itemName).trim().length === 0) {
    return 'Item name is required.';
  }
  if (!category || String(category).trim().length === 0) {
    return 'Category selection is required.';
  }
  if (!unit || String(unit).trim().length === 0) {
    return 'Unit specification (e.g. Kg, Pcs) is required.';
  }
  if (isNaN(Number(price)) || Number(price) <= 0) {
    return 'Price must be a valid positive number.';
  }
  if (isNaN(Number(op_stock)) || Number(op_stock) < 0) {
    return 'Opening stock quantity must be a non-negative number.';
  }
  return null;
};

exports.validateAddRider = (req) => {
  const { name, mobile, status } = req.body;
  if (!name || String(name).trim().length < 2) {
    return 'Rider full name is required (minimum 2 characters).';
  }
  if (!mobile || !/^\d{10}$/.test(String(mobile).trim())) {
    return 'A valid 10-digit mobile phone number is required for the rider.';
  }
  if (status && !['Active', 'Inactive', 'active', 'inactive'].includes(status)) {
    return 'Rider status must be either Active or Inactive.';
  }
  return null;
};

exports.validatePackOrder = (req) => {
  const { packedItems } = req.body;
  if (packedItems && !Array.isArray(packedItems)) {
    return 'Packed items must be an array of order products.';
  }
  return null;
};

exports.validateDispatchOrder = (req) => {
  const { riderId, riderMobile } = req.body;
  if (!riderId || String(riderId).trim().length === 0) {
    return 'Assigned Rider selection is required for dispatching an order.';
  }
  if (riderMobile && !/^\d{10}$/.test(String(riderMobile).trim())) {
    return 'Rider contact number must be a valid 10-digit phone number.';
  }
  return null;
};

exports.validatePurchaseEntry = (req) => {
  const { vendorName, productId, quantity, purchaseRate } = req.body;
  if (!vendorName || String(vendorName).trim().length < 2) {
    return 'Vendor/Supplier name is required.';
  }
  if (!productId || String(productId).trim().length === 0) {
    return 'Target product selection from inventory is required.';
  }
  if (isNaN(Number(quantity)) || Number(quantity) <= 0) {
    return 'Stock inward quantity must be greater than zero.';
  }
  if (purchaseRate !== undefined && (isNaN(Number(purchaseRate)) || Number(purchaseRate) < 0)) {
    return 'Purchase rate must be a non-negative number.';
  }
  return null;
};
