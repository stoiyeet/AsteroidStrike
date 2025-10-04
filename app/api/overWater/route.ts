// app/api/overWater/route.ts
import axios, { AxiosRequestConfig } from "axios";

const waterCache = new Map<string, boolean>();

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    if (!lat || !lon) {
        return new Response("Missing lat/lon", { status: 400 });
    }

    const cacheKey = `${lat},${lon}`;

    if (waterCache.has(cacheKey)) {
        console.log(`Cache HIT for: ${cacheKey}`);
        const overWater = waterCache.get(cacheKey);
        return Response.json({ overWater });
    }

    // Cache MISS: proceed to fetch data from the external API.
    console.log(`Cache MISS for: ${cacheKey}. Fetching from API...`);

    const options: AxiosRequestConfig = {
        method: "GET",
        url: "https://isitwater-com.p.rapidapi.com/",
        params: {
            latitude: lat,
            longitude: lon,
        },
        headers: {
            "x-rapidapi-key": process.env.IS_WATER_API_KEY as string,
            "x-rapidapi-host": "isitwater-com.p.rapidapi.com",
        },
    };

    try {
        const response = await axios.request(options);
        const overWater: boolean = response.data.water;

        console.log("over water: ", overWater);

        // 4. Store the new result in the cache before returning.
        waterCache.set(cacheKey, overWater);

        return Response.json({ overWater });
    } catch (error) {
        console.error("API request failed:", error);
        return Response.json({ error: "Server error" }, { status: 500 });
    }
}