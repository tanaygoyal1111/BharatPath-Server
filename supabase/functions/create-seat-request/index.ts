import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts"

serve(async (req) => {
  try {
    // Admin Privileges: Initialize using SUPABASE_SERVICE_ROLE_KEY to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get the incoming body
    const body = await req.json()
    console.log("Incoming Request Body:", body);
    
    // 2. Hybrid Authentication
    const authHeader = req.headers.get('Authorization')
    let final_user_id = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (user) {
        final_user_id = user.id
      } else {
        console.log("Auth header provided but user lookup failed:", authError)
      }
    }

    if (!final_user_id) {
       // Fallback to body.user_id if no valid auth header
       final_user_id = body.user_id || body.userId;
    }
    
    if (!final_user_id) {
      throw new Error("No user_id found in Auth header or Request body")
    }

    // 3. Get the PNR from the body
    const pnr = body.pnr || body.pnr_number;
    if (!pnr) throw new Error("PNR is required");

    // 4. Secure PNR Hashing
    const msgUint8 = new TextEncoder().encode(pnr + (Deno.env.get('PNR_SECRET_KEY') ?? 'dev_secret'));
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const pnrHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    // 5. Strict Database Mapping
    const payload = {
      user_id: final_user_id,
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

    // 6. Insert data
    const { data, error } = await supabase
      .from('seat_requests')
      .insert([payload])
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
