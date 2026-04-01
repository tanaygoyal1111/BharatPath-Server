import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts"

serve(async (req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    // 1. Get the incoming body
    const body = await req.json()
    console.log("Incoming Request Body:", body);
    
    // 2. Strict Auth Validation
    const authHeader = req.headers.get('Authorization')
    console.log("Auth Header:", authHeader)

    if (!authHeader) {
      throw new Error("Missing Authorization header")
    }

    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token)

    if (authError || !user) {
      throw new Error("Invalid JWT")
    }

    const final_user_id = user.id
    console.log("User:", user?.id)

    // 3. Get the PNR from the body
    const pnr = body.pnr || body.pnr_number;
    if (!pnr) throw new Error("PNR is required");

    // 4. Secure PNR Hashing
    const msgUint8 = new TextEncoder().encode(pnr + (Deno.env.get('PNR_SECRET_KEY') ?? 'dev_secret'));
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const pnrHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    // 5. Strict Database Mapping
    const payload = {
      train_number: body.train_number || body.trainNumber,
      journey_date: body.journey_date || body.journeyDate,
      train_class: body.train_class || body.trainClass,
      coach: body.coach,
      seat_no: body.seat_no || body.seatNo,
      berth_type: body.berth_type || body.berthType,
      preference: body.preference,
      pnr_hash: pnrHash // Secure hash
    }
    
    console.log("Mapped Database Payload:", payload);

    console.log("Creating request for user:", final_user_id);
    const { data: existingRequests } = await supabaseAdmin
      .from('seat_requests')
      .select('id')
      .eq('user_id', final_user_id)
      .eq('status', 'OPEN');

    if (existingRequests && existingRequests.length > 0) {
      throw new Error("You already have an active seat request");
    }

    // 6. Insert data
    const { data, error } = await supabaseAdmin
      .from('seat_requests')
      .insert([{
        ...payload,
        user_id: final_user_id
      }])
      .select()
      
    if (error) {
      console.error("Database Insert Error:", error);
      throw error
    }

    // Clean 200 OK
    return new Response(JSON.stringify({ success: true, data }), { 
      headers: { "Content-Type": "application/json" },
      status: 200 
    })

  } catch (err: any) {
    console.error("Function Error:", err);
    // Descriptive 500 error
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { "Content-Type": "application/json" },
      status: 500 
    })
  }
})
