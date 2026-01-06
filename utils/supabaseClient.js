    import { createClient } from '@supabase/supabase-js';
    import 'dotenv/config'; // If using dotenv for environment variables

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase URL or Key is not defined in environment variables.');
      process.exit(1); // Exit if critical environment variables are missing
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    export default supabase;