import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Heart, Stethoscope, AlertCircle, Search, CheckCircle } from 'lucide-react';

interface Doctor {
  id: string;
  user_id: string;
  name: string;
  username: string;
}

const PatientOnboardingPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [invitedDoctor, setInvitedDoctor] = useState<Doctor | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [searchedDoctor, setSearchedDoctor] = useState<Doctor | null>(null);
  const [doctorSearchError, setDoctorSearchError] = useState<string | null>(null);
  const [isSearchingDoctor, setIsSearchingDoctor] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.fullName || '',
    age: '',
    gender: '',
    phone: '',
    medicalHistory: '',
    assignedDoctorId: '',
  });

  useEffect(() => {
    loadDoctors();
    checkInvitation();
  }, []);

  const checkInvitation = async () => {
    const doctorId = searchParams.get('doctorId');
    console.log('🔍 PatientOnboardingPage - Checking invitation with doctorId:', doctorId);

    if (!doctorId) {
      console.log('❌ PatientOnboardingPage - No doctorId parameter found');
      return;
    }

    try {
      console.log('🔍 PatientOnboardingPage - Looking up doctor with user_id:', doctorId);

      // Check if this doctor exists
      const { data: doctor, error } = await supabase
        .from('doctors')
        .select('id, user_id, name, username')
        .eq('user_id', doctorId)
        .single();

      console.log('🔍 PatientOnboardingPage - Doctor lookup result:', { doctor, error });

      if (error || !doctor) {
        console.log('❌ PatientOnboardingPage - Doctor lookup failed:', error);
        setInvitationError('Invalid invitation link. The doctor may not exist or the invitation may have expired.');
        return;
      }

      setInvitedDoctor(doctor);
      setFormData(prev => ({ ...prev, assignedDoctorId: doctor.user_id }));
      console.log('✅ PatientOnboardingPage - Doctor found:', doctor.name);

      toast({
        title: "Invitation Found",
        description: `You've been invited by Dr. ${doctor.name}`,
      });
    } catch (error) {
      console.error('❌ PatientOnboardingPage - Error checking invitation:', error);
      setInvitationError('Failed to validate invitation. Please contact your doctor.');
    }
  };

  const loadDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('id, user_id, name, username')
        .order('name');

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error('Error loading doctors:', error);
      toast({
        title: "Error",
        description: "Failed to load doctors list",
        variant: "destructive",
      });
    }
  };

  const searchDoctorById = async (doctorId: string) => {
    if (!doctorId.trim()) {
      setSearchedDoctor(null);
      setDoctorSearchError(null);
      return;
    }

    setIsSearchingDoctor(true);
    setDoctorSearchError(null);

    try {
      console.log('🔍 Searching for doctor with ID:', doctorId);

      const { data: doctor, error } = await supabase
        .from('doctors')
        .select('id, user_id, name, username')
        .eq('user_id', doctorId.trim())
        .single();

      if (error || !doctor) {
        console.log('❌ Doctor not found:', error);
        setSearchedDoctor(null);
        setDoctorSearchError('Doctor not found. Please check the ID and try again.');
        return;
      }

      console.log('✅ Doctor found:', doctor);
      setSearchedDoctor(doctor);
      setFormData(prev => ({ ...prev, assignedDoctorId: doctor.user_id }));

      toast({
        title: "Doctor Found",
        description: `Dr. ${doctor.name} has been assigned to you.`,
      });
    } catch (error) {
      console.error('Error searching doctor:', error);
      setSearchedDoctor(null);
      setDoctorSearchError('Failed to search for doctor. Please try again.');
    } finally {
      setIsSearchingDoctor(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Validate assigned doctor if not from invitation
      if (!invitedDoctor && formData.assignedDoctorId && !searchedDoctor) {
        throw new Error('Please search and verify your doctor before submitting');
      }

      const patientEmail = user.primaryEmailAddress?.emailAddress;
      let patientData;

      if (invitedDoctor && patientEmail) {
        // Update existing patient record from invitation
        const updateData = {
          clerk_user_id: user.id,
          name: formData.name,
          age: formData.age ? parseInt(formData.age) : null,
          gender: formData.gender || null,
          phone: formData.phone || null,
          medical_history: formData.medicalHistory || null,
          invitation_status: 'completed',
          user_id: user.id,
        };

        const updateResult: any = await (supabase as any)
          .from('patients')
          .update(updateData)
          .eq('email', patientEmail)
          .eq('assigned_doctor_id', invitedDoctor.user_id)
          .eq('invitation_status', 'pending')
          .select()
          .single();

        const data = updateResult.data;
        const error = updateResult.error;

        if (error) throw error;
        patientData = data;
      } else {
        // Create new patient profile (regular signup)
        const insertData = {
          clerk_user_id: user.id,
          name: formData.name,
          email: patientEmail,
          age: formData.age ? parseInt(formData.age) : null,
          gender: formData.gender || null,
          phone: formData.phone || null,
          medical_history: formData.medicalHistory || null,
          assigned_doctor_id: formData.assignedDoctorId || null,
          user_id: user.id,
        };

        const { data, error } = await supabase
          .from('patients')
          .insert(insertData as any)
          .select()
          .single();

        if (error) throw error;
        patientData = data;
      }

      // Update Clerk user metadata to mark onboarding as complete
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          role: 'patient',
          onboardingComplete: true,
          patientProfileId: patientData.id,
        },
      });

      toast({
        title: "Registration Complete!",
        description: "Welcome to Doc+, " + formData.name,
      });

      // Redirect to patient dashboard
      navigate('/dashboard/patient');

    } catch (error: any) {
      console.error('Error creating patient profile:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Heart className="h-12 w-12 text-primary mr-2" />
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Doc+
            </h1>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Patient Registration</h2>
          <p className="text-muted-foreground mt-2">
            Complete your profile to start your healthcare journey
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Please provide your personal and medical information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitationError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Invitation Error</span>
                </div>
                <p className="text-red-700 text-sm mt-1">{invitationError}</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={formData.age}
                    onChange={(e) => handleInputChange('age', e.target.value)}
                    placeholder="25"
                    min="1"
                    max="120"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              {/* Doctor Assignment */}
              <div className="space-y-2">
                <Label htmlFor="assignedDoctorId">Assigned Doctor ID *</Label>
                {invitedDoctor ? (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center gap-2 text-blue-800">
                      <Stethoscope className="h-4 w-4" />
                      <span className="font-medium">Dr. {invitedDoctor.name}</span>
                      <span className="text-sm text-blue-600">(Invited by this doctor)</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        id="assignedDoctorId"
                        value={formData.assignedDoctorId}
                        onChange={(e) => {
                          handleInputChange('assignedDoctorId', e.target.value);
                          // Clear previous search results when user types
                          if (searchedDoctor && e.target.value !== searchedDoctor.user_id) {
                            setSearchedDoctor(null);
                            setDoctorSearchError(null);
                          }
                        }}
                        placeholder="Enter doctor's ID"
                        required
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => searchDoctorById(formData.assignedDoctorId)}
                        disabled={isSearchingDoctor || !formData.assignedDoctorId.trim()}
                      >
                        {isSearchingDoctor ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {doctorSearchError && (
                      <div className="flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        {doctorSearchError}
                      </div>
                    )}

                    {searchedDoctor && (
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">Dr. {searchedDoctor.name}</span>
                        <span className="text-green-500">found and assigned</span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {invitedDoctor
                    ? "You've been invited by this doctor to join their practice"
                    : "Enter your doctor's ID and click search to verify and assign them"
                  }
                </p>
              </div>

              {/* Medical History */}
              <div className="space-y-2">
                <Label htmlFor="medicalHistory">Medical History</Label>
                <Textarea
                  id="medicalHistory"
                  value={formData.medicalHistory}
                  onChange={(e) => handleInputChange('medicalHistory', e.target.value)}
                  placeholder="Please describe any relevant medical history, conditions, or medications..."
                  className="min-h-[100px]"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:opacity-90"
                disabled={isLoading}
              >
                {isLoading ? 'Creating Profile...' : 'Complete Registration'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PatientOnboardingPage;
