import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitePatientRequest {
  patientEmail: string;
  patientName: string;
  doctorName: string;
  doctorId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patientEmail, patientName, doctorName, doctorId }: InvitePatientRequest = await req.json();

    console.log('Inviting patient:', { patientEmail, patientName, doctorName });

    const clerkSecretKey = Deno.env.get("CLERK_SECRET_KEY");
    if (!clerkSecretKey) {
      throw new Error("CLERK_SECRET_KEY not configured");
    }

    // Create patient account using Clerk API
    const clerkResponse = await fetch("https://api.clerk.com/v1/invitations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: patientEmail,
        public_metadata: {
          name: patientName,
          role: "patient",
          invited_by: doctorId,
          doctor_name: doctorName,
        },
        redirect_url: `${Deno.env.get("SITE_URL") || "https://docplusassist.vercel.app"}/signin`,
      }),
    });

    if (!clerkResponse.ok) {
      const errorData = await clerkResponse.text();
      console.error("Clerk API error:", errorData);
      throw new Error(`Failed to create patient invitation: ${clerkResponse.status}`);
    }

    const invitationData = await clerkResponse.json();
    console.log("Patient invitation created:", invitationData);

    return new Response(JSON.stringify({
      success: true,
      invitation_id: invitationData.id,
      message: "Patient invitation sent successfully"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in invite-patient function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
