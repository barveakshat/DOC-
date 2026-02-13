import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Stethoscope, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DoctorInfo {
  id: string;
  name: string;
  registration_no?: string;
}

const PatientDashboard = () => {
  const { user } = useAuth();
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const recentActivity = [
    { type: 'AI Chat', message: 'Stress relief session completed', time: '2 hours ago', status: 'completed' },
    { type: 'Doctor', message: doctorInfo ? `Dr. ${doctorInfo.name} sent you a message` : 'Doctor sent you a message', time: '1 day ago', status: 'new' },
    { type: 'AI Chat', message: 'Mood tracking update', time: '2 days ago', status: 'completed' },
  ];

  // Load assigned doctor information
  useEffect(() => {
    if (user?.user_id) {
      loadDoctorInfo();
    }
  }, [user]);

  const loadDoctorInfo = async () => {
    if (!user?.user_id) return;

    try {
      setLoading(true);

      // Get patient's assigned doctor
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('assigned_doctor_id')
        .eq('user_id', user.id)
        .single();

      if (patientError) {
        console.error('Error fetching patient data:', patientError);
        console.log('Patient user_id being searched:', user.id);

        if (patientError.code === 'PGRST116') {
          // Patient record doesn't exist - create it automatically
          console.log('Creating patient record for user:', user.id);

          // First, try to find an available doctor to assign
          const { data: availableDoctor, error: findDoctorError } = await supabase
            .from('doctors')
            .select('user_id')
            .limit(1)
            .single();

          const doctorId = availableDoctor?.user_id || null;

          const { data: newPatient, error: createError } = await supabase
            .from('patients')
            .insert({
              user_id: user.id,
              name: user.name || 'Patient',
              email: user.email || '',
              phone: '',
              age: null,
              gender: '',
              address: '',
              emergency_contact_name: '',
              emergency_contact_phone: '',
              medical_history: '',
              allergies: '',
              current_medications: '',
              assigned_doctor_id: doctorId // Use available doctor or null if none found
            })
            .select('assigned_doctor_id')
            .single();

          if (createError) {
            console.error('Error creating patient record:', createError);
            // Don't show error to user, just continue without doctor info
            setLoading(false);
            return;
          }

          console.log('Patient record created:', newPatient);
          // Continue with the newly created patient data
          if (!newPatient?.assigned_doctor_id) {
            setLoading(false);
            return;
          }

          // Get doctor details for the newly created patient - use safe bulk query approach
          const { data: doctors } = await supabase
            .from('doctors')
            .select('id, name, registration_no, user_id')
            .limit(10);

          const doctorData = doctors?.find(d => d.user_id === newPatient.assigned_doctor_id);

          if (!doctorData) {
            console.error('Doctor not found for new patient');
            // Don't show error to user, just continue without doctor info
          } else {
            setDoctorInfo(doctorData);
          }
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }

      if (patientData?.assigned_doctor_id) {
        // Get doctor details - use safe bulk query approach
        const { data: doctors } = await supabase
          .from('doctors')
          .select('id, name, registration_no, user_id')
          .limit(10);

        const doctorData = doctors?.find(d => d.user_id === patientData.assigned_doctor_id);

        if (!doctorData) {
          console.error('Doctor not found for patient');
          // Don't show error to user, just continue without doctor info
        } else {
          setDoctorInfo(doctorData);
        }
      }
    } catch (error) {
      console.error('Error loading doctor info:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Patient Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Assigned Doctor</p>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-24 mb-1"></div>
              <div className="h-3 bg-muted rounded w-16"></div>
            </div>
          ) : doctorInfo ? (
            <div>
              <p className="font-medium">Dr. {doctorInfo.name}</p>
              {doctorInfo.registration_no && (
                <p className="text-xs text-muted-foreground">Reg: {doctorInfo.registration_no}</p>
              )}
            </div>
          ) : (
            <div>
              <p className="font-medium text-muted-foreground">Not Assigned</p>
              <p className="text-xs text-muted-foreground">Contact clinic</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.slice(0, 3).map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.status === 'new' ? 'bg-primary' : 'bg-muted-foreground'
                  }`}></div>
                  <div>
                    <p className="font-medium">{activity.message}</p>
                    <p className="text-sm text-muted-foreground">{activity.type} • {activity.time}</p>
                  </div>
                </div>
                {activity.status === 'new' && (
                  <span className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded-full">
                    New
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientDashboard;