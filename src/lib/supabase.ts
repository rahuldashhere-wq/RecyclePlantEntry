import { createClient } from "@supabase/supabase-js";

// The anon key is MEANT to be public — it's safe in client code as long as
// Row Level Security (see supabase/schema.sql) locks down what it can touch.
// admin_settings has zero direct policies, so this key cannot read/write it
// no matter what — only the SECURITY DEFINER RPC functions can, and those
// check the passcode first.
const SUPABASE_URL = "https://pqnbuyednsfuikuklavd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmJ1eWVkbnNmdWlrdWtsYXZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMDMxMzksImV4cCI6MjA5ODc3OTEzOX0.6QG6TEUm_fhy6eHmpx0M94cJq1exEYjLb-yu2Xx23G0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
