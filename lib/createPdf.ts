// generateReportAction.ts
// npm i pdf-lib
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { Crater_Results, Damage_Results, ResponseData, Seismic_Results, Strike_Overview, Thermal_Effects, Tsunami_Results, Waveblast_Results } from "./impactTypes";

export type MeteorData = {
    name?: string;
    mass: number;
    diameter: number;
    speed: number;
    angle: number;
    density: number;
};

export type ImpactLocation = {
    latitude: number;
    longitude: number;
};


type PlaceInfo = {
    label: string;
    countryName?: string;
    city?: string;
    waterName?: string;
};

type ReportData = {
    filename: string;
    contentType: "application/pdf";
    bytes: Uint8Array;
};

// BigDataCloud response shape (partial)
type BigDataCloudResponse = {
    countryName?: string;
    city?: string;
    locality?: string;
    principalSubdivision?: string;
    localityInfo?: {
        informative?: Array<{
            name?: string;
            description?: string;
            order?: number;
        }>;
    };
};

function generateReportId(d: Date): string {
    return `ASR-${d.toISOString().replace(/[-:]/g, "").replace(/\..+/, "")}`;
}

function fmtNum(v: unknown, digits = 2): string {
    if (v === null || v === undefined) return "—";
    if (typeof v === "number" && Number.isFinite(v)) {
        return v.toLocaleString(undefined, { maximumFractionDigits: digits });
    }
    return String(v);
}

function safe(v: unknown): string {
    if (v === null || v === undefined) return "—";
    const s = String(v).trim();
    return s.length ? s : "—";
}

function pickDamage(impactResults: ResponseData) {
    const d =
        impactResults?.damageResults
    return (d ?? {}) as Damage_Results;
}

function pickMortality(impactResults: ResponseData) {
    return (
        impactResults?.mortalityResults
    ) as { deathCount: number; injuryCount: number } | undefined;
}

function flattenObject(obj: unknown, prefix = ""): Array<[string, unknown]> {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
    const out: Array<[string, unknown]> = [];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) out.push(...flattenObject(v, key));
        else out.push([key, v]);
    }
    return out;
}

async function reverseGeocodePlace(loc: ImpactLocation): Promise<PlaceInfo | null> {
    const url =
        `https://api-bdc.io/data/reverse-geocode-client` +
        `?latitude=${encodeURIComponent(loc.latitude)}` +
        `&longitude=${encodeURIComponent(loc.longitude)}` +
        `&localityLanguage=en`;

    try {
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) return null;

        const data = (await res.json()) as BigDataCloudResponse;

        const countryName = data.countryName?.trim();
        const city = (data.city || data.locality)?.trim();

        // in localityInfo.informative. :contentReference[oaicite:2]{index=2}
        const informative = data.localityInfo?.informative ?? [];
        const waterCandidate =
            informative
                .map((x) => x?.description?.trim())
                .find((n) => n && /ocean|sea|gulf|bay|strait|channel|lake/i.test(n)) ??
            undefined;

        const label =
            (city && countryName && `${city}, ${countryName}`) ||
            (countryName && countryName) ||
            (waterCandidate && waterCandidate) ||
            "Unknown location";

        return {
            label,
            countryName: countryName || undefined,
            city: city || undefined,
            waterName: waterCandidate,
        };
    } catch {
        return null;
    }
}


function classifySeverity(
    energyMt: number | undefined,
    deaths: number | undefined
): "local" | "citywide" | "continental" | "global" {
    if (!energyMt) return "local";

    if (energyMt > 1_000_000) return "global";
    if (energyMt > 50_000) return "continental";
    if (energyMt > 5_000) return "citywide";

    if (deaths && deaths > 1_000_000) return "continental";
    if (deaths && deaths > 100_000) return "citywide";

    return "local";
}

function buildImpactSummaryText(
    reverseGeo: PlaceInfo | null,
    strikeOverview: Strike_Overview,
    airburst: boolean,
    mortality: { deathCount?: number; injuryCount?: number } | undefined
): string {
    const energyMt = strikeOverview?.Impact_Energy_Megatons_TNT as number | undefined;

    const deaths = mortality?.deathCount ?? 0;
    const injuries = mortality?.injuryCount ?? 0;

    const severity = classifySeverity(energyMt, deaths);

    // --- Location logic ---
    let locationPhrase = "an unknown location";

    if (reverseGeo?.city && reverseGeo?.countryName) {
        locationPhrase = `${reverseGeo.city}, ${reverseGeo.countryName}`;
    } else if (reverseGeo?.countryName) {
        locationPhrase = reverseGeo.countryName;
    } else {
        locationPhrase = reverseGeo?.label ?? "open ocean";
        locationPhrase = "the " + locationPhrase
    }

    const landOrAirburst = airburst ? "airburst over" : "land in";

    const disturbanceWord =
        severity === "local"
            ? "disturbance"
            : severity === "citywide"
                ? "devastation"
                : severity === "continental"
                    ? "catastrophic disruption"
                    : "planetary-scale devastation";

    return `This theoretical impact would ${landOrAirburst} ${locationPhrase}, causing ${severity} ${disturbanceWord}. Based on the local population density of the impact location, we approximate the human impact to be approximately ${deaths.toLocaleString()} deaths and ${injuries.toLocaleString()} injuries, assuming evacuation procedures or mitigation strategies were not properly initiated.`;
}

function drawParagraph(
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    font: PDFFont,
    fontSize: number,
    lineHeight: number
): number {
    const words = text.split(" ");
    let line = "";
    let cursorY = y;

    for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);

        if (width > maxWidth) {
            page.drawText(line, { x, y: cursorY, size: fontSize, font });
            cursorY -= lineHeight;
            line = word;
        } else {
            line = testLine;
        }
    }

    if (line) {
        page.drawText(line, { x, y: cursorY, size: fontSize, font });
        cursorY -= lineHeight;
    }

    return cursorY;
}



export async function generateReportAction(
    meteorData: MeteorData,
    impactLocation: ImpactLocation,
    impactResults: ResponseData
): Promise<ReportData> {
    const now = new Date();
    const reportId = generateReportId(now);

    const place = await reverseGeocodePlace(impactLocation);

    const damage = pickDamage(impactResults);
    const strike = (damage["Strike_Overview"] ?? {}) as Strike_Overview;
    const crater = (damage["Crater_Results"] ?? {}) as Crater_Results;
    const thermal = (damage["Thermal_Effects"] ?? {}) as Thermal_Effects;
    const wave = (damage["Waveblast_Results"] ?? {}) as Waveblast_Results;
    const tsunami = (damage["Tsunami_Results"] ?? {}) as Tsunami_Results;
    const seismic = (damage["Seismic_Results"] ?? {}) as Seismic_Results;
    const mortality = pickMortality(impactResults);

    const summaryText = buildImpactSummaryText(place, strike, crater.airburst, mortality)


    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle("AsteroidStrike Impact Report");
    pdfDoc.setAuthor("AsteroidStrike");

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageMargin = 48;

    const addPage = () => pdfDoc.addPage([612, 792]); // US Letter

    const drawHeader = (page: PDFPage, title: string) => {
        const { width, height } = page.getSize();

        page.drawRectangle({
            x: 0,
            y: height - 72,
            width,
            height: 72,
            color: rgb(0.06, 0.24, 0.45),
        });

        page.drawText("AsteroidStrike", {
            x: pageMargin,
            y: height - 46,
            size: 18,
            font: fontBold,
            color: rgb(1, 1, 1),
        });

        page.drawText(title, {
            x: pageMargin,
            y: height - 66,
            size: 11,
            font,
            color: rgb(0.9, 0.95, 1),
        });

        const meta = `Report ID: ${reportId}\nGenerated: ${now.toLocaleString()}`;
        const metaLines = meta.split("\n");
        let y = height - 36;
        for (const line of metaLines) {
            const textWidth = font.widthOfTextAtSize(line, 9);
            page.drawText(line, {
                x: width - pageMargin - textWidth,
                y,
                size: 9,
                font,
                color: rgb(0.9, 0.95, 1),
            });
            y -= 12;
        }
    };

    const drawFooter = (page: PDFPage, pageNum: number, totalPages: number) => {
        const { width } = page.getSize();
        const footerText = `Page ${pageNum} of ${totalPages}`;
        const tw = font.widthOfTextAtSize(footerText, 9);
        page.drawText(footerText, { x: width - pageMargin - tw, y: 24, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
        page.drawText("Generated by AsteroidStrike Impact Engine", {
            x: pageMargin,
            y: 24,
            size: 9,
            font,
            color: rgb(0.35, 0.35, 0.35),
        });
    };

    const drawSectionTitle = (page: PDFPage, x: number, y: number, text: string) => {
        page.drawText(text, { x, y, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        page.drawLine({ start: { x, y: y - 6 }, end: { x: x + 520, y: y - 6 }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
        return y - 22;
    };

    const drawKeyValueTable = (
        page: PDFPage,
        x: number,
        y: number,
        rows: Array<[string, string]>,
        options: { col1Width?: number; col2Width?: number; rowHeight?: number } = {}
    ) => {
        const col1 = options.col1Width ?? 180;
        const col2 = options.col2Width ?? 340;
        const rowH = options.rowHeight ?? 18;

        page.drawRectangle({
            x,
            y: y - rows.length * rowH - 10,
            width: col1 + col2 + 20,
            height: rows.length * rowH + 10,
            borderColor: rgb(0.85, 0.85, 0.85),
            borderWidth: 1,
            color: rgb(1, 1, 1),
        });

        let cy = y - rowH;
        for (let i = 0; i < rows.length; i++) {
            const [k, v] = rows[i];
            if (i % 2 === 0) {
                page.drawRectangle({ x: x + 1, y: cy - 3, width: col1 + col2 + 18, height: rowH, color: rgb(0.97, 0.97, 0.98) });
            }
            page.drawText(k, { x: x + 10, y: cy, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
            page.drawText(v, { x: x + 10 + col1, y: cy, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
            cy -= rowH;
        }

        return y - rows.length * rowH - 24;
    };

    // ---------------- Page 1 ----------------
    let page = addPage();
    drawHeader(page, "Impact Report");

    const { height } = page.getSize();
    let y = height - 96;

    // Impact Summary (new)
    y = drawSectionTitle(page, pageMargin, y, "Impact Summary");

    y = drawParagraph(
        page,
        summaryText,
        pageMargin,
        y,
        520,        
        font,
        11,         
        15          
    );

    y -= 10

    const locationLabel =
        place?.label ??
        `Lat ${fmtNum(impactLocation.latitude, 4)}, Lon ${fmtNum(impactLocation.longitude, 4)}`;

    const summaryRows: Array<[string, string]> = [
        ["Location", locationLabel],
        ["Impact energy (J)", fmtNum(strike?.Impact_Energy, 2)],
        ["Energy (Mt TNT)", fmtNum(strike?.Impact_Energy_Megatons_TNT, 2)],
        ["Final crater diameter (m)", fmtNum(crater?.Final_Diameter, 2)],
        ["Fireball radius (m)", fmtNum(thermal?.Fireball_Radius, 2)],
        ["Building collapse radius (m)", fmtNum(wave?.Radius_Building_Collapse_m, 2)],
        ["Seismic magnitude", fmtNum(seismic?.Magnitude, 2)],
        ["Estimated deaths", fmtNum(mortality?.deathCount, 0)],
        ["Estimated injuries", fmtNum(mortality?.injuryCount, 0)],
    ];

    y = drawKeyValueTable(page, pageMargin, y, summaryRows);

    y = drawSectionTitle(page, pageMargin, y, "Input Parameters");

    const inputRows: Array<[string, string]> = [
        ["Asteroid name", safe(meteorData?.name)],
        ["Mass (kg)", fmtNum(meteorData?.mass, 0)],
        ["Diameter (m)", fmtNum(meteorData?.diameter, 2)],
        ["Speed (m/s)", fmtNum(meteorData?.speed, 2)],
        ["Angle (deg)", fmtNum(meteorData?.angle, 2)],
        ["Density (kg/m³)", fmtNum(meteorData?.density, 2)],
        ["Impact latitude", fmtNum(impactLocation?.latitude, 6)],
        ["Impact longitude", fmtNum(impactLocation?.longitude, 6)],
    ];

    y = drawKeyValueTable(page, pageMargin, y, inputRows);

    // ---------------- Detail pages ----------------
    const sections: Array<[string, unknown]> = [
        ["Strike Overview", strike],
        ["Thermal Effects", thermal],
        ["Crater Results", crater],
        ["Seismic Results", seismic],
        ["Waveblast Results", wave],
        ["Tsunami Results", tsunami],
    ];

    for (const [title, obj] of sections) {
        page = addPage();
        drawHeader(page, `Detailed Results — ${title}`);

        let cy = page.getSize().height - 96;
        cy = drawSectionTitle(page, pageMargin, cy, title);

        const flat = flattenObject(obj).map(([k, v]) => [k, fmtNum(v, 6)] as [string, string]);
        const rowsPerPage = 24;
        let idx = 0;

        while (idx < flat.length) {
            const chunk = flat.slice(idx, idx + rowsPerPage);
            cy = drawKeyValueTable(page, pageMargin, cy, chunk, { col1Width: 220, col2Width: 300 });

            idx += rowsPerPage;
            if (idx < flat.length) {
                page = addPage();
                drawHeader(page, `Detailed Results — ${title} (cont.)`);
                cy = page.getSize().height - 96;
                cy = drawSectionTitle(page, pageMargin, cy, `${title} (cont.)`);
            }
        }
    }

    // Footers
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) drawFooter(pages[i], i + 1, pages.length);

    const bytes = await pdfDoc.save();

    return {
        filename: `asteroidstrike_report_${reportId}.pdf`,
        contentType: "application/pdf",
        bytes,
    };
}