/**
 * Environment loader for tsx scripts
 *
 * This ensures .env.local is loaded before running any script.
 * Usage: tsx -r ./load-env.ts scripts/your-script.ts
 */

import { config } from "dotenv"

// Load .env.local first
const localResult = config({ path: ".env.local" })

// Then load .env (which can override .env.local values if needed)
config({ override: false })

console.log(`[Env] Loaded environment from .env.local and .env`)
