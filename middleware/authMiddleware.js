import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

const JWT_SECRET = 'your_jwt_secret_here';

// Protect routes - verify token and set user in req object
export const protect = async (req, res, next) => {
    // 1. Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            success: false, 
            message: 'Not authorized, token missing' 
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 2. Verify access token
        const payload = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(payload.id).select('-password');
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired',
                expiredAt: error.expiredAt
            });
        }
        
        console.error('JWT verification failed:', error);
        return res.status(401).json({
            success: false,
            message: 'Not authorized, token failed',
            error: error.message
        });
    }
};

// Admin middleware - check if user is admin
export const admin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        res.status(401).json({
            success: false,
            message: 'Not authorized as admin'
        });
    }
};