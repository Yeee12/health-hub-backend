# 🏥 HealthHub API

> Complete backend API for HealthHub - A Telemedicine & Appointment Platform

Built with Node.js, Express, MongoDB, and Paystack integration.

---

## 🚀 Quick Start

### Prerequisites

- Node.js v18+ 
- MongoDB (local or Atlas)
- npm or yarn

### Installation
```bash
# Clone repository
git clone https://github.com/yourusername/healthhub-backend.git
cd healthhub-backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your credentials

# Run development server
npm run dev
```

Server will start on `http://localhost:5000`

---

## 📚 Documentation

- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference
- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment
- **[Postman Collection](./postman/)** - API testing collection

---

## 🏗️ Project Structure
```
healthhub-backend/
├── src/
│   ├── controllers/     # Request handlers
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── middleware/      # Custom middleware
│   ├── config/          # Configuration files
│   ├── utils/           # Utility functions
│   └── app.js           # Express app setup
├── server.js            # Entry point
├── .env.example         # Environment variables template
└── package.json
```

---

## 🎯 Features

✅ **Authentication** - JWT-based auth with refresh tokens  
✅ **User Management** - Patients, Doctors, Admins  
✅ **Appointments** - Smart booking with conflict detection  
✅ **Payments** - Paystack integration (10% platform fee)  
✅ **Consultations** - Medical records & prescriptions  
✅ **Reviews** - 5-star rating system  
✅ **Notifications** - Multi-channel alerts  
✅ **Messaging** - Real-time chat  

---

## 🛠️ Tech Stack

- **Runtime:** Node.js v18+
- **Framework:** Express.js
- **Database:** MongoDB + Mongoose
- **Authentication:** JWT + bcrypt
- **Payment:** Paystack
- **Security:** Helmet, CORS, Rate Limiting

---

## 📊 API Endpoints Summary

| Module | Endpoints |
|--------|-----------|
| Authentication | 7 |
| Patients | 7 |
| Doctors | 10 |
| Appointments | 8 |
| Payments | 7 |
| Consultations | 7 |
| Reviews | 10 |
| Notifications | 9 |
| Messages | 9 |
| **Total** | **74** |

---

## 🧪 Testing
```bash
# Test models
node src/utils/testModels.js

# Clean database
node src/utils/cleanDatabase.js

# Create admin user
node src/utils/createAdmin.js
```

---

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

**Quick Deploy:**

[![Deploy to Railway](https://railway.app/button.svg)](https://railway.app/new)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

---

## 📝 Environment Variables

See `.env.example` for all required variables.

**Required:**
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - Refresh token secret

**Optional:**
- `PAYSTACK_SECRET_KEY` - For payments
- `SENDGRID_API_KEY` - For emails
- `TWILIO_AUTH_TOKEN` - For SMS

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 👨‍💻 Author

**Your Name**
- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com

---

## 🙏 Acknowledgments

- Anthropic Claude for development assistance
- Node.js community
- MongoDB team
- Paystack for payment integration

---

**⭐ Star this repo if you find it helpful!**
```


## 📦 **FINAL FILE STRUCTURE**

healthhub-backend/
├── API_DOCUMENTATION.md     ← Complete API docs
├── DEPLOYMENT.md            ← Deployment guide
├── README.md                ← Quick start
├── .env.example             ← Environment template
├── postman/
│   └── generate-collection.js
├── src/
│   ├── controllers/         ← 9 controllers
│   ├── models/             ← 10 models
│   ├── routes/             ← 9 route files
│   ├── middleware/         ← 2 middleware files
│   ├── config/
│   ├── utils/
│   └── app.js
└── server.js