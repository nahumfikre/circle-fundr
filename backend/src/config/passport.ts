import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "./prisma";
import { env } from "./env";

const googleClientId = env.googleClientId || "dummy-client-id";
const googleClientSecret = env.googleClientSecret || "dummy-client-secret";

passport.use(
  new GoogleStrategy(
    {
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: `http://localhost:${env.port}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(new Error("No email from Google"), undefined);
        }

        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name: profile.displayName || "Google User",
              googleId: profile.id,
              password: null,
              emailVerified: true, // Google emails are pre-verified
            },
          });
        } else if (!user.googleId) {
          user = await prisma.user.update({
            where: { email },
            data: {
              googleId: profile.id,
              emailVerified: true, // Mark as verified when linking Google
            },
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
