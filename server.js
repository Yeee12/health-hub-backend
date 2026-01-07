require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/database');

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error(error.name, error.message);
  console.error(error.stack);
  process.exit(1);
});

// Connect to MongoDB
connectDB();

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log(`🏥 HealthHub API Server`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Server running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  console.log('========================================== 🚀');
  console.log('');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('💥 UNHANDLED REJECTION! Shutting down...');
  console.error(error.name, error.message);
  console.error(error.stack);
  
  // Close server gracefully
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});