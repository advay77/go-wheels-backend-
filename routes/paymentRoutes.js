// routes/paymentRoutes.js
import express from "express";
import { confirmPayment, createCheckoutSession } from "../controllers/paymentController.js";

const paymentRouter = express.Router();

// Create a new booking (without payment processing)
paymentRouter.post("/create-checkout-session", createCheckoutSession);
paymentRouter.get("/confirm", confirmPayment);

export default paymentRouter;   