import { NextRequest, NextResponse } from 'next/server';
import crypto from "crypto";
import { Redis } from "@upstash/redis";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { computeImpactEffects, isOverWater, estimateAsteroidDeaths } from '@/lib/serverPhysicsEngine';
import {Damage_Inputs, ResponseData } from '@/lib/impactTypes';
import {generateReportAction} from "@/lib/createPdf"

const DAILY_REPORT_LIMIT_DEFAULT = 20;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;

const keyKey = (apiKeyHash: string) => `key:${apiKeyHash}`;
const keyAcct = (email: string) => `acct:${email}`;
const keyUsage = (email: string, ymd: string) => `usage:${email}:${ymd}`;
const keyReport = (reportId: string) => `report:${reportId}`;

type AcctRecord = {
  apiKeyHash: string;
  dailyReportLimit: number;
  createdAt: string;
};

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function getTodayEST(): string {
  // YYYY-MM-DD in
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

function newReportId(): string {
  return crypto.randomUUID();
}


interface ComputeImpactRequest {
  meteorData: {
    name: string;
    mass: number;
    diameter: number;
    speed: number;
    angle: number;
    density: number;
  };
  impactLocation: {
    latitude: number;
    longitude: number;
  };
  generateReport?: boolean;
}


interface ComputeImpactResponse {
  success: boolean;
  data?: ResponseData;
  report?: {
    generated: boolean;
    message: string;
  };
  error?: string;
}

/**
 * POST /api/compute-impact
 * Computes impact effects based on meteoroid parameters
 * Optionally triggers report generation
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as any;
    const { meteorData, impactLocation, generateReport } = body ?? {};

    if (!meteorData || !impactLocation) {
      return NextResponse.json(
        { success: false, error: "Missing meteorData or impactLocation" },
        { status: 400 }
      );
    }

    const requiredMeteorFields = ["mass", "diameter", "speed", "angle", "density"] as const;
    for (const field of requiredMeteorFields) {
      if (meteorData[field] === undefined || meteorData[field] === null) {
        return NextResponse.json(
          { success: false, error: `Missing meteoroid parameter: ${field}` },
          { status: 400 }
        );
      }
    }

    // Compute impact (same as your existing logic)
    const is_water = await isOverWater(impactLocation.latitude, impactLocation.longitude);

    const damageInputs = {
      mass: meteorData.mass,
      L0: meteorData.diameter,
      rho_i: meteorData.density,
      v0: meteorData.speed,
      theta_deg: meteorData.angle,
      is_water,
      latitude: impactLocation.latitude,
      longitude: impactLocation.longitude,
    };

    const impactResults = computeImpactEffects(damageInputs);

    const controller = new AbortController();
    const populationEffects = await estimateAsteroidDeaths(
      impactResults,
      impactLocation.latitude,
      impactLocation.longitude,
      meteorData.diameter,
      controller.signal
    );

    const damageAndMortalityData = {
      damageResults: impactResults,
      mortalityResults: populationEffects,
    };

    // Report handling
    let report: undefined | { generated: true; reportId: string; message: string } = undefined;

    if (generateReport) {
      // Require API key only for report generation
      const apiKey = request.headers.get("x-api-key") ?? request.headers.get("X-API-Key");
      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: "API key required for report generation (X-API-Key)" },
          { status: 401 }
        );
      }

      const apiKeyHash = sha256Hex(apiKey);

      // Validate API key via reverse index
      const email = await redis.get<string>(keyKey(apiKeyHash));
      if (!email) {
        return NextResponse.json({ success: false, error: "Invalid API key" }, { status: 401 });
      }

      // Determine limit (stored per account; fallback to default)
      const acct = await redis.get<AcctRecord>(keyAcct(email));
      const dailyLimit = acct?.dailyReportLimit ?? DAILY_REPORT_LIMIT_DEFAULT;

      // Quota check (per-day key; no cron needed)
      const today = getTodayEST();
      const usageKey = keyUsage(email, today);

      const newCount = await redis.incr(usageKey);

      // set TTL on first increment (keep counters a bit longer than 24h)
      if (newCount === 1) {
        await redis.expire(usageKey, 60 * 60 * 48); // 48h
      }

      if (newCount > dailyLimit) {
        // roll back increment
        await redis.decr(usageKey);
        return NextResponse.json(
          { success: false, error: "Report generation daily quota exceeded" },
          { status: 429 }
        );
      }

      // 5) Generate PDF
      const pdf = await generateReportAction(meteorData, impactLocation, damageAndMortalityData);

      // 6) Upload to R2
      const reportId = newReportId();
      const r2Key = `reports/${reportId}.pdf`;

      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
          Body: pdf.bytes, // Uint8Array is fine
          ContentType: pdf.contentType,
          // Optional, but nice:
          Metadata: {
            reportId,
            email,
          },
        })
      );

      // 7) Store report metadata in Redis (so GET /api/reports/{reportId} can find it)
      const meta = {
        r2Key,
        filename: pdf.filename,
        contentType: pdf.contentType,
        createdAt: new Date().toISOString(),
      };

      await redis.set(keyReport(reportId), meta);
      await redis.expire(keyReport(reportId), 60 * 60 * 24 * 8); // 8 days

      report = {
        generated: true,
        reportId,
        message: "PDF report generated. Retrieve it via GET /api/reports/{reportId}.",
      };
    }

    return NextResponse.json(
      { success: true, data: damageAndMortalityData, report },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Impact computation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error during computation";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}