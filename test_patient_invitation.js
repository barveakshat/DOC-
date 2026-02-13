// Test script for patient invitation flow
// Run this with: node test_patient_invitation.js

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPatientInvitation() {
  console.log('🧪 Testing patient invitation flow...');
  console.log('📧 Using Supabase URL:', supabaseUrl);

  try {
    // Test the invite-patient function
    console.log('📤 Sending invitation request...');
    const { data, error } = await supabase.functions.invoke('invite-patient', {
      body: {
        patientEmail: 'test-patient@example.com',
        patientName: 'Test Patient',
        doctorName: 'Dr. Test',
        doctorId: 'test-doctor-id'
      }
    });

    if (error) {
      console.error('❌ Invitation failed:', error);
      console.log('💡 This might be because:');
      console.log('   - CLERK_SECRET_KEY is not set in Supabase environment');
      console.log('   - The invite-patient function is not deployed');
      console.log('   - Clerk API is not accessible');
      return;
    }

    console.log('✅ Invitation created successfully:', data);

    // Check if patient record was created in database
    console.log('🔍 Checking if patient record was created...');
    const { data: patients, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('email', 'test-patient@example.com')
      .limit(1);

    if (patientError) {
      console.error('❌ Error checking patient record:', patientError);
      return;
    }

    if (patients && patients.length > 0) {
      console.log('✅ Patient record found:', patients[0]);
    } else {
      console.log('⚠️ No patient record found - this might be expected if the function failed');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

testPatientInvitation();
