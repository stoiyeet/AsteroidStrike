import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Redis } from "@upstash/redis";


const DAILY_REPORT_LIMIT = 20;

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function base64url(buf: Buffer) {
    return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function sha256Hex(s: string) {
    return crypto.createHash("sha256").update(s).digest("hex");
}

function generateApiKey() {
    return `as_${base64url(crypto.randomBytes(32))}`;
}

// Redis keys
const keyPending = (tokenHash: string) => `pending:${tokenHash}`; // -> email
const keyAcct = (email: string) => `acct:${email}`; // -> JSON { apiKeyHash, dailyReportLimit, createdAt }
const keyKey = (apiKeyHash: string) => `key:${apiKeyHash}`; // -> email (reverse index)

type AcctRecord = {
    apiKeyHash: string;
    dailyReportLimit: number;
    createdAt: string;
};

// GET /api/register/confirm?token=...
// First time: returns { apiKey, dailyReportLimit }
// Later: returns { error: "already_provisioned", ... } without revealing key again
export async function GET(req: NextRequest) {
    try {
        const token = req.nextUrl.searchParams.get("token");
        if (!token) {
            return NextResponse.json({ error: "Missing token" }, { status: 400 });
        }

        const tokenHash = sha256Hex(token);

        const email = await redis.get<string>(keyPending(tokenHash));
        if (!email) {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
        }

        // one-time token
        await redis.del(keyPending(tokenHash));

        const existing = await redis.get<AcctRecord>(keyAcct(email));
        if (existing?.apiKeyHash) {
            // Best practice: never re-display a secret API key.
            return NextResponse.json(
                {
                    error: "already_provisioned",
                    message: "An API key already exists for this email. Please regenerate/rotate your key to obtain a new one.",
                    dailyReportLimit: existing.dailyReportLimit,
                },
                { status: 409 }
            );
        }

        const apiKey = generateApiKey();
        const apiKeyHash = sha256Hex(apiKey);

        const acct: AcctRecord = {
            apiKeyHash,
            dailyReportLimit: DAILY_REPORT_LIMIT,
            createdAt: new Date().toISOString(),
        };

        // Store hash only + reverse lookup for auth
        await redis.set(keyAcct(email), acct);
        await redis.set(keyKey(apiKeyHash), email);

        // Return the raw key ONCE
        return NextResponse.json({ apiKey, dailyReportLimit: DAILY_REPORT_LIMIT }, { status: 200 });
    } catch (err: unknown) {
        let message = "Unknown error";

        if (err instanceof Error) {
            message = err.message;
        }
        return NextResponse.json(
            { error: "Failed to confirm email", detail: message ?? String(err) },
            { status: 500 }
        );
    }
}
