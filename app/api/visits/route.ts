// app/api/visits/route.ts
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Initialize Upstash Redis client using environment variables
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST() {
    // INCR the "visits" key
    const visits = await redis.incr("visits");
    return NextResponse.json({ visits });
}

export async function GET() {
    // GET the "visits" key, default to 0
    const visits = await redis.get("visits") || 0;
    return NextResponse.json({ visits });
}
