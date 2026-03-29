import mongoose from "mongoose";

const shareSchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    permission: {
      type: String,
      enum: ["VIEW", "EDIT"],
      default: "EDIT"
    }
  },
  { timestamps: true }
);

shareSchema.index({ document: 1, user: 1 }, { unique: true });

const Share = mongoose.model("Share", shareSchema);

export default Share;
