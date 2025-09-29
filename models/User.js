import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Numele este obligatoriu"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email-ul este obligatoriu"],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Email invalid"],
    },
    password: {
      type: String,
      required: [true, "Parola este obligatorie"],
      minlength: [6, "Parola trebuie să aibă minim 6 caractere"],
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
