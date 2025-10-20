require("dotenv").config();
const nodemailer = require("nodemailer");

// configure transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // your email
    pass: process.env.EMAIL_PASS  // your app password
  }
});
// Test the connection
transporter.verify((error, success) => {
  if (error) {
    console.log('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

module.exports = transporter;
