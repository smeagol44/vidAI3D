import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getConfig } from './constants';
import { WorldSimulation } from './sim/simulation';
import type { RigidCuboid } from './sim/physics';
import { getMouthApertureLocal } from './sim/genome';
import { GameState } from './utils/helper';

interface GameProps {
  simulationRef: React.MutableRefObject<WorldSimulation | null>;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string | null) => void;
  followSelected: boolean;
  showEyeRays: boolean;
  showMouthApertures: boolean;
  cameraPreset: 'free' | 'top' | 'front' | 'side';
}

function AquariumEnvironment({ bounds }: { bounds: THREE.Vector3 }) {
  const seabedBlocks = useMemo(() => {
    const blocks: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [];
    const colors = ['#082f49', '#0c4a6e', '#075985', '#0369a1'];
    const sx = Math.floor(bounds.x / 2);
    const sz = Math.floor(bounds.z / 2);

    for (let x = -sx; x <= sx; x += 2) {
      for (let z = -sz; z <= sz; z += 2) {
        const height = 0.5 + Math.sin(x * 0.3) * Math.cos(z * 0.3) * 0.3;
        const color = colors[Math.abs(Math.floor(x + z)) % colors.length];
        blocks.push({
          pos: [x, height / 2, z],
          size: [1.9, height, 1.9],
          color,
        });
      }
    }
    return blocks;
  }, [bounds]);

  return (
    <group>
      {/* Voxel Seabed */}
      {seabedBlocks.map((b, i) => (
        <mesh key={i} position={b.pos} receiveShadow>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={b.color} roughness={0.9} />
        </mesh>
      ))}

      {/* Aquarium Boundary Box */}
      <mesh position={[0, bounds.y / 2, 0]}>
        <boxGeometry args={[bounds.x, bounds.y, bounds.z]} />
        <meshBasicMaterial color="#0284c7" wireframe transparent opacity={0.25} />
      </mesh>

      {/* 4 Corner Depth Pillars */}
      {[-bounds.x / 2, bounds.x / 2].map((x, xi) =>
        [-bounds.z / 2, bounds.z / 2].map((z, zi) => (
          <mesh key={`${xi}-${zi}`} position={[x, bounds.y / 2, z]}>
            <boxGeometry args={[0.3, bounds.y, 0.3]} />
            <meshStandardMaterial color="#0369a1" roughness={0.6} metalness={0.2} />
          </mesh>
        ))
      )}

    </group>
  );
}

function BodyTransform({body,children}:{body:RigidCuboid;children:React.ReactNode}) {
  const ref=useRef<THREE.Group>(null);
  useFrame(()=>{if(ref.current){ref.current.position.copy(body.pos);ref.current.quaternion.copy(body.rot);}});
  return <group ref={ref} position={body.pos.toArray()} quaternion={body.rot.toArray() as any}>{children}</group>;
}

function SceneEntities({
  simulationRef,
  selectedOrgId,
  setSelectedOrgId,
  showEyeRays,
  showMouthApertures,
}: {
  simulationRef: React.MutableRefObject<WorldSimulation | null>;
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string | null) => void;
  showEyeRays: boolean;
  showMouthApertures: boolean;
}) {
  const nutrientsMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const sim = simulationRef.current;
    if (!sim) return;

    // Update Nutrients InstancedMesh
    if (nutrientsMeshRef.current) {
      const mesh = nutrientsMeshRef.current;
      const count = sim.nutrients.length;
      for (let i = 0; i < 800; i++) {
        if (i < count) {
          const nut = sim.nutrients[i];
          dummy.position.copy(nut.pos);
          dummy.rotation.set(nut.pos.x, nut.pos.y, nut.pos.z);
          dummy.scale.set(0.35, 0.35, 0.35);
        } else {
          dummy.scale.set(0, 0, 0);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  const sim = simulationRef.current;

  return (
    <group>
      {/* Emerald Nutrients */}
      <instancedMesh
        ref={nutrientsMeshRef}
        args={[undefined, undefined, 800]}
        castShadow
        receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#10b981" roughness={0.4} emissive="#059669" emissiveIntensity={0.5} />
      </instancedMesh>

      {/* Block Eggs */}
      <group>
        {sim?.eggs.map((egg) => (
          <group key={egg.id} position={egg.pos.toArray()}>
            <mesh castShadow>
              <boxGeometry args={[0.5, 0.65, 0.5]} />
              <meshStandardMaterial color="#f59e0b" roughness={0.3} emissive="#d97706" emissiveIntensity={0.6} />
            </mesh>
            <mesh position={[0, 0.35, 0]}>
              <boxGeometry args={[0.3, 0.15, 0.3]} />
              <meshStandardMaterial color="#fbbf24" roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Articulated Dynamic Organisms */}
      <group>
        {sim?.organisms.map((org) => {
          const isSelected = org.genome.id === selectedOrgId;
          return (
            <group
              key={org.genome.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedOrgId(org.genome.id);
              }}>
              {org.bodies.map((body, pIdx) => {
                const sizeX = body.dimX;
                const sizeY = body.dimY;
                const sizeZ = body.dimZ;

                return (
                  <BodyTransform key={body.id} body={body}>
                    {/* Main Part Cuboid */}
                    <mesh castShadow receiveShadow>
                      <boxGeometry args={[sizeX, sizeY, sizeZ]} />
                      <meshStandardMaterial
                        color={org.genome.color}
                        roughness={0.5}
                        metalness={0.1}
                        emissive={isSelected ? '#38bdf8' : '#000000'}
                        emissiveIntensity={isSelected ? 0.4 : 0}
                      />
                    </mesh>

                    {/* Voxel Edge Outlines */}
                    <lineSegments>
                      <edgesGeometry args={[new THREE.BoxGeometry(sizeX, sizeY, sizeZ)]} />
                      <lineBasicMaterial color={isSelected ? '#38bdf8' : '#082f49'} linewidth={1.5} />
                    </lineSegments>

                    {/* Mouth Aperture */}
                    {body.partGene.hasMouth && (() => {
                      const ap = getMouthApertureLocal(
                        body.partGene.mouthFace || '-Z',
                        body.partGene.dimX,
                        body.partGene.dimY,
                        body.partGene.dimZ
                      );
                      const diet = body.partGene.mouthDiet;
                      // 2D VIDA matching colors: Green herbivore (#22c55e), Red carnivore (#ef4444), Purple omnivore (#a855f7)
                      const baseColor =
                        diet === 'carnivore'
                          ? '#ef4444'
                          : diet === 'herbivore'
                          ? '#22c55e'
                          : '#a855f7';

                      // Check feeding transfer highlight (< 0.25s ago)
                      const lastFeed = org.lastFeedingHighlightSec[body.id] || 0;
                      const isHighlighted = (sim?.simTime || 0) - lastFeed < 0.25;

                      return (
                        <group
                          position={ap.localPos.toArray()}
                          rotation={ap.localEuler.toArray() as any}>
                          {/* Main Mouth Plate */}
                          <mesh castShadow>
                            <boxGeometry args={[ap.plateWidth, ap.plateHeight, 0.06]} />
                            <meshStandardMaterial
                              color={baseColor}
                              emissive={isHighlighted ? '#ffffff' : baseColor}
                              emissiveIntensity={isHighlighted ? 0.9 : 0.2}
                            />
                          </mesh>

                          {/* Extended Aperture Reach/Volume Visualization */}
                          {showMouthApertures && (
                            <mesh position={[0, 0, ap.radius * 0.4]}>
                              <cylinderGeometry args={[ap.radius, ap.radius * 0.7, ap.radius * 0.8, 16, 1, true]} />
                              <meshBasicMaterial
                                color={baseColor}
                                wireframe
                                transparent
                                opacity={isHighlighted ? 0.8 : 0.35}
                                side={THREE.DoubleSide}
                              />
                            </mesh>
                          )}
                        </group>
                      );
                    })()}

                    {/* Eye Sensor */}
                    {body.partGene.hasEye && (
                      <group position={[0, sizeY * 0.3, -sizeZ / 2 - 0.04]}>
                        <mesh castShadow>
                          <boxGeometry args={[sizeX * 0.35, sizeY * 0.35, 0.1]} />
                          <meshStandardMaterial color="#ffffff" />
                        </mesh>
                        <mesh position={[0, 0, -0.06]}>
                          <boxGeometry args={[sizeX * 0.18, sizeY * 0.18, 0.05]} />
                          <meshStandardMaterial color="#0284c7" />
                        </mesh>
                      </group>
                    )}
                  </BodyTransform>
                );
              })}

              {/* Selection Halo */}
              {isSelected && (
                <mesh position={org.com.toArray()}>
                  <sphereGeometry args={[1.6, 16, 16]} />
                  <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.35} />
                </mesh>
              )}
            </group>
          );
        })}
      </group>

      {/* Selected Eye 3D Ray Cones */}
      {showEyeRays && selectedOrgId && (
        <SelectedEyeRays simulationRef={simulationRef} selectedOrgId={selectedOrgId} />
      )}
    </group>
  );
}

function SelectedEyeRays({
  simulationRef,
  selectedOrgId,
}: {
  simulationRef: React.MutableRefObject<WorldSimulation | null>;
  selectedOrgId: string;
}) {
  const linesRef = useRef<THREE.LineSegments>(null);

  useFrame(() => {
    if (!linesRef.current) return;
    const sim = simulationRef.current;
    if (!sim) return;
    const org = sim.organisms.find((o) => o.genome.id === selectedOrgId);
    if (!org) return;

    const positions: number[] = [];
    const colors: number[] = [];

    let rayColorIdx = 0;
    for (const body of org.bodies) {
      if (body.partGene.hasEye) {
        const eyeOrigin = body.pos.clone();
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(body.rot);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(body.rot);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(body.rot);

        for (let ry = -1; ry <= 1; ry++) {
          for (let rx = -1; rx <= 1; rx++) {
            const rayDir = fwd.clone()
              .addScaledVector(right, rx * 0.3)
              .addScaledVector(up, ry * 0.3)
              .normalize();
            const end = eyeOrigin.clone().addScaledVector(rayDir, body.partGene.eyeRange || 15);

            positions.push(eyeOrigin.x, eyeOrigin.y, eyeOrigin.z);
            positions.push(end.x, end.y, end.z);

            const hitCol = org.eyeRayRGBs[rayColorIdx++] || new THREE.Color(0.2, 0.5, 0.8);
            colors.push(hitCol.r, hitCol.g, hitCol.b);
            colors.push(hitCol.r, hitCol.g, hitCol.b);
          }
        }
      }
    }

    const geom = linesRef.current.geometry;
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  });

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry />
      <lineBasicMaterial vertexColors transparent opacity={0.65} linewidth={1.5} />
    </lineSegments>
  );
}

function CameraRig({
  simulationRef,
  selectedOrgId,
  followSelected,
  cameraPreset,
}: {
  simulationRef: React.MutableRefObject<WorldSimulation | null>;
  selectedOrgId: string | null;
  followSelected: boolean;
  cameraPreset: 'free' | 'top' | 'front' | 'side';
}) {
  const { camera } = useThree();
  const targetLookAt = useRef(new THREE.Vector3(0, 8, 0));
  const currentCamPos = useRef(new THREE.Vector3(0, 14, 28));

  const isDragging = useRef(false);
  const dragType = useRef<'orbit' | 'pan'>('orbit');
  const prevPointer = useRef({ x: 0, y: 0 });
  const spherical = useRef(new THREE.Spherical(32, Math.PI / 3, 0));

  useEffect(() => {
    if (cameraPreset === 'top') {
      spherical.current.set(34, 0.05, 0);
    } else if (cameraPreset === 'front') {
      spherical.current.set(30, Math.PI / 2, 0);
    } else if (cameraPreset === 'side') {
      spherical.current.set(30, Math.PI / 2, Math.PI / 2);
    }
  }, [cameraPreset]);

  useEffect(() => {
    const handleDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest?.('.ui-layer')) return;
      isDragging.current = true;
      dragType.current = e.button === 2 || e.shiftKey ? 'pan' : 'orbit';
      prevPointer.current = { x: e.clientX, y: e.clientY };
    };

    const handleMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - prevPointer.current.x;
      const dy = e.clientY - prevPointer.current.y;
      prevPointer.current = { x: e.clientX, y: e.clientY };

      if (dragType.current === 'orbit') {
        spherical.current.theta -= dx * 0.006;
        spherical.current.phi = THREE.MathUtils.clamp(spherical.current.phi - dy * 0.006, 0.08, Math.PI * 0.92);
      } else {
        const panSpeed = 0.03;
        targetLookAt.current.x -= dx * panSpeed;
        targetLookAt.current.y += dy * panSpeed;
      }
    };

    const handleUp = () => {
      isDragging.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      spherical.current.radius = THREE.MathUtils.clamp(spherical.current.radius + e.deltaY * 0.02, 6, 65);
    };

    window.addEventListener('pointerdown', handleDown);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const sim = simulationRef.current;

    if (followSelected && selectedOrgId && sim) {
      const selectedOrg = sim.organisms.find((o) => o.genome.id === selectedOrgId);
      if (selectedOrg) {
        targetLookAt.current.lerp(selectedOrg.com, Math.min(1, dt * 5));
      }
    }

    const offset = new THREE.Vector3().setFromSpherical(spherical.current);
    const desiredPos = targetLookAt.current.clone().add(offset);

    currentCamPos.current.lerp(desiredPos, Math.min(1, dt * 6));
    camera.position.copy(currentCamPos.current);
    camera.lookAt(targetLookAt.current);
  });

  return null;
}

export function Game({
  simulationRef,
  gameState,
  setGameState,
  selectedOrgId,
  setSelectedOrgId,
  followSelected,
  showEyeRays,
  showMouthApertures,
  cameraPreset,
}: GameProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="w-full h-full canvas-wrapper relative bg-[#030d1a] cursor-grab active:cursor-grabbing">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          fov: getConfig('fov'),
          near: 0.1,
          far: 200,
          position: [getConfig('cameraX'), getConfig('cameraY'), getConfig('cameraZ')],
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        scene={{
          background: new THREE.Color(getConfig('backgroundColor')),
          fog: new THREE.FogExp2('#030d1a', 0.018),
        }}>
        <Suspense fallback={null}>
          <CameraRig
            simulationRef={simulationRef}
            selectedOrgId={selectedOrgId}
            followSelected={followSelected}
            cameraPreset={cameraPreset}
          />

          <ambientLight
            color={getConfig('ambientColor')}
            intensity={getConfig('ambientIntensity')}
          />
          <directionalLight
            position={[12, 25, 14]}
            intensity={getConfig('sunIntensity')}
            color={getConfig('sunColor')}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <hemisphereLight
            color={getConfig('hemiSkyColor')}
            groundColor={getConfig('hemiGroundColor')}
            intensity={getConfig('hemiIntensity')}
          />

          <AquariumEnvironment bounds={simulationRef.current?.tankBounds || new THREE.Vector3(26, 16, 26)} />

          <SceneEntities
            simulationRef={simulationRef}
            selectedOrgId={selectedOrgId}
            setSelectedOrgId={setSelectedOrgId}
            showEyeRays={showEyeRays}
            showMouthApertures={showMouthApertures}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
