import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

export const runtime = "nodejs"; // important: AWS SDK + Node streams

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

const keyReport = (reportId: string) => `report:${reportId}`;

type ReportMeta = {
    r2Key: string;
    filename: string;
    contentType: string;
    createdAt: string;
};

function nodeReadableToWebStream(nodeStream: Readable): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            nodeStream.on("data", (chunk) => controller.enqueue(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)));
            nodeStream.on("end", () => controller.close());
            nodeStream.on("error", (err) => controller.error(err));
        },
        cancel() {
            nodeStream.destroy();
        },
    });
}

export async function GET(_req: NextRequest, context: { params: Promise<{ reportId: string }> }) {
    try {
        const { reportId } = await context.params;

        if (!reportId || typeof reportId !== "string") {
            return NextResponse.json({ success: false, error: "Missing reportId" }, { status: 400 });
        }

        const meta = await redis.get<ReportMeta>(keyReport(reportId));
        if (!meta?.r2Key) {
            return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
        }

        const obj = await r2.send(
            new GetObjectCommand({
                Bucket: R2_BUCKET,
                Key: meta.r2Key,
            })
        );

        if (!obj.Body) {
            return NextResponse.json({ success: false, error: "Report content missing" }, { status: 404 });
        }

        // AWS SDK v3 returns a Node stream in Node runtime
        const bodyStream = obj.Body as Readable;
        const webStream = nodeReadableToWebStream(bodyStream);

        return new NextResponse(webStream, {
            status: 200,
            headers: {
                "Content-Type": meta.contentType || "application/pdf",
                // Use inline so browser opens it; change to attachment to force download
                "Content-Disposition": `inline; filename="${meta.filename || `${reportId}.pdf`}"`,
                // Optional (helps caching; safe since reports are public in your policy)
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch (err: unknown) {
        console.error("Report download error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}