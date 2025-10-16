import express from "express";
import dotenv from "dotenv";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import carRouter from "./routes/carRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";



dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
connectDB();
const PORT = process.env.PORT || 5000;

// middlewares

app.use(cors()); // allow CORS for API calls
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // <-- important
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve uploaded images with permissive CORS header
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(path.join(process.cwd(), "uploads"))
);

// routes
app.use("/api/cars", carRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/auth", authRouter);
app.use("/api/payments", paymentRouter);

app.get("/api/ping", (req, res) => res.json({ ok: true, time: Date.now() }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
