import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    const issuerUrl = process.env.ISSUER_URL ?? "https://replit.com/oidc";
    const clientId = process.env.REPL_ID!;
    console.log("[AUTH] OIDC Config - Issuer:", issuerUrl, "Client ID:", clientId);
    const config = await client.discovery(
      new URL(issuerUrl),
      clientId
    );
    console.log("[AUTH] OIDC Discovery complete");
    return config;
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  // Replit always uses HTTPS, so secure should be true even in development
  const isProduction = process.env.NODE_ENV === "production";
  
  console.log("[AUTH] Session config - secure: true, sameSite:", isProduction ? "strict" : "lax");
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true, // Always true on Replit (HTTPS)
      sameSite: isProduction ? "strict" : "lax",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();
  
  // Use REPLIT_DOMAINS or REPLIT_DEV_DOMAIN for consistent domain
  let domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 
               process.env.REPLIT_DEV_DOMAIN || 
               'localhost';
  
  // In development, add port 5000 to match how the app is accessed
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction && !domain.includes(':')) {
    domain = `${domain}:5000`;
  }
  
  console.log("[AUTH] Using domain for callbacks:", domain);

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      console.log("[AUTH] Verify function called");
      const user = {};
      updateUserSession(user, tokens);
      console.log("[AUTH] User session updated, claims:", tokens.claims());
      await upsertUser(tokens.claims());
      console.log("[AUTH] User upserted successfully");
      verified(null, user);
    } catch (error) {
      console.error("[AUTH] Error in verify function:", error);
      verified(error as Error);
    }
  };

  // Create single strategy with consistent domain
  const strategy = new Strategy(
    {
      name: "replitauth",
      config,
      scope: "openid email profile offline_access",
      callbackURL: `https://${domain}/api/callback`,
    },
    verify,
  );
  
  passport.use(strategy);
  console.log("[AUTH] Strategy registered with callback URL:", `https://${domain}/api/callback`);

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    console.log("[AUTH] Login route hit");
    
    passport.authenticate("replitauth", {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    console.log("[AUTH] Callback route hit");
    console.log("[AUTH] Query params:", req.query);
    
    passport.authenticate("replitauth", (err: any, user: any, info: any) => {
      console.log("[AUTH] Authenticate callback - err:", err, "user:", !!user, "info:", info);
      
      if (err) {
        console.error("[AUTH] Authentication error:", err);
        return res.redirect("/api/login");
      }
      
      if (!user) {
        console.error("[AUTH] No user returned");
        return res.redirect("/api/login");
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("[AUTH] Login error:", loginErr);
          return res.redirect("/api/login");
        }
        
        console.log("[AUTH] Login successful, redirecting to /");
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      // Use the same domain logic as the callback URL
      let logoutRedirectDomain = process.env.REPLIT_DOMAINS?.split(',')[0] || 
                                  process.env.REPLIT_DEV_DOMAIN || 
                                  'localhost';
      
      // In development, add port 5000
      if (!isProduction && !logoutRedirectDomain.includes(':')) {
        logoutRedirectDomain = `${logoutRedirectDomain}:5000`;
      }
      
      const postLogoutUrl = `https://${logoutRedirectDomain}/`;
      
      console.log("[AUTH] Logout - post_logout_redirect_uri:", postLogoutUrl);
      
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: postLogoutUrl,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
