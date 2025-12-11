import nodemailer from "nodemailer";
import { env } from "../config/env";

let transporter: nodemailer.Transporter | null = null;
let etherealInitialized = false;

async function getTransporter() {
  if (transporter) {
    return transporter;
  }

  // For development, use ethereal email (fake SMTP)
  if (!env.emailHost || !env.emailUser || !env.emailPassword) {
    console.warn(
      "Email credentials not configured. Verification codes will be logged to console instead."
    );
    return null;
  }

  console.log("\n📧 Email Configuration:");
  console.log(`  Host: ${env.emailHost}`);
  console.log(`  Port: ${env.emailPort}`);
  console.log(`  User: ${env.emailUser}`);
  console.log(`  Password length: ${env.emailPassword?.length || 0} characters`);
  console.log(`  From: ${env.emailFrom}\n`);

  transporter = nodemailer.createTransport({
    host: env.emailHost,
    port: env.emailPort,
    secure: env.emailPort === 465,
    auth: {
      user: env.emailUser,
      pass: env.emailPassword,
    },
    debug: true, // Enable debug output
    logger: true, // Log information
  });

  // Test the connection
  try {
    console.log("🔍 Testing email connection...");
    await transporter.verify();
    console.log("✅ Email connection successful!\n");
  } catch (error) {
    console.error("❌ Email connection test failed:");
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    console.error("\nTroubleshooting:");
    console.error("1. Make sure 2FA is enabled on your Google account");
    console.error("2. Generate a new App Password at: https://myaccount.google.com/apppasswords");
    console.error("3. Copy the 16-character password (remove spaces)");
    console.error("4. Update EMAIL_PASSWORD in your .env file\n");
  }

  return transporter;
}

export async function sendVerificationEmail(
  email: string,
  code: string,
  name: string
): Promise<boolean> {
  const transport = await getTransporter();

  if (!transport) {
    console.log("\n=================================");
    console.log("📧 EMAIL VERIFICATION CODE");
    console.log("=================================");
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`Code: ${code}`);
    console.log("=================================\n");
    return true;
  }

  try {
    console.log(`\n📧 Attempting to send verification email to: ${email}`);
    const info = await transport.sendMail({
      from: env.emailFrom,
      to: email,
      subject: "Verify your CircleFundr account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to CircleFundr, ${name}!</h2>
          <p>Thank you for signing up. To complete your registration, please verify your email address.</p>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Your verification code is:</p>
            <h1 style="margin: 10px 0; font-size: 36px; letter-spacing: 8px; color: #2563eb;">${code}</h1>
          </div>

          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't create an account with CircleFundr, you can safely ignore this email.</p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="font-size: 12px; color: #9ca3af;">CircleFundr - Track payments, manage circles</p>
        </div>
      `,
      text: `Welcome to CircleFundr, ${name}!\n\nYour verification code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you didn't create an account with CircleFundr, you can safely ignore this email.`,
    });

    console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to send verification email:");
    console.error("Error details:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return false;
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
