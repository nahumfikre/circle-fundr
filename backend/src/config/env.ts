import dotenv from "dotenv";

dotenv.config();

// Helper function to get required environment variable
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`FATAL: Required environment variable ${key} is not set. Please check your .env file.`);
  }
  return value;
}

// Helper function to get optional environment variable
function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// Validate all required environment variables at startup
console.log("\n🔍 Validating environment variables...");

// Required variables
const databaseUrl = getRequiredEnv("DATABASE_URL");
const jwtSecret = getRequiredEnv("JWT_SECRET");
const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
const stripeWebhookSecret = getRequiredEnv("STRIPE_WEBHOOK_SECRET");
const frontendUrl = getRequiredEnv("FRONTEND_URL");

// JWT Secret security check
if (jwtSecret === "change-me" || jwtSecret === "dev-secret-change-later" || jwtSecret.length < 32) {
  throw new Error("FATAL: JWT_SECRET is too weak or using a default value. Use a strong, randomly generated secret (at least 32 characters).");
}

// Session secret (required for Google OAuth)
const sessionSecret = getRequiredEnv("SESSION_SECRET");
if (sessionSecret === "change-me-session-secret" || sessionSecret === "secret_session_key_nobody_will_find" || sessionSecret.length < 32) {
  throw new Error("FATAL: SESSION_SECRET is too weak or using a default value. Use a strong, randomly generated secret (at least 32 characters).");
}

// Google OAuth credentials
const googleClientId = getRequiredEnv("GOOGLE_CLIENT_ID");
const googleClientSecret = getRequiredEnv("GOOGLE_CLIENT_SECRET");

if (googleClientId === "your_google_client_id_here" || googleClientSecret === "your_google_client_secret_here") {
  throw new Error("FATAL: Google OAuth credentials are not properly configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.");
}

// Email configuration (required for email verification)
const emailHost = getRequiredEnv("EMAIL_HOST");
const emailUser = getRequiredEnv("EMAIL_USER");
const emailPassword = getRequiredEnv("EMAIL_PASSWORD");
const emailFrom = getRequiredEnv("EMAIL_FROM");

// Optional with defaults
const nodeEnv = getOptionalEnv("NODE_ENV", "development");
const port = parseInt(getOptionalEnv("PORT", "4000"), 10);
const emailPort = parseInt(getOptionalEnv("EMAIL_PORT", "587"), 10);

console.log("✅ All required environment variables are set and valid");
console.log(`   - Database: ${databaseUrl.substring(0, 20)}...`);
console.log(`   - JWT Secret: ${jwtSecret.length} characters`);
console.log(`   - Session Secret: ${sessionSecret.length} characters`);
console.log(`   - Frontend URL: ${frontendUrl}`);
console.log(`   - Stripe: Configured`);
console.log(`   - Google OAuth: Configured`);
console.log(`   - Email: ${emailUser}`);
console.log("✅ Environment validation complete\n");

export const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port,
  jwtSecret,
  databaseUrl,
  stripeSecretKey,
  stripeWebhookSecret,
  frontendUrl,
  googleClientId,
  googleClientSecret,
  sessionSecret,
  emailHost,
  emailPort,
  emailUser,
  emailPassword,
  emailFrom,
};
