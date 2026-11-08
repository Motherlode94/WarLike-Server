import vinext from 'vinext';
import {defineConfig} from 'vite';
import {cloudflare} from '@cloudflare/vite-plugin';

// Build the existing application for Cloudflare without the Sites hosting plugin.
// A separate Worker is attached to the existing Pages project via a service binding.
export default defineConfig({plugins:[vinext(),cloudflare({viteEnvironment:{name:'rsc',childEnvironments:['ssr']},config:{
 name:'warlike-server-runtime',main:'./worker/index.ts',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],
 vars:{WARLIKE_AUTH_ENABLED:'true'},
 d1_databases:[{binding:'DB',database_name:'warlike-server',database_id:'b8337ecf-b94e-421e-9c31-08a9a08ec868'}],
 assets:{binding:'ASSETS'},
}})]});
