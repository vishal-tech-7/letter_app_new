const mongoose = require('mongoose');

const letterSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200, // ✅ Restrict title length
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000, // ✅ Restrict content length (adjust as needed)
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true, // ✅ Improves query performance
    },
    driveFileId: {
      type: String,
      default: null,
    },
    lastSaved: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // ✅ Automatically manages createdAt & updatedAt
  }
);

// ✅ Auto-update lastSaved field before saving
letterSchema.pre('save', function (next) {
  this.lastSaved = Date.now();
  next();
});

const Letter = mongoose.model('Letter', letterSchema);

module.exports = Letter;
