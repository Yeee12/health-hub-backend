const User = require('../models/User');
const jwt = require('jsonwebtoken');

class TokenService {
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      const error = new Error('Refresh token is required');
      error.statusCode = 400;
      throw error;
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_for_development'
    );

    const user = await User.findById(decoded.id);

    if (!user) {
      const error = new Error('Invalid refresh token');
      error.statusCode = 401;
      throw error;
    }

    if (!user.refreshTokens.includes(refreshToken)) {
      const error = new Error('Invalid refresh token');
      error.statusCode = 401;
      throw error;
    }

    const newAccessToken = user.generateAccessToken();

    return {
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
      },
    };
  }
}

module.exports = new TokenService();