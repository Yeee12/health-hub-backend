// src/models/MedicalProfile.js
const mongoose = require('mongoose');

const medicalProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    
    // Basic Info
    dateOfBirth: String,
    gender: String,
    bloodGroup: String,
    height: Number,
    weight: Number,
    
    // Health Data
    primaryConcerns: [String],
    chronicConditions: [String],
    allergies: [String],
    currentMedications: [String],
    preferredSpecialties: [String],
    
    // Medical History
    medicalHistory: [
      {
        condition: String,
        date: String,
        treatment: String,
        notes: String,
      },
    ],
    
    // Preferences
    preferences: {
      languages: {
        type: [String],
        default: ['English'],
      },
      doctorGenderPreference: {
        type: String,
        default: 'No Preference',
      },
      consultationTypes: {
        type: [String],
        default: ['Video Call', 'In-Person'],
      },
      maxDistance: {
        type: Number,
        default: 10,
      },
      insuranceProvider: String,
    },
    
    // Emergency Contact
    emergencyContact: {
      name: String,
      relationship: String,
      phoneNumber: String,
    },
    
    isComplete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for BMI
medicalProfileSchema.virtual('bmi').get(function () {
  if (!this.height || !this.weight) return null;
  const heightInMeters = this.height / 100;
  return this.weight / (heightInMeters * heightInMeters);
});

// Virtual for completion percentage
medicalProfileSchema.virtual('completionPercentage').get(function () {
  let completed = 0;
  const total = 12;

  if (this.dateOfBirth) completed++;
  if (this.gender) completed++;
  if (this.bloodGroup) completed++;
  if (this.height) completed++;
  if (this.weight) completed++;
  if (this.primaryConcerns?.length) completed++;
  if (this.chronicConditions?.length) completed++;
  if (this.allergies?.length) completed++;
  if (this.currentMedications?.length) completed++;
  if (this.preferences?.languages?.length) completed++;
  if (this.emergencyContact?.name) completed++;
  if (this.preferences?.insuranceProvider) completed++;

  return (completed / total) * 100;
});

medicalProfileSchema.set('toJSON', { virtuals: true });
medicalProfileSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('MedicalProfile', medicalProfileSchema);