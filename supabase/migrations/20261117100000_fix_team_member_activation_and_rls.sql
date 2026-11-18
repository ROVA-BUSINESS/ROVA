/*
  # Fix Team Member Activation & RLS Policies

  1. Security & Functional Fixes:
    - Allow invited team members to view their pending membership records even before member_id is linked (matching on invite_email).
    - Allow team members to update their own team_members record to 'active' status upon onboarding/activation.
    - Provide an atomic RPC function `activate_team_member()` with SECURITY DEFINER to safely bind member_id and activate status.

  2. Policies Updated:
    - "Owners and members can view team": SELECT policy updated to include (lower(invite_email) = lower(auth.jwt() ->> 'email')).
    - "Owners or members can update team members": UPDATE policy updated to allow members to accept invites and activate themselves.
*/

-- 1. Create or replace secure RPC function to activate team membership
CREATE OR REPLACE FUNCTION public.activate_team_member()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_member team_members%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Locate the team member record by member_id or invite_email
  SELECT * INTO v_member
  FROM public.team_members
  WHERE (member_id = v_user_id OR (invite_email IS NOT NULL AND lower(invite_email) = lower(v_email)))
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'No pending invitation found for this user');
  END IF;

  -- Update status to active and ensure member_id and joined_at are populated
  UPDATE public.team_members
  SET 
    status = 'active',
    member_id = v_user_id,
    joined_at = COALESCE(joined_at, now())
  WHERE id = v_member.id;

  RETURN json_build_object(
    'success', true,
    'id', v_member.id,
    'role', v_member.role,
    'status', 'active'
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.activate_team_member() TO authenticated;

-- 2. Update SELECT policy on team_members
DROP POLICY IF EXISTS "Owners can view their team" ON public.team_members;
DROP POLICY IF EXISTS "Owners and members can view team" ON public.team_members;

CREATE POLICY "Owners and members can view team"
  ON public.team_members FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_id 
    OR auth.uid() = member_id 
    OR (invite_email IS NOT NULL AND lower(invite_email) = lower(auth.jwt() ->> 'email'))
  );

-- 3. Update UPDATE policy on team_members
DROP POLICY IF EXISTS "Owners can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Owners or members can update team members" ON public.team_members;

CREATE POLICY "Owners or members can update team members"
  ON public.team_members FOR UPDATE TO authenticated
  USING (
    auth.uid() = owner_id 
    OR auth.uid() = member_id 
    OR (invite_email IS NOT NULL AND lower(invite_email) = lower(auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    auth.uid() = owner_id 
    OR auth.uid() = member_id 
    OR (invite_email IS NOT NULL AND lower(invite_email) = lower(auth.jwt() ->> 'email'))
  );
