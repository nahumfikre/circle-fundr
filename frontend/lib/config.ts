// Direct access to environment variables (required for Next.js to inline them)
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL;

// Validate that required environment variables are set
if (!API_URL) {
  throw new Error(
    "FATAL: Required environment variable NEXT_PUBLIC_API_URL is not set. Please check your .env.local file."
  );
}

// Validate URL formats
try {
  new URL(API_URL);
  if (FRONTEND_URL) {
    new URL(FRONTEND_URL);
  }
} catch (error) {
  throw new Error("FATAL: NEXT_PUBLIC_API_URL or NEXT_PUBLIC_FRONTEND_URL is not a valid URL");
}

export const config = {
  apiUrl: API_URL,
  frontendUrl: FRONTEND_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
};
