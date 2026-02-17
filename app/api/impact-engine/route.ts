import { NextRequest, NextResponse } from 'next/server';
import { computeImpactEffects, Damage_Inputs,isOverWater, estimateAsteroidDeaths } from '@/lib/serverPhysicsEngine';
import { Damage_Results, Mortality } from '@/lib/impactTypes';

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

interface ResponseData {
  damageResults: Damage_Results,
  mortalityResults: Mortality
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
export async function POST(request: NextRequest): Promise<NextResponse<ComputeImpactResponse>> {
  try {
    const body: ComputeImpactRequest = await request.json();

    const { meteorData, impactLocation, generateReport } = body;

    if (!meteorData || !impactLocation) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing meteorData or impactLocation',
        },
        { status: 400 }
      );
    }

    // Validate required meteoroid parameters
    const requiredMeteorFields = ['mass', 'diameter', 'speed', 'angle', 'density'];
    for (const field of requiredMeteorFields) {
      if (meteorData[field as keyof typeof meteorData] === undefined || meteorData[field as keyof typeof meteorData] === null) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing meteoroid parameter: ${field}`,
          },
          { status: 400 }
        );
      }
    }

    const is_water = await isOverWater(impactLocation.latitude, impactLocation.longitude)

    // Create damage inputs
    const damageInputs: Damage_Inputs = {
      mass: meteorData.mass,
      L0: meteorData.diameter,
      rho_i: meteorData.density,
      v0: meteorData.speed,
      theta_deg: meteorData.angle,
      is_water: is_water,
      latitude: impactLocation.latitude,
      longitude: impactLocation.longitude,
    };

    // Compute impact effects
    const impactResults = computeImpactEffects(damageInputs);

    const controller = new AbortController();

    const populationEffects = await estimateAsteroidDeaths(impactResults, impactLocation.latitude, impactLocation.longitude, meteorData.diameter, controller.signal)
  
    // Handle report generation if requested
    let reportData = undefined;
    if (generateReport) {
      reportData = await generateReportAction(meteorData, impactLocation, impactResults);
    }

    const data: ResponseData = {damageResults: impactResults, mortalityResults: populationEffects}

    return NextResponse.json(
      {
        success: true,
        data: data,
        report: reportData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Impact computation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during computation',
      },
      { status: 500 }
    );
  }
}

/**
 * Dummy report generation function
 * In production, this would create actual report files, send to storage, etc.
 */
async function generateReportAction(
  meteorData: ComputeImpactRequest['meteorData'],
  impactLocation: ComputeImpactRequest['impactLocation'],
  results: Damage_Results
) {
  try {
    // This is a dummy implementation
    // In production, you might:
    // - Generate PDF/LaTeX report
    // - Save to database
    // - Send email
    // - Upload to cloud storage
    // etc.

    const reportId = `report_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const reportSummary = {
      generated: true,
      message: `Report generated successfully`,
      reportId,
      timestamp: new Date().toISOString(),
      summary: {
        object: meteorData.name || 'Unknown Object',
        location: `${impactLocation.latitude.toFixed(2)}°N, ${impactLocation.longitude.toFixed(2)}°E`,
        energy: `${results.Strike_Overview.Impact_Energy_Megatons_TNT.toFixed(2)} Mt TNT`,
        impactType: results.Crater_Results.airburst ? 'Airburst' : 'Surface Impact',
        earthEffect: results.Crater_Results.Earth_Effect,
      },
    };

    console.log(`[Report Generation] Dummy report created:`, reportSummary);

    return reportSummary;
  } catch (error) {
    console.error('Report generation error:', error);
    return {
      generated: false,
      message: 'Failed to generate report',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
