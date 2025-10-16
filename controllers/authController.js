import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import validator from "validator";
import User from "../models/userModel.js";
import { generateTokens, refreshTokenMiddleware } from "../middlewares/auth.js";

export async function register(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    const emailRaw = String(req.body.email || "").trim();
    const email = validator.normalizeEmail(emailRaw) || emailRaw.toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email." });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ success: false, message: "User already exists." });

    const newId = new mongoose.Types.ObjectId();
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      _id: newId,
      name,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Generate both access and refresh tokens
    const { accessToken, refreshToken } = generateTokens(newId.toString());

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Register error:", err);
    if (err.code === 11000) return res.status(409).json({ success: false, message: "User already exists." });
    return res.status(500).json({ success: false, message: "Server error." });
  }
}

export async function login(req, res) {
  try {
    const emailRaw = String(req.body.email || "").trim();
    const email = validator.normalizeEmail(emailRaw) || emailRaw.toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: "Invalid email or password." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Invalid email or password." });

    // Generate both access and refresh tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
}

// New refresh token endpoint
export async function refreshToken(req, res) {
  refreshTokenMiddleware(req, res, () => {
    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      accessToken: req.tokens.accessToken,
      refreshToken: req.tokens.refreshToken,
      user: { 
        id: req.user._id, 
        name: req.user.name, 
        email: req.user.email 
      },
    });
  });
}

// Add this function to handle token validation
export function validateToken(req, res) {
  // If we reach here, the token is valid
  return res.status(200).json({
    success: true,
    message: "Token is valid",
    user: req.user ? {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email
    } : null
  });
}
