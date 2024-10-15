const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
dotenv.config();

// Database url setup
const dbUrl = `mongodb+srv://${process.env.DBUSER}:${process.env.DBPWD}@${process.env.DBHOST}`;


// connect Database
async function DBconn() {
    try {
        await mongoose.connect(dbUrl);
        //console.log("MongoDB connected successfully.");
        // Retrieve users
        const users = await User.find();
        return users;
    } catch (error) {
        console.log("Failed to connect to MongoDB:", error.message);
        return null;
    }
}

module.exports = DBconn;
