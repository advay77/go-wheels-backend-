import mongoose from "mongoose";
import Booking from "../models/bookingModel.js";
import Car from "../models/carModel.js";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const BLOCKING_STATUSES = ["pending", "active", "upcoming"];

const tryParseJSON = (v) => {
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return v; }
};

const buildCarSummary = (src = {}) => {
  const id = src._id?.toString?.() || src.id || null;
  return {
    id,
    make: src.make,
    model: src.model || "",
    year: src.year ? Number(src.year) : null,
    dailyRate: src.dailyRate ? Number(src.dailyRate) : 0,
    seats: src.seats ? Number(src.seats) : 4,
    transmission: src.transmission,
    fuelType: src.fuelType,
    mileage: src.mileage ? Number(src.mileage) : 0,
    image: src.image || src.carImage || "",
  };
};

const deleteLocalFileIfPresent = (filePath) => {
  if (!filePath) return;
  const filename = filePath.replace(/^\/uploads\//, "");
  const full = path.join(UPLOADS_DIR, filename);
  fs.unlink(full, (err) => { if (err) console.warn("Failed to delete file:", full, err); });
};

/* ---------- CREATE BOOKING (transactional, prevents overlap) ---------- */
export const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { pickupDate, returnDate, carId, ...bookingData } = req.body;
    const file = req.file;

    // Validate required fields
    if (!pickupDate || !returnDate || !carId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Missing required booking information"
      });
    }

    // Find the car
    const car = await Car.findById(carId).session(session);
    if (!car) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Car not found"
      });
    }

    // Check if car is available for the requested dates
    const conflictingBookings = await Booking.find({
      'car.id': carId,
      status: { $in: BLOCKING_STATUSES },
      $or: [
        { pickupDate: { $lte: new Date(returnDate), $gte: new Date(pickupDate) } },
        { returnDate: { $gte: new Date(pickupDate), $lte: new Date(returnDate) } },
        {
          $and: [
            { pickupDate: { $lte: new Date(pickupDate) } },
            { returnDate: { $gte: new Date(returnDate) } }
          ]
        }
      ]
    }).session(session);

    if (conflictingBookings.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Car is not available for the selected dates"
      });
    }

    // Calculate booking amount
    const pickupDateTime = new Date(pickupDate);
    const returnDateTime = new Date(returnDate);
    const diffTime = Math.abs(returnDateTime - pickupDateTime);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const amount = diffDays * car.dailyRate;

    // Create car summary
    const carSummary = buildCarSummary(car);

    // Handle file upload if present
    let carImage = "";
    if (file) {
      carImage = `/uploads/${file.filename}`;
    }

    // Create the booking
    const newBooking = new Booking({
      userId: req.user._id,
      customer: bookingData.customer || req.user.name,
      email: bookingData.email || req.user.email,
      phone: bookingData.phone || "",
      car: carSummary,
      carImage,
      pickupDate: pickupDateTime,
      returnDate: returnDateTime,
      amount,
      status: "pending"
    });

    await newBooking.save({ session });
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking: newBooking
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating booking:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating booking",
      error: error.message
    });
  }
};


/* These functions are already defined later in the file, so removing the duplicates */

/* These functions are already defined later in the file, so removing the duplicates */

/* ---------- UPDATE BOOKING ---------- */
export const updateBooking = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    const file = req.file;

    // File handling
    if (file) {
      if (updates.carImage && updates.carImage.startsWith("/uploads/")) {
        deleteLocalFileIfPresent(updates.carImage);
      }
      updates.carImage = `/uploads/${file.filename}`;
    } else if (updates.carImage !== undefined) {
      if (updates.carImage && !String(updates.carImage).startsWith("/uploads/") && 
          updates.originalCarImage && updates.originalCarImage.startsWith("/uploads/")) {
        deleteLocalFileIfPresent(updates.originalCarImage);
      }
      updates.carImage = updates.carImage || null;
    }

    // Validate booking exists
    const booking = await Booking.findById(id).session(session);
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false, 
        message: "Booking not found" 
      });
    }

    // Handle file upload if present
    if (file) {
      // Delete old file if it exists
      if (booking.carImage && booking.carImage.startsWith("/uploads/")) {
        deleteLocalFileIfPresent(booking.carImage);
      }
      booking.carImage = `/uploads/${file.filename}`;
    } else if (updates.carImage === '') {
      // Handle case when car image is being removed
      if (booking.carImage && booking.carImage.startsWith("/uploads/")) {
        deleteLocalFileIfPresent(booking.carImage);
      }
      booking.carImage = '';
    }

    // Define allowed fields that can be updated
    const allowedUpdates = {
      customer: { type: 'string', required: true },
      email: { type: 'string', required: true, validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
      phone: { type: 'string' },
      car: { type: 'object', transform: (v) => {
        const c = tryParseJSON(v);
        if (!c) return null;
        const summary = buildCarSummary(c);
        if (!summary.id && booking.car?.id) summary.id = booking.car.id;
        return summary;
      }},
      pickupDate: { type: 'date', required: true },
      returnDate: { type: 'date', required: true },
      bookingDate: { type: 'date' },
      status: { type: 'string', enum: ['pending', 'active', 'completed', 'cancelled', 'upcoming'] },
      amount: { type: 'number' },
      paymentStatus: { type: 'string', enum: ['pending', 'paid', 'failed', 'refunded'] },
      paymentMethod: { type: 'string' },
      details: { type: 'object', transform: tryParseJSON },
      address: { type: 'object', transform: tryParseJSON },
      source: { type: 'string', enum: ['website', 'admin', 'phone', 'walk-in'] },
      isVerified: { type: 'boolean' }
    };

    // Apply updates
    for (const [field, config] of Object.entries(allowedUpdates)) {
      if (updates[field] === undefined) continue;

      // Transform and validate the value
      let value = updates[field];
      if (config.transform) {
        value = config.transform(value);
        if (value === null || value === undefined) continue;
      }

      // Type checking
      if (config.type === 'date') {
        value = new Date(value);
        if (isNaN(value.getTime())) {
          throw new Error(`Invalid date format for ${field}`);
        }
      } else if (config.type === 'number' && typeof value !== 'number') {
        value = Number(value);
        if (isNaN(value)) {
          throw new Error(`Invalid number format for ${field}`);
        }
      } else if (config.enum && !config.enum.includes(value)) {
        throw new Error(`Invalid value for ${field}. Must be one of: ${config.enum.join(', ')}`);
      } else if (config.validate && !config.validate(value)) {
        throw new Error(`Validation failed for ${field}`);
      }

      // Apply the update
      booking[field] = value;
    }

    // Validate pickup and return dates
    if (booking.pickupDate >= booking.returnDate) {
      throw new Error('Return date must be after pickup date');
    }

    // Save the updated booking
    const updatedBooking = await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Booking updated successfully',
      data: updatedBooking
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error updating booking:', error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    next(error);
  }
};

/* ---------- GET ALL BOOKINGS (Admin) ---------- */
export const getBookings = async (req, res, next) => {
  try {
    const { search, status, from } = req.query;
    const query = {};
    
    if (search) {
      query.$or = [
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
        { 'car.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (from) {
      query.pickupDate = { $gte: new Date(from) };
    }
    
    const bookings = await Booking.find(query)
      .populate('car', 'make model year registrationNumber')
      .sort({ createdAt: -1 });
      
    res.json({ 
      success: true, 
      data: bookings,
      count: bookings.length
    });
  } catch (err) { 
    next(err); 
  }
};

/* ---------- MY BOOKINGS ---------- */
export const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate('car', 'make model year')
      .sort({ createdAt: -1 });
      
    res.json({ 
      success: true, 
      data: bookings,
      count: bookings.length
    });
  } catch (err) { 
    next(err); 
  }
};

/* ---------- UPDATE STATUS ---------- */
export const updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status value' 
      });
    }
    
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    )
    .populate('car', 'make model year')
    .populate('user', 'name email');
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    res.json({ 
      success: true, 
      data: booking,
      message: 'Booking status updated successfully'
    });
  } catch (err) { 
    next(err); 
  }
};

/* ---------- DELETE ---------- */
export const deleteBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.carImage && booking.carImage.startsWith("/uploads/")) deleteLocalFileIfPresent(booking.carImage);
    await booking.remove(); // triggers post('remove') to clean Car.bookings
    res.json({ message: "Booking deleted successfully" });
  } catch (err) { next(err); }
};
