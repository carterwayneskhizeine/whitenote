/**
 * Environment loader for tsx scripts
 *
 * This ensures .env is loaded before running any script.
 * Usage: tsx -r ./load-env.ts scripts/your-script.ts
 */

import { config } from "dotenv"

config()

console.log(`[Env] Loaded environment from .env`)
