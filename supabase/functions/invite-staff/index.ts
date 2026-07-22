import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    // Verify requester
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requester }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !requester) {
      throw new Error('Unauthorized')
    }

    // Since we only want admins to invite staff, we check if requester is staff
    const { data: requesterTeamMember } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('invite_email', requester.email)
      .maybeSingle()

    if (requesterTeamMember?.role === 'staff') {
      throw new Error('Staff members cannot invite new staff')
    }

    // Helper to query database rate limits as fallback
    async function checkDbRateLimit(uId: string, endpoint: string, maxHits: number, windowSecs: number): Promise<boolean> {
      const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
        p_user_id: uId,
        p_endpoint: endpoint,
        p_max_hits: maxHits,
        p_window_seconds: windowSecs,
      });
      if (error) {
        console.warn(`Database rate limiter fallback error for ${endpoint}:`, error.message);
        return false; // Fail open
      }
      return !!data;
    }

    // Rate Limiting Check: Try Upstash Redis first, fallback to Database
    let limitExceeded = false;
    const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

    if (redisUrl && redisToken) {
      try {
        const windowStart = Math.floor(Date.now() / 60000); // 1-minute window
        const key = `rate:invite-staff:${requester.id}:${windowStart}`;

        const redisRes = await fetch(`${redisUrl}/incr/${key}`, {
          headers: { Authorization: `Bearer ${redisToken}` },
        });

        if (redisRes.ok) {
          const { result: hits } = await redisRes.json();
          if (hits === 1) {
            await fetch(`${redisUrl}/expire/${key}/60`, {
              headers: { Authorization: `Bearer ${redisToken}` },
            });
          }
          limitExceeded = hits > 5;
          console.log(`Redis rate limiter (invite-staff): hits=${hits}/5`);
        } else {
          throw new Error(`Redis HTTP error: ${redisRes.status}`);
        }
      } catch (redisErr) {
        console.warn("Redis rate limiter failed in invite-staff, falling back to Database:", redisErr.message);
        limitExceeded = await checkDbRateLimit(requester.id, "invite-staff", 5, 60);
      }
    } else {
      limitExceeded = await checkDbRateLimit(requester.id, "invite-staff", 5, 60);
    }

    if (limitExceeded) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. You can only invite up to 5 staff members per minute." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { email, fullName, role, redirectTo } = await req.json()

    if (!email || !fullName) {
      throw new Error('Email and full name are required')
    }

    const memberRole = role === 'admin' ? 'admin' : 'staff'

    // Invite the user
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo
    })

    if (inviteError) {
      throw inviteError
    }

    const newUserId = inviteData.user.id

    // Insert into team_members
    const { error: teamError } = await supabaseAdmin.from('team_members').insert({
      owner_id: requester.id,
      member_id: newUserId,
      invite_email: email,
      role: memberRole,
      status: 'pending',
    })

    if (teamError) {
      throw teamError
    }

    // Log activity
    await supabaseAdmin.from('activity_logs').insert({
      user_id: requester.id,
      owner_id: requester.id,
      action: 'created',
      entity_type: 'staff_account',
      entity_label: email,
      metadata: { role: 'staff' },
    })

    return new Response(JSON.stringify({ success: true, user: inviteData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
