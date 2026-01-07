// Validate email format
exports.validateEmail = (email) => {
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
};

// Validate password strength
exports.validatePassword = (password) => {
  // At least 6 characters
  if (password.length < 6) {
    return {
      valid: false,
      message: 'Password must be at least 6 characters long'
    };
  }

  return { valid: true };
};

// Validate phone number
exports.validatePhoneNumber = (phone) => {
  const phoneRegex = /^\+?[\d\s\-()]+$/;
  return phoneRegex.test(phone);
};

// Registration validation middleware
exports.validateRegistration = (req, res, next) => {
  const { email, password, role, firstName, lastName } = req.body;

  // Check required fields
  if (!email || !password || !role) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email, password, and role'
    });
  }

  // Validate email
  if (!exports.validateEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address'
    });
  }

  // Validate password
  const passwordValidation = exports.validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({
      success: false,
      message: passwordValidation.message
    });
  }

  // Validate role
  const validRoles = ['patient', 'doctor', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Role must be either patient, doctor, or admin'
    });
  }

  // Check firstName and lastName for patient/doctor
  if ((role === 'patient' || role === 'doctor') && (!firstName || !lastName)) {
    return res.status(400).json({
      success: false,
      message: 'First name and last name are required for patients and doctors'
    });
  }

  next();
};

// Login validation middleware
exports.validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email and password'
    });
  }

  if (!exports.validateEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address'
    });
  }

  next();
};