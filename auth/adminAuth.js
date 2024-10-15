const jwt = require('jsonwebtoken');
const User = require('../models/User');

const adminAuth = async (req, res, next) => {
    const token = req.header('Authorization').replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'Authorization token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWTSECRET);
        const user = await User.findById(decoded.userId);

        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Access forbidden: Admins only' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};

module.exports = adminAuth;
