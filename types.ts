export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Position3D = [number, number, number];

export interface Entity3D {
  id: string | number;
  type?: string;
  position: Vec3 | Position3D;
  rotation?: Vec3 | Position3D;
  scale?: Vec3 | Position3D;
  velocity?: Vec3;
  active?: boolean;
  [key: string]: any;
}
