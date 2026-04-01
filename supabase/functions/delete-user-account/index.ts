import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No token" }), { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user" }), { status: 401 });
    }

    const userId = user.id;

    // Delete dependent data FIRST
    const { data: requests } = await supabase
      .from("seat_requests")
      .select("id")
      .eq("user_id", userId);

    const requestIds = requests?.map(r => r.id) || [];

    if (requestIds.length > 0) {
      await supabase
        .from("seat_matches")
        .delete()
        .or(`request_a_id.in.(${requestIds.join(",")}),request_b_id.in.(${requestIds.join(",")})`);
    }

    // Delete seat requests
    await supabase
      .from("seat_requests")
      .delete()
      .eq("user_id", userId);

    // Delete swap logs (if exists)
    await supabase
      .from("swap_logs")
      .delete()
      .eq("user_id", userId);

    // Delete auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(JSON.stringify({ message: "Account deleted successfully" }), {
      status: 200
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
