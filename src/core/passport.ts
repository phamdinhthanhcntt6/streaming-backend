import passport, { type AuthenticateOptions } from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "./db.js";
import { env } from "./env.js";

const GOOGLE_PROVIDER = "google";

export const googleAuthenticationOptions = {
  scope: ["profile", "email"],
  session: false,
} satisfies AuthenticateOptions;

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const verifiedEmail = profile.emails?.find(
          (email) => email.verified,
        )?.value;

        if (!verifiedEmail) {
          return done(new Error("Google account must have a verified email"));
        }

        const email = verifiedEmail.trim().toLowerCase();
        const googleId = profile.id;
        const googleAvatarUrl =
          profile.photos?.[0]?.value ?? profile._json.picture;

        const googleUser = await prisma.user.findFirst({
          where: {
            provider: GOOGLE_PROVIDER,
            providerId: googleId,
          },
        });

        if (googleUser) {
          const avatarUrl = googleUser.avatarPublicId
            ? googleUser.avatarUrl
            : (googleAvatarUrl ?? googleUser.avatarUrl);

          if (avatarUrl !== googleUser.avatarUrl) {
            const updatedGoogleUser = await prisma.user.update({
              where: { id: googleUser.id },
              data: { avatarUrl },
            });

            return done(null, updatedGoogleUser);
          }

          return done(null, googleUser);
        }

        const userWithSameEmail = await prisma.user.findFirst({
          where: {
            email: {
              equals: email,
              mode: "insensitive",
            },
          },
        });

        if (userWithSameEmail) {
          if (
            userWithSameEmail.provider &&
            (userWithSameEmail.provider !== GOOGLE_PROVIDER ||
              (userWithSameEmail.providerId &&
                userWithSameEmail.providerId !== googleId))
          ) {
            return done(
              new Error("Email is already linked to another login provider"),
            );
          }

          const linkedUser = await prisma.user.update({
            where: { id: userWithSameEmail.id },
            data: {
              provider: GOOGLE_PROVIDER,
              providerId: googleId,
              avatarUrl: userWithSameEmail.avatarPublicId
                ? userWithSameEmail.avatarUrl
                : (googleAvatarUrl ?? userWithSameEmail.avatarUrl),
            },
          });

          return done(null, linkedUser);
        }

        const displayName =
          profile.displayName.trim() || email.split("@")[0] || "Google user";

        const newUser = await prisma.user.create({
          data: {
            email,
            displayName,
            provider: GOOGLE_PROVIDER,
            providerId: googleId,
            avatarUrl: googleAvatarUrl ?? null,
          },
        });

        return done(null, newUser);
      } catch (error) {
        return done(error instanceof Error ? error : new Error("Google login failed"));
      }
    },
  ),
);

export { passport };
