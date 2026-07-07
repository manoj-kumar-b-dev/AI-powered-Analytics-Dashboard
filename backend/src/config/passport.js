const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');
const Org = require('../models/org');

const configurePassport = () => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('Google Client Credentials not defined in environment. Google OAuth will not function properly.');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
          if (!email) {
            return done(new Error('Google account must have an email address linked.'));
          }

          // Try to find user by googleId
          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            // Check if user exists by email
            user = await User.findOne({ email });

            if (user) {
              // Link Google Account
              user.googleId = profile.id;
              if (profile.photos && profile.photos[0] && !user.avatarUrl) {
                user.avatarUrl = profile.photos[0].value;
              }
              await user.save();
            } else {
              // Auto-provision a new organization and user
              const newOrg = new Org({
                name: `${profile.displayName || 'My'}'s Workspace`,
                plan: 'free'
              });
              await newOrg.save();

              user = new User({
                email,
                googleId: profile.id,
                name: profile.displayName || 'Google User',
                avatarUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
                orgId: newOrg._id,
                role: 'owner'
              });
              await user.save();

              // Link Org owner
              newOrg.ownerId = user._id;
              await newOrg.save();
            }
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
};

module.exports = configurePassport;
