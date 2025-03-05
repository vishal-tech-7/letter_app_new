const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const driveRoutes = require("./routes/driveRoutes");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

dotenv.config();
connectDB();

const app = express();

// ✅ Proper CORS Configuration
app.use(
  cors({
    origin: ["https://letter-app-frontend.onrender.com"], // ✅ Allow only your frontend
    credentials: true, // ✅ Needed for cookies & sessions
  })
);

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/drive", driveRoutes);

// ✅ Log Registered Routes
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(`✅ Registered Route: ${r.route.path}`);
  }
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Server error" });
});

// ✅ Test Route
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
