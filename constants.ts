import { MusicTrack } from './utils/helper';

export const CONFIG = {
  // Core Game Initialization
  title: {
    value: 'VIDA 3D',
    type: 'string',
    label: 'Simulation Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 1280,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 720,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // Camera
  fov: {
    value: 60,
    type: 'number',
    label: 'Field of View',
    group: 'Camera',
    min: 30,
    max: 100,
    step: 5,
  },
  cameraX: {
    value: 0,
    type: 'number',
    label: 'Camera X',
    group: 'Camera',
  },
  cameraY: {
    value: 14,
    type: 'number',
    label: 'Camera Y',
    group: 'Camera',
  },
  cameraZ: {
    value: 28,
    type: 'number',
    label: 'Camera Z',
    group: 'Camera',
  },

  // Aquatic Visuals & Lighting
  backgroundColor: {
    value: '#030d1a',
    type: 'color',
    label: 'Aquarium Depth Color',
    group: 'Visuals',
  },
  ambientColor: {
    value: '#0e3a59',
    type: 'color',
    label: 'Aquatic Ambient Color',
    group: 'Visuals',
  },
  ambientIntensity: {
    value: 1.8,
    type: 'number',
    label: 'Ambient Intensity',
    group: 'Visuals',
    min: 0.5,
    max: 5,
    step: 0.1,
  },
  sunColor: {
    value: '#38bdf8',
    type: 'color',
    label: 'Water Caustic Sunlight',
    group: 'Visuals',
  },
  sunIntensity: {
    value: 3.5,
    type: 'number',
    label: 'Sun Intensity',
    group: 'Visuals',
    min: 1,
    max: 8,
    step: 0.1,
  },
  hemiSkyColor: {
    value: '#0284c7',
    type: 'color',
    label: 'Surface Water Light',
    group: 'Visuals',
  },
  hemiGroundColor: {
    value: '#082f49',
    type: 'color',
    label: 'Seabed Fill Light',
    group: 'Visuals',
  },
  hemiIntensity: {
    value: 1.2,
    type: 'number',
    label: 'Hemisphere Intensity',
    group: 'Visuals',
    min: 0.2,
    max: 3,
    step: 0.1,
  },

  // Hydrodynamics & Eco Simulation
  waterDragCoeff: {
    value: 3.5,
    type: 'number',
    label: 'Water Drag Coeff (mu)',
    group: 'Physics',
    min: 0.5,
    max: 10,
    step: 0.5,
  },
  nutrientInflow: {
    value: 15,
    type: 'number',
    label: 'Nutrient Inflow / sec',
    group: 'Rules',
    min: 0,
    max: 50,
    step: 1,
  },
  targetNutrients: {
    value: 400,
    type: 'number',
    label: 'Target Nutrients',
    group: 'Rules',
    min: 100,
    max: 800,
    step: 50,
  },
  maxPopulation: {
    value: 45,
    type: 'number',
    label: 'Max Population',
    group: 'Rules',
    min: 10,
    max: 80,
    step: 5,
  },

  // System
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 4,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // Audio
  defaultMusicVolume: {
    value: 0.25,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
    min: 0,
    max: 1,
    step: 0.05,
  },
  defaultSfxVolume: {
    value: 0.4,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
    min: 0,
    max: 1,
    step: 0.05,
  },
  backgroundMusicUrl: {
    value: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/coral_depths.mp3',
    type: 'string',
    label: 'Background Music URL',
    group: 'AUDIO',
  },
};

const { playgroundConfig } = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], { value });
    }
  }
}

export type ConfigKey = keyof typeof CONFIG;

export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

export const PRESETS = {};

export const AVAILABLE_MUSIC_TRACKS: readonly MusicTrack[] = [
  {
    name: 'coral_depths',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/coral_depths.mp3',
    description: 'Dreamy, floating electric piano and marimba for underwater aquarium.',
  },
  {
    name: 'stellar_drift',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/stellar_drift.mp3',
    description: 'Spacious ambient synths and slow arpeggios.',
  },
];
