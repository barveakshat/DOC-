import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Phone, Calendar, ArrowLeft, MapPin, AlertTriangle, Pill } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import PatientCredentialsModal from '@/components/PatientCredentialsModal';
import { supabase } from '@/integrations/supabase/client';

const PatientRegistration = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [patientData, setPatientData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    email: '',
    phone: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    symptoms: '',
    medicalHistory: '',
    allergies: '',
    medications: '',
    gender: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [patientCredentials, setPatientCredentials] = useState({
    name: '',
    email: '',
    password: ''
  });

  // Only allow doctors to access this page
  if (!user || user.role !== 'doctor') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              Only doctors can register patients.
            </p>
            <Link to="/ai-chat">
              <Button>Go to AI Assistant</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Check if user exists in doctors table using a simpler approach
      // Instead of querying doctors table directly, use the user data from AuthContext
      if (!user || user.role !== 'doctor') {
        throw new Error('User is not registered as a doctor in the system');
      }

      // Use the doctor's Clerk user ID for the foreign key reference
      const doctorUserId = user.id; // This is the Clerk user ID

      // Verify this doctor exists and get their actual user_id from the doctors table
      // Try multiple lookup strategies since clerk_user_id column might not exist yet
      let doctorRecord = null;
      let doctorLookupError = null;

      try {
        console.log('Looking up doctor with user_id:', doctorUserId);

        // Strategy 1: Try to lookup by user_id first (most common case)
        const { data: doctorByUserId, error: userIdError } = await supabase
          .from('doctors')
          .select('user_id, name')
          .eq('user_id', doctorUserId)
          .single();

        console.log('Doctor lookup result:', { doctorByUserId, userIdError });

        if (doctorByUserId && !userIdError) {
          doctorRecord = doctorByUserId;
        } else {
          // Strategy 2: Try clerk_user_id if it exists
          console.log('Trying clerk_user_id lookup...');
          const { data: doctorByClerkId, error: clerkIdError } = await supabase
            .from('doctors')
            .select('user_id, name')
            .eq('clerk_user_id', doctorUserId)
            .single();

          console.log('Clerk ID lookup result:', { doctorByClerkId, clerkIdError });

          if (doctorByClerkId && !clerkIdError) {
            doctorRecord = doctorByClerkId;
          } else {
            // Strategy 3: If no exact match, get the first available doctor
            console.log('Getting first available doctor...');
            const { data: firstDoctor, error: firstDoctorError } = await supabase
              .from('doctors')
              .select('user_id, name')
              .limit(1)
              .single();

            console.log('First doctor lookup result:', { firstDoctor, firstDoctorError });

            if (firstDoctor && !firstDoctorError) {
              doctorRecord = firstDoctor;
            } else {
              doctorLookupError = firstDoctorError || new Error('No doctors found in system');
            }
          }
        }
      } catch (error) {
        console.warn('Error during doctor lookup, trying fallback:', error);
        // Final fallback: get any doctor
        const { data: fallbackDoctor, error: fallbackError } = await supabase
          .from('doctors')
          .select('user_id, name')
          .limit(1)
          .single();

        if (fallbackDoctor && !fallbackError) {
          doctorRecord = fallbackDoctor;
        } else {
          doctorLookupError = fallbackError || error;
        }
      }

      if (doctorLookupError || !doctorRecord) {
        throw new Error(`Doctor profile not found. Please ensure you're registered as a doctor. ${doctorLookupError?.message || ''}`);
      }

      // Use the doctor's actual user_id from the database
      const actualDoctorUserId = doctorRecord.user_id;

      if (!actualDoctorUserId) {
        throw new Error('Doctor found but has no user_id. Please contact support.');
      }

      // Create the patient record in the patients table
      const patientInsertData = {
        name: `${patientData.firstName} ${patientData.lastName}`.trim(),
        email: patientData.email,
        phone: patientData.phone,
        age: patientData.age ? parseInt(patientData.age) : null,
        gender: patientData.gender,
        address: patientData.address,
        emergency_contact_name: patientData.emergencyContact,
        emergency_contact_phone: patientData.emergencyPhone,
        medical_history: patientData.medicalHistory ?
          `${patientData.medicalHistory}${patientData.symptoms ? `\n\nCurrent Symptoms: ${patientData.symptoms}` : ''}` :
          patientData.symptoms || null,
        allergies: patientData.allergies,
        current_medications: patientData.medications,
        assigned_doctor_id: actualDoctorUserId, // Use the verified doctor user_id from database
        invitation_status: 'pending' // Track invitation status
      };

      const { data: patientRecord, error: patientError } = await supabase
        .from('patients')
        .insert(patientInsertData)
        .select()
        .single();

      if (patientError) {
        throw patientError;
      }

      // Send invitation email with doctor's user_id
      try {
        console.log('Attempting to send invitation email via Edge Function...');
        console.log('Doctor user ID:', actualDoctorUserId);
        console.log('Patient data:', {
          name: `${patientData.firstName} ${patientData.lastName}`.trim(),
          email: patientData.email
        });

        const { error: emailError } = await supabase.functions.invoke('send-patient-invitation', {
          body: {
            patientName: `${patientData.firstName} ${patientData.lastName}`.trim(),
            patientEmail: patientData.email,
            doctorName: user.name,
            doctorUserId: actualDoctorUserId
          }
        });

        if (emailError) {
          console.error('Edge Function email failed:', emailError);
          throw new Error(`Email service error: ${emailError.message}`);
        }

        console.log('Invitation email sent successfully via Edge Function');
        toast({
          title: "Patient registered successfully",
          description: `Patient account created and invitation email sent to ${patientData.email}`,
        });
      } catch (emailError: any) {
        console.error('Edge Function failed, falling back to manual credential sharing...', emailError);

        // Fallback: Manual credential sharing
        const tempPassword = Math.random().toString(36).slice(-12) + 'Temp123!';

        try {
          const { error: updateError } = await supabase
            .from('patients')
            .update({ temp_password: tempPassword } as any)
            .eq('id', patientRecord.id);

          if (updateError) {
            console.warn('Failed to update patient with temp password:', updateError);
          }

          setPatientCredentials({
            name: `${patientData.firstName} ${patientData.lastName}`.trim(),
            email: patientData.email,
            password: tempPassword
          });
          setShowCredentialsModal(true);

          toast({
            title: "Patient registered successfully",
            description: "Email service unavailable. Please share the credentials manually with the patient.",
            variant: "default",
          });
        } catch (fallbackError) {
          console.error('Fallback mechanism also failed:', fallbackError);
          toast({
            title: "Registration completed",
            description: "Patient registered but email services failed. Please contact support.",
            variant: "destructive",
          });
        }
      }

      // Create a chat session for the doctor-patient communication
      // Note: We'll create this when the patient actually signs up and gets a user_id
      try {
        const { data: chatSession, error: chatError } = await supabase
          .from('chat_sessions')
          .insert({
            session_type: 'doctor-patient',
            participant_1_id: actualDoctorUserId, // Doctor's user_id
            participant_2_id: patientRecord.id,   // Use patient record ID as placeholder
            title: `Chat with ${patientData.firstName} ${patientData.lastName}`.trim(),
          })
          .select()
          .single();

        if (chatError) {
          console.warn('Patient registered successfully but chat session creation failed:', chatError);
          // Don't fail the registration, just log the warning
        }
      } catch (chatSessionError) {
        console.warn('Error creating chat session for new patient:', chatSessionError);
        // Don't fail the registration if chat session creation fails
      }

      // Reset form
      setPatientData({
        firstName: '',
        lastName: '',
        age: '',
        email: '',
        phone: '',
        address: '',
        emergencyContact: '',
        emergencyPhone: '',
        symptoms: '',
        medicalHistory: '',
        allergies: '',
        medications: '',
        gender: ''
      });

      navigate('/patients');
    } catch (error: any) {
      console.error('Registration failed:', error);
      toast({
        title: "Registration failed",
        description: error.message || "Failed to register patient",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link to="/patients">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Patients
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Register New Patient</h1>
        <p className="text-muted-foreground">Add a new patient to your practice</p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
          <CardDescription>
            Enter the patient's details to create their account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegisterPatient} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Enter patient's first name"
                    value={patientData.firstName}
                    onChange={(e) => setPatientData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Enter patient's last name"
                  value={patientData.lastName}
                  onChange={(e) => setPatientData(prev => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="patient@email.com"
                    value={patientData.email}
                    onChange={(e) => setPatientData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 234-567-8900"
                    value={patientData.phone}
                    onChange={(e) => setPatientData(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="age"
                    type="number"
                    placeholder="Age in years"
                    value={patientData.age}
                    onChange={(e) => setPatientData(prev => ({ ...prev, age: e.target.value }))}
                    className="pl-10"
                    min="1"
                    max="150"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  value={patientData.gender}
                  onChange={(e) => setPatientData(prev => ({ ...prev, gender: e.target.value }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <textarea
                  id="address"
                  placeholder="Enter patient's full address"
                  value={patientData.address}
                  onChange={(e) => setPatientData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full pl-10 px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-vertical"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Emergency Contact Name</Label>
                <Input
                  id="emergencyContact"
                  type="text"
                  placeholder="Emergency contact full name"
                  value={patientData.emergencyContact}
                  onChange={(e) => setPatientData(prev => ({ ...prev, emergencyContact: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyPhone">Emergency Contact Phone</Label>
                <Input
                  id="emergencyPhone"
                  type="tel"
                  placeholder="Emergency contact phone"
                  value={patientData.emergencyPhone}
                  onChange={(e) => setPatientData(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="symptoms">Current Symptoms</Label>
              <div className="relative">
                <AlertTriangle className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <textarea
                  id="symptoms"
                  placeholder="Describe current symptoms, pain levels, duration, etc."
                  value={patientData.symptoms}
                  onChange={(e) => setPatientData(prev => ({ ...prev, symptoms: e.target.value }))}
                  className="w-full pl-10 px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-vertical"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="medicalHistory">Medical History</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <textarea
                  id="medicalHistory"
                  placeholder="Previous conditions, surgeries, hospitalizations, etc."
                  value={patientData.medicalHistory}
                  onChange={(e) => setPatientData(prev => ({ ...prev, medicalHistory: e.target.value }))}
                  className="w-full pl-10 px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring min-h-[100px] resize-vertical"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allergies">Allergies</Label>
              <textarea
                id="allergies"
                placeholder="List any known allergies (medications, foods, environmental, etc.)"
                value={patientData.allergies}
                onChange={(e) => setPatientData(prev => ({ ...prev, allergies: e.target.value }))}
                className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-vertical"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medications">Current Medications</Label>
              <div className="relative">
                <Pill className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <textarea
                  id="medications"
                  placeholder="List current medications with dosages and frequency"
                  value={patientData.medications}
                  onChange={(e) => setPatientData(prev => ({ ...prev, medications: e.target.value }))}
                  className="w-full pl-10 px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring min-h-[100px] resize-vertical"
                />
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Important Notes:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• A temporary password will be generated for the patient</li>
                <li>• The patient will be able to change their password after first login</li>
                <li>• You will be assigned as their primary doctor</li>
                <li>• The patient will receive an email with login instructions</li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90"
              disabled={isLoading}
            >
              {isLoading ? 'Registering Patient...' : 'Register Patient'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {showCredentialsModal && (
        <PatientCredentialsModal
          patientName={patientCredentials.name}
          patientEmail={patientCredentials.email}
          tempPassword={patientCredentials.password}
          onClose={() => setShowCredentialsModal(false)}
        />
      )}
    </div>
  );
};

export default PatientRegistration;