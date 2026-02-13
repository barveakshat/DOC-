-- Add invitation_id column to patients table for Clerk invitations
-- This column stores the Clerk invitation ID until the patient accepts and creates their account

DO $$
BEGIN
    -- Check if invitation_id column exists, if not add it
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'patients'
        AND column_name = 'invitation_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.patients ADD COLUMN invitation_id TEXT UNIQUE;
        CREATE INDEX IF NOT EXISTS idx_patients_invitation_id ON public.patients(invitation_id);
    END IF;
END $$;
