// app/api/overWater/route.ts
import axios from "axios";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    if (!lat || !lon) {
        return new Response("Missing lat/lon", { status: 400 });
    }

    const options = {
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
        console.log("over water: ", response.data.water)
        return Response.json({ overWater: response.data.water });
    } catch (error) {
        return Response.json({ error: "Server error" }, { status: 500 });
    }
}
