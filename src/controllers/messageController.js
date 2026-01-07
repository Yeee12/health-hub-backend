const Message = require('../models/Message');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

// @desc    Send message
// @route   POST /api/messages
// @access  Private (Patient/Doctor)
exports.sendMessage = async (req, res) => {
  try {
    const { appointmentId, content, messageType, attachments } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'Appointment ID is required'
      });
    }

    // Get appointment
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientId', 'userId')
      .populate('doctorId', 'userId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Determine sender and receiver
    let senderId = req.user._id;
    let receiverId;

    const patientUserId = appointment.patientId.userId._id.toString();
    const doctorUserId = appointment.doctorId.userId._id.toString();

    if (senderId.toString() === patientUserId) {
      // Patient sending to doctor
      receiverId = doctorUserId;
    } else if (senderId.toString() === doctorUserId) {
      // Doctor sending to patient
      receiverId = patientUserId;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages in this conversation'
      });
    }

    // Validate message content
    if (messageType === 'text' && !content) {
      return res.status(400).json({
        success: false,
        message: 'Text messages must have content'
      });
    }

    // Create message
    const message = await Message.create({
      appointmentId,
      senderId,
      receiverId,
      messageType: messageType || 'text',
      content,
      attachments
    });

    // Populate sender info
    await message.populate([
      { path: 'senderId', select: 'email role profilePicture' },
      { path: 'receiverId', select: 'email role profilePicture' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
};

// @desc    Get conversation messages
// @route   GET /api/messages/conversation/:appointmentId
// @access  Private (Patient/Doctor of that appointment)
exports.getConversation = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { before, after, limit } = req.query;

    // Verify user is part of this appointment
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientId', 'userId')
      .populate('doctorId', 'userId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const patientUserId = appointment.patientId.userId._id.toString();
    const doctorUserId = appointment.doctorId.userId._id.toString();
    const currentUserId = req.user._id.toString();

    if (currentUserId !== patientUserId && currentUserId !== doctorUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this conversation'
      });
    }

    // Get messages
    const messages = await Message.getConversation(appointmentId, {
      before,
      after,
      limit: parseInt(limit) || 50
    });

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
};

// @desc    Get unread message count
// @route   GET /api/messages/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.getUnreadCount(req.user._id);

    res.status(200).json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unread count',
      error: error.message
    });
  }
};

// @desc    Mark message as read
// @route   PUT /api/messages/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only receiver can mark as read
    if (message.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    await message.markRead();

    res.status(200).json({
      success: true,
      message: 'Message marked as read',
      data: message
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking message as read',
      error: error.message
    });
  }
};

// @desc    Mark all messages in conversation as read
// @route   PUT /api/messages/conversation/:appointmentId/read-all
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const result = await Message.markAllReadInConversation(
      appointmentId,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: 'All messages marked as read',
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking messages as read',
      error: error.message
    });
  }
};

// @desc    Edit message
// @route   PUT /api/messages/:id
// @access  Private (Sender only, within 15 minutes)
exports.editMessage = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender can edit
    if (message.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if can edit
    if (!message.canEdit) {
      return res.status(400).json({
        success: false,
        message: 'Message can only be edited within 15 minutes'
      });
    }

    await message.editContent(content);

    res.status(200).json({
      success: true,
      message: 'Message edited successfully',
      data: message
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error editing message',
      error: error.message
    });
  }
};

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private (Sender only, within 1 hour)
exports.deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender can delete
    if (message.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if can delete
    if (!message.canDelete) {
      return res.status(400).json({
        success: false,
        message: 'Message can only be deleted within 1 hour'
      });
    }

    await message.delete(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
      data: message
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting message',
      error: error.message
    });
  }
};

// @desc    Get conversation list (all chats)
// @route   GET /api/messages/conversations
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    let userRole;
    let userId;

    // Get user's role-specific ID
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ userId: req.user._id });
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient profile not found'
        });
      }
      userRole = 'patient';
      userId = patient._id;
    } else if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ userId: req.user._id });
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor profile not found'
        });
      }
      userRole = 'doctor';
      userId = doctor._id;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Only patients and doctors can access conversations'
      });
    }

    const conversations = await Message.getConversationSummaries(
      userId,
      userRole
    );

    res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching conversations',
      error: error.message
    });
  }
};

// @desc    Search messages in conversation
// @route   GET /api/messages/conversation/:appointmentId/search
// @access  Private
exports.searchMessages = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Verify user is part of appointment
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientId', 'userId')
      .populate('doctorId', 'userId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const patientUserId = appointment.patientId.userId._id.toString();
    const doctorUserId = appointment.doctorId.userId._id.toString();
    const currentUserId = req.user._id.toString();

    if (currentUserId !== patientUserId && currentUserId !== doctorUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const messages = await Message.searchInConversation(appointmentId, query);

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching messages',
      error: error.message
    });
  }
};