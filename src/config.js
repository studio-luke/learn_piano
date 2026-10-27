// ===== Site configuration =====
// Supabase project (Dashboard → Project Settings → API). Leave both empty to run without accounts:
// the log-in button stays hidden and the trainer works as before.
// supabaseKey must be the PUBLIC key ("anon" / "publishable"). This file is published with the site —
// never put the service_role / secret key here (npm test fails if you do).
const CONFIG = {
  supabaseUrl: "https://joxtekvxbivcvreyjhrv.supabase.co",
  supabaseKey: "sb_publishable_R-IxJhURzrREQIdFC7hvhg_NHCritIT",
};
if (typeof module !== "undefined") module.exports = CONFIG;
