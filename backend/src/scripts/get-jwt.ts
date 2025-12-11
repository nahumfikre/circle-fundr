import jwt from "jsonwebtoken";
import { env } from "../config/env";
import prisma from "../config/prisma";

/**
 * Helper script to generate a JWT token for testing
 * Usage: npx tsx src/scripts/get-jwt.ts your@email.com
 */
async function generateTestJWT() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: npx tsx src/scripts/get-jwt.ts your@email.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`❌ User with email ${email} not found`);
    process.exit(1);
  }

  const token = jwt.sign({ userId: user.id }, env.jwtSecret, {
    expiresIn: "7d",
  });

  console.log("\n✅ JWT Token generated:");
  console.log(token);
  console.log("\n📋 User Info:");
  console.log(`   ID: ${user.id}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Email: ${user.email}`);
  console.log("\n🧪 Test with curl:");
  console.log(`   curl -X GET http://localhost:4000/connect/status \\`);
  console.log(`     -H "Authorization: Bearer ${token}"`);
  console.log("\n");
}

generateTestJWT()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
