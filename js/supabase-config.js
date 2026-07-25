/* =========================================================
   PrecoTech237 — Configuration Supabase
   ========================================================= */

const SUPABASE_URL = "https://vflrsafjzocghqcnergg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbHJzYWZqem9jZ2hxY25lcmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NDMyNTUsImV4cCI6MjEwMDQxOTI1NX0.opPM-Q9moHXJIDFNUnM3BzXhB3LE3mo7O2yjHDDyBIY";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
