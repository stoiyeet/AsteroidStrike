import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Redis } from "@upstash/redis";
import sgMail from "@sendgrid/mail";

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ROTATE_TTL_SECONDS = 30 * 60; // 30 minutes

function sha256Hex(s: string) {
    return crypto.createHash("sha256").update(s).digest("hex");
}

function base64url(buf: Buffer) {
    return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function generateToken() {
    return base64url(crypto.randomBytes(32));
}

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function getBaseUrl(req: NextRequest) {
    const envUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
    return (envUrl ? envUrl : req.nextUrl.origin).replace(/\/+$/, "");
}

// Redis keys
const keyAcct = (email: string) => `acct:${email}`;
const keyRotatePending = (tokenHash: string) => `rotate_pending:${tokenHash}`; // -> email

type AcctRecord = {
    apiKeyHash: string;
    dailyReportLimit: number;
    createdAt: string;
};

async function sendRotateEmail(toEmail: string, confirmUrl: string) {
    const apiKey = process.env.SENDGRID_EMAIL_API;
    if (!apiKey) throw new Error("Missing process.env.SENDGRID_EMAIL_API");
    sgMail.setApiKey(apiKey);

    await sgMail.send({
        to: toEmail,
        from: { email: "no-reply@asteroidstrike.earth", name: "AsteroidStrike" },
        subject: "Confirm to regenerate your API key",
        text: `Confirm to regenerate your API key: ${confirmUrl}`,
        html: `<p>Click to regenerate your API key:</p><p><a href="${confirmUrl}">Regenerate API key</a></p>`,
    });
}

export async function POST(req: NextRequest) {
    try {
        const { email } = (await req.json().catch(() => ({}))) as { email?: string };

        if (!email || typeof email !== "string") {
            return NextResponse.json({ error: "Missing email" }, { status: 400 });
        }

        const normalized = normalizeEmail(email);
        if (!isValidEmail(normalized)) {
            return NextResponse.json({ error: "Invalid email" }, { status: 400 });
        }

        // For recovery/rotate, only allow if the account exists
        const acct = await redis.get<AcctRecord>(keyAcct(normalized));
        if (!acct?.apiKeyHash) {
            return NextResponse.json(
                { error: "No API key exists for this email. Register first." },
                { status: 404 }
            );
        }

        const token = generateToken();
        const tokenHash = sha256Hex(token);

        await redis.set(keyRotatePending(tokenHash), normalized, { ex: ROTATE_TTL_SECONDS });

        const baseUrl = getBaseUrl(req);
        const confirmUrl = `${baseUrl}/api/register/rotate/confirm?token=${encodeURIComponent(token)}`;

        await sendRotateEmail(normalized, confirmUrl);

        return NextResponse.json({ status: "pending_confirmation" }, { status: 202 });
    } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: "Failed to start key rotation", detail: message }, { status: 500 });
    }
}