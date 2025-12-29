import { createClient } from "@supabase/supabase-js";
import type { Express, RequestHandler, Request, Response, NextFunction } from "express";
import { storage } from "./storage";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SupabaseUser {
  claims: {
    sub: string;
    email?: string;
    user_metadata?: {
      first_name?: string;
      last_name?: string;
      avatar_url?: string;
      full_name?: string;
    };
  };
}

async function upsertUser(userId: string, email?: string, metadata?: any) {
  try {
    const firstName = metadata?.first_name || metadata?.full_name?.split(" ")[0] || null;
    const lastName = metadata?.last_name || metadata?.full_name?.split(" ").slice(1).join(" ") || null;
    const profileImageUrl = metadata?.avatar_url || null;

    await storage.upsertUser({
      id: userId,
      email: email || null,
      firstName,
      lastName,
      profileImageUrl,
    });
    console.log("[SUPABASE-AUTH] User upserted:", userId);
  } catch (error) {
    console.error("[SUPABASE-AUTH] Error upserting user:", error);
  }
}

export async function setupAuth(app: Express) {
  console.log("[SUPABASE-AUTH] Setting up Supabase authentication");

  app.get("/api/auth/user", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
      }

      const token = authHeader.substring(7);
      
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        console.log("[SUPABASE-AUTH] Token validation failed:", error?.message);
        return res.status(401).json({ message: "Invalid or expired token" });
      }

      await upsertUser(user.id, user.email, user.user_metadata);

      const dbUser = await storage.getUser(user.id);

      res.json({
        id: user.id,
        email: user.email,
        firstName: dbUser?.firstName || user.user_metadata?.first_name || null,
        lastName: dbUser?.lastName || user.user_metadata?.last_name || null,
        profileImageUrl: dbUser?.profileImageUrl || user.user_metadata?.avatar_url || null,
        language: dbUser?.language || "pt",
        displayName: dbUser?.displayName || null,
        totalXp: dbUser?.totalXp || 0,
        currentLevel: dbUser?.currentLevel || "iniciante",
        premiumActive: dbUser?.premiumActive || false,
      });
    } catch (error) {
      console.error("[SUPABASE-AUTH] Error fetching user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.json({ message: "Logged out successfully" });
  });

  console.log("[SUPABASE-AUTH] Auth routes registered");
}

export const isAuthenticated: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    const token = authHeader.substring(7);

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.log("[SUPABASE-AUTH] Auth middleware - token invalid:", error?.message);
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    (req as any).user = {
      claims: {
        sub: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      },
    };

    await upsertUser(user.id, user.email, user.user_metadata);

    next();
  } catch (error) {
    console.error("[SUPABASE-AUTH] Auth middleware error:", error);
    res.status(401).json({ message: "Unauthorized" });
  }
};
