// app/api/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
import { Redis } from "@upstash/redis";

const PENDING_TTL_SECONDS = 30 * 60; // 30 minutes

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function base64url(buf: Buffer) {
    return buf
        .toString("base64")
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
}

function sha256Hex(s: string) {
    return crypto.createHash("sha256").update(s).digest("hex");
}

function generateToken() {
    return base64url(crypto.randomBytes(32));
}


function getBaseUrl(req: NextRequest) {
    const envUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (envUrl) return envUrl.replace(/\/+$/, "");
    return req.nextUrl.origin;
}

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
    return (
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
        email.length <= 254
    );
}

async function sendConfirmationEmail(toEmail: string, confirmUrl: string) {
    const apiKey = process.env.SENDGRID_EMAIL_API;
    if (!apiKey) throw new Error("Missing process.env.SENDGRID_EMAIL_API");

    sgMail.setApiKey(apiKey);

    await sgMail.send({
        to: toEmail,
        from: {
            email: "no-reply@asteroidstrike.earth",
            name: "AsteroidStrike",
        },
        subject: "Confirm your email to activate your API key",
        text: `Confirm your email by opening this link: ${confirmUrl}\n\nIf you didn't request this, ignore this email.`,
        html: `
      <p>Confirm your email to activate your API key:</p>
      <p><a href="${confirmUrl}">Confirm email</a></p>
      <p>If you didn't request this, you can ignore this email.</p>
    `,
    });
}

// Redis key helpers (keep them short + explicit)
const keyPending = (tokenHash: string) => `pending:${tokenHash}`; // -> email

// POST /api/register
// Body: { "email": "user@example.com" }
// Response: { "status": "pending_confirmation" }
export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as { email?: string };
        if (!body?.email || typeof body.email !== "string") {
            return NextResponse.json({ error: "Missing email" }, { status: 400 });
        }

        const email = normalizeEmail(body.email);
        if (!isValidEmail(email)) {
            return NextResponse.json({ error: "Invalid email" }, { status: 400 });
        }

        // Generate one-time token, store ONLY its hash -> email (with TTL)
        const token = generateToken();
        const tokenHash = sha256Hex(token);

        // Store pending confirmation mapping with TTL
        await redis.set(keyPending(tokenHash), email, { ex: PENDING_TTL_SECONDS });

        const baseUrl = getBaseUrl(req);
        const confirmUrl = `${baseUrl}/api/register/confirm?token=${encodeURIComponent(token)}`;

        await sendConfirmationEmail(email, confirmUrl);

        return NextResponse.json({ status: "pending_confirmation" }, { status: 202 });
    } catch (err: any) {
        return NextResponse.json(
            { error: "Failed to start registration", detail: err?.message ?? String(err) },
            { status: 500 }
        );
    }
}