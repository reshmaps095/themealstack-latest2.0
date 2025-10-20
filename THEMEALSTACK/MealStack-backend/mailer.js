const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // your gmail
    pass: "fkhe vajz doyh eloj"  // your app password
  },
  tls: {
    rejectUnauthorized: false   // 👈 accept self-signed certs
  }
});

module.exports = transporter;
