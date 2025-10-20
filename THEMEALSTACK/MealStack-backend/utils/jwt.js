const jwt = require('jsonwebtoken');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const generateTokens = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };

  const accessToken = generateToken(payload);
  
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: process.env.JWT_EXPIRES_IN
  };
};

module.exports = {
  generateToken,
  verifyToken,
  generateTokens
};