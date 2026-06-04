import User from "../models/User.js";

import bcrypt from "bcrypt";  // Add this line
import jwt from "jsonwebtoken";  // Add this line

// Add the generateToken function
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ success: false, message: "All fields are required" });

        const existingUser = await User.findOne({ email })
        if (existingUser) return res.status(400).json({ success: false, message: "User already exists" });


        //Hash password
        const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));

        const user = await User.create({ name, email, password: hashedPassword })

        const token = generateToken(user._id);

        res.status(201).json({ success: true, token, user })



    }
    catch (error) {
        console.error("Registration Error:", error.message);
        res.status(500).json({ success: false, message: "server error" })
    }
}


//login user
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: "All fields are required" });

        const user = await User.findOne({ email })
        if (!user) return res.status(400).json({ success: false, message: "Invliad credentials" });

        //check password
        const isMatch = await bcrypt.compare(password, user.password)

        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }



        const token = generateToken(user._id);

        res.status(201).json({ success: true, token, user })



    }
    catch (error) {
        console.error("Registration Error:", error.message);
        res.status(500).json({ success: false, message: "server error" })
    }
}


//get current user
export const getUser = async (req, res) => {
    try {

        const user = await User.findById(req.userId).select("-password");
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }
        res.json({ success: true, user })

    }
    catch (error) {
        console.error("Get user error Error:", error.message);
        res.status(500).json({ success: false, message: "server error" })
    }
}