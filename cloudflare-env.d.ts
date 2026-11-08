declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    WARLIKE_OWNER_EMAIL?: string;
    WARLIKE_BRIDGE_KEY?: string;
    WARLIKE_AUTH_ENABLED?: string;
    BUCKET?: R2Bucket;
  }
}
