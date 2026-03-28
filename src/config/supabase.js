const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  logger.warn('Supabase URL or Anon Key is missing. Supabase functionality will be disabled.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;
