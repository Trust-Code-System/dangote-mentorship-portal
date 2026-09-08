import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

const results = {};
let failed = false;

const prisma = new PrismaClient();
try {
  const [users, cohorts, messages] = await Promise.all([
    prisma.user.count(),
    prisma.cohort.count(),
    prisma.message.count(),
  ]);
  results.database = { reachable: true, users, cohorts, messages };
} catch (error) {
  failed = true;
  results.database = {
    reachable: false,
    error: error instanceof Error ? error.message.split('\n').at(-1) : 'unknown error',
  };
} finally {
  await prisma.$disconnect();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'portal-files';

if (!supabaseUrl || !supabaseSecret) {
  failed = true;
  results.storage = { reachable: false, error: 'not configured' };
} else {
  try {
    const supabase = createClient(supabaseUrl, supabaseSecret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.storage.getBucket(bucket);
    if (error) throw error;
    results.storage = { reachable: true, private: data.public === false };
  } catch (error) {
    failed = true;
    results.storage = {
      reachable: false,
      error: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

console.log(JSON.stringify(results, null, 2));
if (failed) process.exitCode = 1;
