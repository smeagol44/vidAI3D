import * as THREE from 'three';

export {
  BackgroundMusic,
  type BackgroundMusicProps,
} from './utils/BackgroundMusic';

export {
  MenuOverlay,
  Overlay,
  formatTime,
  gameAudio,
  useAutoFocus,
  useInput,
  useIsMobile,
  type GameState,
  type InputAction,
  type InputSnapshot,
  type MenuOverlayProps,
  type MusicTrack,
  type PointerState,
} from './utils/helper';

export {
  usePlayground,
  usePlaygroundGameLifecycle,
  useRpc,
  type BaseGameState,
} from './utils/usePlayground';

export function toVec3(v: { x: number; y: number; z: number }): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: v.x,
    y: v.y,
    z: v.z,
  };
}

export function toQuat(q: { x: number; y: number; z: number; w: number }): {
  x: number;
  y: number;
  z: number;
  w: number;
} {
  return {
    x: q.x,
    y: q.y,
    z: q.z,
    w: q.w,
  };
}

export const tempVec3 = new THREE.Vector3();
export const tempVec3B = new THREE.Vector3();
export const tempQuat = new THREE.Quaternion();
export const tempEuler = new THREE.Euler();
