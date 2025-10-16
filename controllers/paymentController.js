// controllers/paymentController.js
import Booking from "../models/bookingModel.js";

export const createCheckoutSession = async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ success: false, message: "Missing request body" });

    const {
      userId,
      customer,
      email,
      phone,
      car,
      pickupDate,
      returnDate,
      amount,
      details,
      address,
      carImage,
    } = req.body;

    // Validate input
    const total = Number(amount);
    if (!total || Number.isNaN(total) || total <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }
    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }
    if (!pickupDate || !returnDate) {
      return res.status(400).json({ success: false, message: "pickupDate and returnDate required" });
    }

    const pd = new Date(pickupDate);
    const rd = new Date(returnDate);
    if (Number.isNaN(pd.getTime()) || Number.isNaN(rd.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid dates" });
    }
    if (rd < pd) {
      return res.status(400).json({ success: false, message: "returnDate must be same or after pickupDate" });
    }

    // Normalize car data
    let carField = car;
    if (typeof car === "string") {
      try { 
        carField = JSON.parse(car); 
      } catch { 
        carField = { name: car }; 
      }
    }

    // Create booking with payment completed
    const booking = await Booking.create({
      userId,
      customer: String(customer || ""),
      email: String(email || ""),
      phone: String(phone || ""),
      car: carField || {},
      carImage: String(carImage || ""),
      pickupDate: pd,
      returnDate: rd,
      amount: total,
      paymentStatus: "completed", // Mark as completed directly
      details: typeof details === "string" ? JSON.parse(details) : (details || {}),
      address: typeof address === "string" ? JSON.parse(address) : (address || {}),
      status: "confirmed",
      currency: "INR",
    });

    return res.status(200).json({
      success: true,
      message: "Booking created successfully",
      bookingId: booking._id,
      booking,
    });

  } catch (error) {
    console.error("Error creating booking:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating booking",
      error: error.message,
    });
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const { bookingId } = req.query;
    
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID is required" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // No actual payment to confirm, just return the booking status
    return res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      booking,
    });
  } catch (error) {
    console.error("Error confirming payment:", error);
    return res.status(500).json({
      success: false,
      message: "Error confirming payment",
      error: error.message,
    });
  }
};