import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase Admin Client - Uses Service Role Key
// NEVER expose this client to the frontend
// This client bypasses Row Level Security

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Helper function to get a branch-scoped query
export function getBranchQuery(table: string, branchId: string) {
  return supabaseAdmin.from(table).select('*').eq('branch_id', branchId);
}

// Helper function to check database connection
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from('branches').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export default supabaseAdmin;