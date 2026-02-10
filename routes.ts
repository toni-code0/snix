
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { db } from "./db";
import { users, type User } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // 1. Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // Helper to sync Replit Auth user to our local users table
  // Replit Auth stores users in 'users' table (from shared/models/auth) which has string IDs (UUIDs)
  // Our schema.ts defined 'users' table has serial IDs. 
  // Wait, let's look at shared/schema.ts. I defined 'users' with serial ID.
  // Replit Auth uses 'users' table from shared/models/auth.ts (UUID).
  // I should use the Replit Auth 'users' table for everything to avoid duplication.
  // I will update storage.ts to use string IDs for userId to match Replit Auth.

  // NOTE: I need to update my storage implementation to handle string user IDs if I switch.
  // BUT, to keep it simple and safe now without refactoring everything:
  // I will assume the Replit Auth user ID (UUID) is what we use.
  // However, shared/schema.ts defined `userId: integer` for qrCodes.
  // I must fix `shared/schema.ts` to use `varchar` for userId to match Replit Auth users table.
  // OR, I can create a local user record mapping UUID -> Integer.
  // The simplest path for Replit Auth is to use the UUID as the ID.
  
  // Correction: I will modify `shared/schema.ts` in the next step to ensure `qrCodes.userId` matches `users.id` type from Replit Auth (varchar).
  // For now, let's assume `req.user.claims.sub` is the ID.

  // === QR ROUTES ===

  // List QRs
  app.get(api.qr.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    // Replit Auth user ID is string
    const userId = (req.user as any).claims.sub; // This is a string UUID
    // We need to fetch QRs. storage expects number? 
    // I will cast to any for now and fix storage to accept string in next step.
    const qrs = await storage.getQrCodes(userId); 
    res.json(qrs);
  });

  // Create QR
  app.post(api.qr.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const userId = (req.user as any).claims.sub;
    try {
      const input = api.qr.create.input.parse(req.body);
      const qr = await storage.createQrCode(userId, input);
      res.status(201).json(qr);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json(err);
      } else {
        res.status(500).json({ message: "Internal Error" });
      }
    }
  });

  // Get QR
  app.get(api.qr.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const qr = await storage.getQrCode(Number(req.params.id));
    if (!qr) return res.status(404).send();
    
    // Check ownership
    const userId = (req.user as any).claims.sub;
    if (qr.userId !== userId) return res.status(401).send(); // Type mismatch potential here, need to fix schema

    const scans = await storage.getScans(qr.id);
    res.json({ ...qr, scans });
  });

  // Delete QR
  app.delete(api.qr.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const qr = await storage.getQrCode(Number(req.params.id));
    if (!qr) return res.status(404).send();

    const userId = (req.user as any).claims.sub;
    if (qr.userId !== userId) return res.status(401).send();

    await storage.deleteQrCode(qr.id);
    res.status(204).send();
  });

  // Update QR
  app.patch(api.qr.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const qr = await storage.getQrCode(Number(req.params.id));
    if (!qr) return res.status(404).send();

    const userId = (req.user as any).claims.sub;
    if (qr.userId !== userId) return res.status(401).send();

    try {
      const input = api.qr.update.input.parse(req.body);
      const updated = await storage.updateQrCode(qr.id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json(err);
      } else {
        res.status(500).json({ message: "Internal Error" });
      }
    }
  });

  // Stats
  app.get(api.stats.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const qr = await storage.getQrCode(Number(req.params.id));
    if (!qr) return res.status(404).send();
    
    const userId = (req.user as any).claims.sub;
    if (qr.userId !== userId) return res.status(401).send();

    const scans = await storage.getScans(qr.id);
    res.json(scans);
  });

  // === PUBLIC REDIRECT ROUTE ===
  app.get("/s/:slug", async (req, res) => {
    const slug = req.params.slug;
    const qr = await storage.getQrCodeBySlug(slug);

    if (qr) {
      // Get IP address for geolocation
      const ip = req.headers["x-replit-user-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      
      // Record scan asynchronously
      (async () => {
        let country = "Unknown";
        if (ip && ip !== "::1" && ip !== "127.0.0.1") {
          try {
            const geoRes = await fetch(`http://ip-api.com/json/${ip}`);
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              if (geoData.status === "success") {
                country = geoData.country;
              }
            }
          } catch (err) {
            console.error("Geo lookup error:", err);
          }
        }

        await storage.recordScan(qr.id, {
          userAgent: req.headers["user-agent"],
          country
        });
      })().catch(err => console.error("Scan record error:", err));

      // Redirect to the intermediate Continue page instead of direct redirect
      return res.redirect(`/continue/${slug}`);
    } else {
      res.status(404).send("QR Code not found");
    }
  });

  // Proxy the public redirect path for client-side routing
  app.get("/continue/:slug", (req, res) => {
    // Express doesn't know about wouter routes, so we just let the frontend handle it
    res.sendFile("index.html", { root: "dist/public" });
  });

  return httpServer;
}
