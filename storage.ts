
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import {
  qrCodes, scans,
  type QrCode, type Scan, type CreateQrCodeRequest
} from "@shared/schema";

export interface IStorage {
  // QR Codes
  createQrCode(userId: string, data: CreateQrCodeRequest): Promise<QrCode>;
  getQrCodes(userId: string): Promise<QrCode[]>;
  getQrCode(id: number): Promise<QrCode | undefined>;
  getQrCodeBySlug(slug: string): Promise<QrCode | undefined>;
  updateQrCode(id: number, data: Partial<QrCode>): Promise<QrCode | undefined>;
  deleteQrCode(id: number): Promise<void>;

  // Scans
  recordScan(qrCodeId: number, data: Partial<Scan>): Promise<void>;
  getScans(qrCodeId: number): Promise<Scan[]>;
}

export class DatabaseStorage implements IStorage {
  async createQrCode(userId: string, data: CreateQrCodeRequest): Promise<QrCode> {
    const slug = Math.random().toString(36).substring(2, 8);
    
    const [qr] = await db.insert(qrCodes).values({
      ...data,
      userId,
      slug,
      scansCount: 0
    }).returning();
    return qr;
  }

  async getQrCodes(userId: string): Promise<QrCode[]> {
    return await db.select()
      .from(qrCodes)
      .where(eq(qrCodes.userId, userId))
      .orderBy(desc(qrCodes.createdAt));
  }

  async getQrCode(id: number): Promise<QrCode | undefined> {
    const [qr] = await db.select().from(qrCodes).where(eq(qrCodes.id, id));
    return qr;
  }

  async getQrCodeBySlug(slug: string): Promise<QrCode | undefined> {
    const [qr] = await db.select().from(qrCodes).where(eq(qrCodes.slug, slug));
    return qr;
  }

  async updateQrCode(id: number, data: Partial<QrCode>): Promise<QrCode | undefined> {
    const [qr] = await db.update(qrCodes)
      .set(data)
      .where(eq(qrCodes.id, id))
      .returning();
    return qr;
  }

  async deleteQrCode(id: number): Promise<void> {
    await db.delete(scans).where(eq(scans.qrCodeId, id));
    await db.delete(qrCodes).where(eq(qrCodes.id, id));
  }

  async recordScan(qrCodeId: number, data: Partial<Scan>): Promise<void> {
    await db.insert(scans).values({
      qrCodeId,
      ...data,
      scannedAt: new Date()
    });

    await db.execute(
      `UPDATE qr_codes SET scans_count = scans_count + 1 WHERE id = ${qrCodeId}`
    );
  }

  async getScans(qrCodeId: number): Promise<Scan[]> {
    return await db.select()
      .from(scans)
      .where(eq(scans.qrCodeId, qrCodeId))
      .orderBy(desc(scans.scannedAt))
      .limit(50);
  }
}

export const storage = new DatabaseStorage();
