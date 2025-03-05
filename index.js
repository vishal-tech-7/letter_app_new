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

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// Routes
app.use("/auth", authRoutes); // ✅ Ensure this line is present
app.use("/drive", driveRoutes);

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
