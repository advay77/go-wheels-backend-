import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

const JWT_SECRET = 'your_jwt_secret_here';
const REFRESH_TOKEN_SECRET = 'your_refresh_token_secret_here';

export const generateTokens = (userId) => {
    const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: userId }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

export const authMiddleware = async (req, res, next) => {
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

// Middleware to check refresh token
export const refreshTokenMiddleware = async (req, res, next) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({
            success: false,
            message: 'No refresh token provided'
        });
    }

    try {
        const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate new tokens
        const tokens = generateTokens(user._id);
        
        // Attach tokens and user to request
        req.tokens = tokens;
        req.user = user;
        next();
    } catch (error) {
        console.error('Refresh token error:', error);
        return res.status(403).json({
            success: false,
            message: 'Invalid refresh token',
            error: error.message
        });
    }
};
