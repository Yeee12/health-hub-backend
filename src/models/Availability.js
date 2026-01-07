const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: [true, 'Doctor ID is required'],
    unique: true
  },
  weeklySchedule: [
    {
      day: {
        type: String,
        enum: {
          values: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          message: 'Invalid day of week'
        },
        required: true
      },
      isAvailable: {
        type: Boolean,
        default: true
      },
      timeSlots: [
        {
          startTime: {
            type: String,
            required: true,
            validate: {
              validator: function(value) {
                // Validate 24-hour time format (HH:MM)
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
              },
              message: 'Time must be in HH:MM format (24-hour)'
            }
          },
          endTime: {
            type: String,
            required: true,
            validate: {
              validator: function(value) {
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
              },
              message: 'Time must be in HH:MM format (24-hour)'
            }
          }
        }
      ]
    }
  ],
  slotDuration: {
    type: Number,
    default: 30,
    min: [15, 'Slot duration must be at least 15 minutes'],
    max: [120, 'Slot duration cannot exceed 120 minutes'],
    validate: {
      validator: function(value) {
        // Must be divisible by 15
        return value % 15 === 0;
      },
      message: 'Slot duration must be divisible by 15 (15, 30, 45, 60, etc.)'
    }
  },
  maxAppointmentsPerDay: {
    type: Number,
    default: 20,
    min: [1, 'Must allow at least 1 appointment per day'],
    max: [50, 'Cannot exceed 50 appointments per day']
  },
  bufferTime: {
    type: Number,
    default: 0,
    min: [0, 'Buffer time cannot be negative'],
    max: [60, 'Buffer time cannot exceed 60 minutes']
  },
  blockedDates: [
    {
      date: {
        type: Date,
        required: true
      },
      reason: {
        type: String,
        enum: ['vacation', 'conference', 'personal', 'emergency', 'other'],
        default: 'personal'
      },
      allDay: {
        type: Boolean,
        default: true
      },
      blockedSlots: [{
        type: String,
        validate: {
          validator: function(value) {
            return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
          },
          message: 'Time must be in HH:MM format'
        }
      }]
    }
  ],
  customAvailableDates: [
    {
      date: {
        type: Date,
        required: true
      },
      timeSlots: [
        {
          startTime: {
            type: String,
            required: true,
            validate: {
              validator: function(value) {
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
              },
              message: 'Time must be in HH:MM format'
            }
          },
          endTime: {
            type: String,
            required: true,
            validate: {
              validator: function(value) {
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
              },
              message: 'Time must be in HH:MM format'
            }
          }
        }
      ]
    }
  ]
}, {
  timestamps: true
});

// INDEXES
// Note: doctorId already has an index from 'unique: true'
availabilitySchema.index({ 'blockedDates.date': 1 });
availabilitySchema.index({ 'customAvailableDates.date': 1 });

// VALIDATION: Ensure endTime is after startTime
availabilitySchema.pre('save', function() {
  // Validate weekly schedule time slots
  for (const schedule of this.weeklySchedule) {
    for (const slot of schedule.timeSlots) {
      if (slot.startTime >= slot.endTime) {
        throw new Error(`End time must be after start time for ${schedule.day}`);
      }
    }
  }

  // Validate custom available dates
  for (const customDate of this.customAvailableDates) {
    for (const slot of customDate.timeSlots) {
      if (slot.startTime >= slot.endTime) {
        throw new Error('End time must be after start time for custom dates');
      }
    }
  }
});

// METHOD: Check if doctor is available on a specific date and time
availabilitySchema.methods.isAvailableAt = function(dateTime) {
  const date = new Date(dateTime);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const timeString = date.toTimeString().slice(0, 5); // HH:MM format

  // Check if date is blocked
  const isBlocked = this.blockedDates.some(blocked => {
    const blockedDate = new Date(blocked.date);
    const isSameDay = 
      blockedDate.getDate() === date.getDate() &&
      blockedDate.getMonth() === date.getMonth() &&
      blockedDate.getFullYear() === date.getFullYear();

    if (!isSameDay) return false;

    if (blocked.allDay) return true;

    return blocked.blockedSlots.includes(timeString);
  });

  if (isBlocked) return false;

  // Check custom available dates first (overrides weekly schedule)
  const customDate = this.customAvailableDates.find(custom => {
    const customDateObj = new Date(custom.date);
    return (
      customDateObj.getDate() === date.getDate() &&
      customDateObj.getMonth() === date.getMonth() &&
      customDateObj.getFullYear() === date.getFullYear()
    );
  });

  if (customDate) {
    return customDate.timeSlots.some(slot => 
      timeString >= slot.startTime && timeString < slot.endTime
    );
  }

  // Check weekly schedule
  const daySchedule = this.weeklySchedule.find(s => s.day === dayName);
  
  if (!daySchedule || !daySchedule.isAvailable) return false;

  return daySchedule.timeSlots.some(slot => 
    timeString >= slot.startTime && timeString < slot.endTime
  );
};

// METHOD: Get all available time slots for a specific date
availabilitySchema.methods.getAvailableSlotsForDate = function(date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  
  // Check if entire day is blocked
  const dayBlocked = this.blockedDates.some(blocked => {
    const blockedDate = new Date(blocked.date);
    blockedDate.setHours(0, 0, 0, 0);
    return blockedDate.getTime() === targetDate.getTime() && blocked.allDay;
  });

  if (dayBlocked) return [];

  // Get time slots (custom date takes priority)
  const customDate = this.customAvailableDates.find(custom => {
    const customDateObj = new Date(custom.date);
    customDateObj.setHours(0, 0, 0, 0);
    return customDateObj.getTime() === targetDate.getTime();
  });

  let timeSlots = [];

  if (customDate) {
    timeSlots = customDate.timeSlots;
  } else {
    const daySchedule = this.weeklySchedule.find(s => s.day === dayName);
    if (!daySchedule || !daySchedule.isAvailable) return [];
    timeSlots = daySchedule.timeSlots;
  }

  // Generate individual slots based on slotDuration
  const availableSlots = [];

  for (const range of timeSlots) {
    let currentTime = this._timeStringToMinutes(range.startTime);
    const endTime = this._timeStringToMinutes(range.endTime);

    while (currentTime + this.slotDuration <= endTime) {
      const slotTime = this._minutesToTimeString(currentTime);
      
      // Check if this specific slot is blocked
      const isSlotBlocked = this.blockedDates.some(blocked => {
        const blockedDate = new Date(blocked.date);
        blockedDate.setHours(0, 0, 0, 0);
        return (
          blockedDate.getTime() === targetDate.getTime() &&
          !blocked.allDay &&
          blocked.blockedSlots.includes(slotTime)
        );
      });

      if (!isSlotBlocked) {
        availableSlots.push(slotTime);
      }

      currentTime += this.slotDuration + this.bufferTime;
    }
  }

  return availableSlots;
};

// METHOD: Block a specific date
availabilitySchema.methods.blockDate = async function(date, reason = 'personal', allDay = true, slots = []) {
  this.blockedDates.push({
    date: new Date(date),
    reason,
    allDay,
    blockedSlots: allDay ? [] : slots
  });
  await this.save();
};

// METHOD: Add custom available date
availabilitySchema.methods.addCustomDate = async function(date, timeSlots) {
  this.customAvailableDates.push({
    date: new Date(date),
    timeSlots
  });
  await this.save();
};

// HELPER: Convert time string to minutes
availabilitySchema.methods._timeStringToMinutes = function(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

// HELPER: Convert minutes to time string
availabilitySchema.methods._minutesToTimeString = function(minutes) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
  const mins = (minutes % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
};

// STATIC: Initialize default availability for new doctor
availabilitySchema.statics.createDefault = async function(doctorId) {
  const defaultSchedule = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday'
  ].map(day => ({
    day,
    isAvailable: true,
    timeSlots: [
      { startTime: '09:00', endTime: '12:00' },
      { startTime: '14:00', endTime: '17:00' }
    ]
  }));

  // Weekend - not available by default
  defaultSchedule.push(
    { day: 'saturday', isAvailable: false, timeSlots: [] },
    { day: 'sunday', isAvailable: false, timeSlots: [] }
  );

  return await this.create({
    doctorId,
    weeklySchedule: defaultSchedule,
    slotDuration: 30,
    maxAppointmentsPerDay: 20,
    bufferTime: 0
  });
};

module.exports = mongoose.model('Availability', availabilitySchema);