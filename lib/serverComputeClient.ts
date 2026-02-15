/**
 * Client-side utility for calling the server-side physics engine API
 */

export interface MeteorData {
  name: string;
  mass: number;
  diameter: number;
  speed: number;
  angle: number;
  density: number;
}

export interface ImpactLocation {
  latitude: number;
  longitude: number;
}

export interface ComputeImpactRequest {
  meteorData: MeteorData;
  impactLocation: ImpactLocation;
  generateReport?: boolean;
}

/**
 * Compute impact effects on the server
 * Returns impact results as JSON
 */
export async function computeImpactOnServer(
  request: ComputeImpactRequest,
  onProgress?: (status: string) => void
) {
  try {
    onProgress?.('Sending impact parameters to server...');

    const response = await fetch('/api/compute-impact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Server error: ${response.statusText}`);
    }

    onProgress?.('Computing impact effects...');
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Computation failed');
    }

    onProgress?.('Impact analysis complete!');
    return result;
  } catch (error) {
    console.error('Server computation error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    onProgress?.(`Error: ${errorMsg}`);
    throw error;
  }
}

/**
 * Generate a server-side report
 * Triggers the dummy report generation function
 */
export async function generateServerReport(
  request: ComputeImpactRequest,
  onProgress?: (status: string) => void
) {
  try {
    onProgress?.('Generating server report...');

    return await computeImpactOnServer(
      {
        ...request,
        generateReport: true,
      },
      onProgress
    );
  } catch (error) {
    console.error('Report generation error:', error);
    throw error;
  }
}

/**
 * Batch compute multiple impact scenarios
 */
export async function computeMultipleImpacts(
  requests: ComputeImpactRequest[],
  onProgress?: (status: string, index: number, total: number) => void
) {
  const results = [];

  for (let i = 0; i < requests.length; i++) {
    try {
      onProgress?.(`Computing scenario ${i + 1}/${requests.length}...`, i + 1, requests.length);
      const result = await computeImpactOnServer(requests[i], (status) =>
        onProgress?.(`[${i + 1}/${requests.length}] ${status}`, i + 1, requests.length)
      );
      results.push({ success: true, data: result });
    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}
