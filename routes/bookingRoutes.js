import express from 'express';
import {
  createBooking,
  getBookings,
  updateBooking,
  updateBookingStatus,
  deleteBooking,
  getMyBookings
} from '../controllers/bookingController.js';
import { upload } from '../middlewares/upload.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (protected by auth)
router.post('/', protect, upload.single('carImage'), createBooking);
router.get('/my-bookings', protect, getMyBookings);

// Admin routes
router.get('/', protect, admin, getBookings);
router.put('/:id', protect, admin, upload.single('carImage'), updateBooking);
router.patch('/:id/status', protect, admin, updateBookingStatus);
router.delete('/:id', protect, admin, deleteBooking);

export default router;