import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function sha256Hex(s: string) {
    return crypto.createHash("sha256").update(s).digest("hex");
}

function base64url(buf: Buffer) {
    return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function generateApiKey() {
    return `as_${base64url(crypto.randomBytes(32))}`;
}

// Redis keys
const keyAcct = (email: string) => `acct:${email}`; // -> { apiKeyHash, dailyReportLimit, createdAt }
const keyKey = (apiKeyHash: string) => `key:${apiKeyHash}`; // -> email
const keyRotatePending = (tokenHash: string) => `rotate_pending:${tokenHash}`; // -> email

type AcctRecord = {
    apiKeyHash: string;
    dailyReportLimit: number;
    createdAt: string;
};

export async function GET(req: NextRequest) {
    try {
        const token = req.nextUrl.searchParams.get("token");
        if (!token) {
            return NextResponse.json({ error: "Missing token" }, { status: 400 });
        }

        const tokenHash = sha256Hex(token);

        const email = await redis.get<string>(keyRotatePending(tokenHash));
        if (!email) {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
        }

        // one-time token
        await redis.del(keyRotatePending(tokenHash));

        const acct = await redis.get<AcctRecord>(keyAcct(email));
        if (!acct?.apiKeyHash) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        const oldHash = acct.apiKeyHash;

        // Generate new key (return raw once)
        const newApiKey = generateApiKey();
        const newHash = sha256Hex(newApiKey);

        // Update account record (preserve limit + createdAt)
        const updated: AcctRecord = {
            ...acct,
            apiKeyHash: newHash,
        };

        await redis.set(keyAcct(email), updated);

        // Update reverse index: new hash -> email
        await redis.set(keyKey(newHash), email);

        // Revoke old key mapping
        await redis.del(keyKey(oldHash));

        return NextResponse.json(
            { apiKey: newApiKey, dailyReportLimit: updated.dailyReportLimit },
            { status: 200 }
        );
    } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: "Failed to rotate key", detail: message }, { status: 500 });
    }
}