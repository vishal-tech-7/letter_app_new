const mongoose = require("mongoose");
const User = require("../models/User");
require("dotenv").config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log("✅ Connected to MongoDB");

    // Replace with the actual email you want to check
    const emailToCheck = "vishalwork070320@gmail.com";

    const user = await User.findOne({ email: emailToCheck });

    if (!user) {
      console.log(`❌ No user found with email: ${emailToCheck}`);
    } else if (!user.tokens || !user.tokens.access_token) {
      console.log(`❌ User found but no stored OAuth tokens for ${emailToCheck}`);
    } else {
      console.log(`✅ User tokens found:`, user.tokens);
    }

    mongoose.connection.close();
  })
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));
