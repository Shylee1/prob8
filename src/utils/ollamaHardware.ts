export type DeviceOS = 'macos' | 'windows' | 'linux';

export interface DeviceHardwareProfile {
  os: DeviceOS;
  cpuCores: number;
  ramGb: number;
  gpuSummary: string;
  recommendedModelTag: 'prob8-realestate-8b' | 'prob8-realestate-3b' | 'prob8-realestate-1b';
  recommendedBaseModel: 'llama3.1:8b' | 'llama3.2:3b' | 'llama3.2:1b';
  recommendedLabel: string;
  tierReason: string;
}

export function selectOptimalOllamaModel(
  ramGb: number,
  cpuCores: number,
  gpuSummary: string
): Pick<
  DeviceHardwareProfile,
  'recommendedModelTag' | 'recommendedBaseModel' | 'recommendedLabel' | 'tierReason'
> {
  const hasStrongGpu = /apple m[1-9]|nvidia|rtx|radeon rx|arc/i.test(gpuSummary);
  if (ramGb >= 16 || (ramGb >= 12 && hasStrongGpu && cpuCores >= 8)) {
    return {
      recommendedModelTag: 'prob8-realestate-8b',
      recommendedBaseModel: 'llama3.1:8b',
      recommendedLabel: 'Prob8 RealEstate 8B (High-Precision Underwriter)',
      tierReason: `${ramGb} GB RAM & ${cpuCores} cores (${gpuSummary}) smoothly support full 8B local probate reasoning.`,
    };
  }
  if (ramGb >= 8 || cpuCores >= 6) {
    return {
      recommendedModelTag: 'prob8-realestate-3b',
      recommendedBaseModel: 'llama3.2:3b',
      recommendedLabel: 'Prob8 RealEstate 3B (Balanced Fast Mode)',
      tierReason: `${ramGb} GB RAM & ${cpuCores} cores matched to fast 3B quantized real-estate model (~2.0 GB VRAM/RAM).`,
    };
  }
  return {
    recommendedModelTag: 'prob8-realestate-1b',
    recommendedBaseModel: 'llama3.2:1b',
    recommendedLabel: 'Prob8 RealEstate 1B (Ultra-Light)',
    tierReason: `${ramGb} GB RAM matched to 1B ultra-light model (~1.3 GB) for smooth responsive local execution.`,
  };
}

export function detectClientHardwareProfile(): DeviceHardwareProfile {
  if (typeof window === 'undefined') {
    const model = selectOptimalOllamaModel(8, 4, 'Standard CPU');
    return { os: 'linux', cpuCores: 4, ramGb: 8, gpuSummary: 'Server Host', ...model };
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const os: DeviceOS = ua.includes('mac') ? 'macos' : ua.includes('win') ? 'windows' : 'linux';
  const cpuCores = window.navigator.hardwareConcurrency || 4;
  const navMem = (window.navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const ramGb = navMem && navMem > 0 ? navMem : os === 'macos' ? 16 : 8;

  let gpuSummary = 'Integrated Graphics';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && 'getExtension' in gl) {
      const webgl = gl as WebGLRenderingContext;
      const ext = webgl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        const renderer = String(webgl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
        if (renderer) gpuSummary = renderer.replace(/^ANGLE\s*\([^,]+,\s*/i, '').replace(/\)$/, '');
      }
    }
  } catch {
    // Ignore headless WebGL restriction cleanly
  }

  const model = selectOptimalOllamaModel(ramGb, cpuCores, gpuSummary);
  return {
    os,
    cpuCores,
    ramGb,
    gpuSummary,
    ...model,
  };
}

export function buildProb8Modelfile(baseModel: string): string {
  return `FROM ${baseModel}
PARAMETER temperature 0.25
PARAMETER num_ctx 8192
SYSTEM """
You are the Prob8 Probate Real Estate Acquisitions Underwriter & Disposition Specialist.
Core Expertise:
1. National US Probate Real Estate Law (Independent vs. Dependent Administration, Letters Testamentary, Overbid Hearing Windows, Small Estate Affidavits).
2. Institutional Real Estate Math (Fix & Flip 70% Rule MAO, BRRRR Post-Rehab Refi LTV, DSCR, Cap Rate, Cash-on-Cash ROI, Mobile Home / Trailer Park Pad & POH Unit Economics).
3. Empathetic, TCPA/CAN-SPAM compliant outreach messaging to estate executors, heirs, and probate attorneys.
Always return actionable, number-verified underwriting outputs.
"""
`;
}
