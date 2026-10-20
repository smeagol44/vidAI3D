import {
  Activity,
  Award,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FastForward,
  Heart,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AVAILABLE_MUSIC_TRACKS, getConfig } from './constants';
import { Game } from './Game';
import { OrganismGenome } from './sim/genome';
import { createFounderGenome } from './sim/mutation';
import { WorldSimulation } from './sim/simulation';
import { SimulationClock, OUTER_DT } from './sim/clock';
import { runLocomotionAndPhysicsVerification, VerificationReport } from './sim/verification';
import { formatTime, gameAudio, GameState, MenuOverlay, Overlay, useAutoFocus, useIsMobile } from './utils';
import BackgroundMusic from './utils/BackgroundMusic';
import { usePlayground, usePlaygroundGameLifecycle, useRpc } from './utils/usePlayground';

interface CustomWindow extends Window {
  canHandleBackKey?: boolean;
}

export default function App() {
  const { sdk, isReady } = usePlayground();
  const isMobile = useIsMobile();

  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    score: 0,
    level: 1,
    speed: 1,
    selectedOrgId: null,
  });

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Lazy single simulation instantiation (no reconstruction on renders)
  const simRef = useRef<WorldSimulation | null>(null);
  if (!simRef.current) {
    simRef.current = new WorldSimulation(4242, 14);
    simRef.current.waterDragCoeff = getConfig('waterDragCoeff');
  }

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [followSelected, setFollowSelected] = useState<boolean>(false);
  const [showEyeRays, setShowEyeRays] = useState<boolean>(true);
  const [showMouthApertures, setShowMouthApertures] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<'free' | 'top' | 'front' | 'side'>('free');

  // UI Panels
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isBrainOpen, setIsBrainOpen] = useState(false);
  const [isSpecimenBankOpen, setIsSpecimenBankOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [verificationReports, setVerificationReports] = useState<VerificationReport[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [savedSpecimens, setSavedSpecimens] = useState<OrganismGenome[]>([]);

  // Telemetry tick update state
  const [telemetry, setTelemetry] = useState(simRef.current.getTelemetry(0, 0, 0));
  const [synapseThreshold, setSynapseThreshold] = useState(0.2);

  // Playground SDK Lifecycle
  usePlaygroundGameLifecycle(gameState, sdk);

  useEffect(() => {
    (window as CustomWindow).canHandleBackKey = ['PLAYING', 'PAUSED'].includes(gameState.status);
  }, [gameState.status]);

  const clockRef = useRef<SimulationClock | null>(null);
  if(!clockRef.current) clockRef.current=new SimulationClock();
  const uiPauseRef=useRef(false);
  uiPauseRef.current=isMenuOpen||isHowToPlayOpen;

  // Physics runs on fixed ticks; React receives bounded telemetry snapshots only.
  useEffect(() => {
    let frameId=0, last=performance.now(), intervalStart=last, lastPublish=last;
    let frames=0, substeps=0, simulated=0, fps=0, throughput=0, achieved=0;
    const loop=(now:number)=>{
      const elapsed=(now-last)/1000; last=now; frames++;
      const sim=simRef.current!;
      const ticks=clockRef.current!.advance(elapsed,gameStateRef.current.status==='PLAYING'&&!uiPauseRef.current,
        gameStateRef.current.speed||1,dt=>sim.stepOuterTick(dt));
      substeps+=ticks*2; simulated+=ticks*OUTER_DT;
      if(now-intervalStart>=1000) {
        const seconds=(now-intervalStart)/1000;
        fps=Math.round(frames/seconds); throughput=Math.round(substeps/seconds); achieved=simulated/seconds;
        frames=0;substeps=0;simulated=0;intervalStart=now;
      }
      if(now-lastPublish>=100) {
        const tele=sim.getTelemetry(fps,throughput,achieved); setTelemetry(tele);
        setGameState(prev=>{
          const score=tele.highestGeneration*100+tele.totalBirths*10;
          return prev.score===score&&prev.level===tele.highestGeneration?prev:{...prev,score,level:tele.highestGeneration};
        });
        lastPublish=now;
      }
      frameId=requestAnimationFrame(loop);
    };
    frameId=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(frameId);
  },[]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isHowToPlayOpen) setIsHowToPlayOpen(false);
        else if (isVerificationOpen) setIsVerificationOpen(false);
        else setIsMenuOpen((prev) => !prev);
      } else if (e.key === ' ' || e.code === 'Space') {
        if (gameState.status === 'PLAYING' || gameState.status === 'PAUSED') {
          setGameState((prev) => ({
            ...prev,
            status: prev.status === 'PLAYING' ? 'PAUSED' : 'PLAYING',
          }));
          gameAudio.playCrispClick();
        }
      } else if (e.key === 'b' || e.key === 'B') {
        setIsBrainOpen((prev) => !prev);
      } else if (e.key === 'n' || e.key === 'N') {
        handleSpawnFounder();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.status, isHowToPlayOpen, isVerificationOpen]);

  const initSimulation = useCallback(() => {
    clockRef.current?.reset();
    if (simRef.current) {
      simRef.current.reset(14);
    }
    setSelectedOrgId(null);
    setGameState((prev) => ({ ...prev, status: 'PLAYING', score: 100, level: 1 }));
    gameAudio.playPowerupChime();
    if (sdk) sdk.startGame();
  }, [sdk]);

  const handleSpawnFounder = () => {
    if (!simRef.current) return;
    const sim = simRef.current;
    const types: ('planar_swimmer' | '3d_serpent' | 'tri_limb')[] = ['planar_swimmer', '3d_serpent', 'tri_limb'];
    const chosen = types[Math.floor(Math.random() * types.length)];
    const genome = createFounderGenome(`founder-${Date.now()}`, `Pioneer #${sim.organisms.length + 1}`, sim.prng, chosen);
    const spawnPos = new THREE.Vector3(
      sim.prng.range(-sim.tankBounds.x * 0.3, sim.tankBounds.x * 0.3),
      sim.prng.range(4, sim.tankBounds.y - 4),
      sim.prng.range(-sim.tankBounds.z * 0.3, sim.tankBounds.z * 0.3)
    );
    try { sim.addOrganism(genome, spawnPos); } catch(error) { console.warn(error); return; }
    gameAudio.playConfirmSelect();
  };

  const handleFeedAll = () => {
    if (!simRef.current) return;
    simRef.current.feedAllOrganisms(60);
    gameAudio.playPotionGulp();
  };

  const handleSaveSpecimen = (genome: OrganismGenome) => {
    if (!savedSpecimens.some((s) => s.id === genome.id)) {
      setSavedSpecimens((prev) => [...prev, genome]);
      gameAudio.playConfirmSelect();
    }
  };

  const handleRunVerification = () => {
    const results = runLocomotionAndPhysicsVerification();
    setVerificationReports(results);
    setIsVerificationOpen(true);
    gameAudio.playConfirmSelect();
  };

  const selectedOrg = simRef.current?.organisms.find((o) => o.genome.id === selectedOrgId);

  return (
    <div className="fixed inset-0 overflow-hidden touch-none flex flex-col bg-[#030d1a] text-slate-100 font-sans select-none">
      <BackgroundMusic
        url={getConfig('backgroundMusicUrl')}
        isPlaying={['PLAYING', 'PAUSED'].includes(gameState.status)}
        isMuted={isMuted}
      />

      {/* TOP HEADER HUD */}
      <header className="w-full bg-slate-950/80 border-b border-cyan-950/60 px-4 py-2 flex flex-wrap items-center justify-between gap-3 z-30 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 font-black tracking-widest text-base md:text-lg flex items-center gap-1.5">
            <Sparkles size={18} className="text-cyan-400 animate-pulse" />
            VIDA <span className="text-xs bg-cyan-900/60 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-700">3D</span>
          </span>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>T: {formatTime(telemetry.simulatedTimeSec)}</span>
            <span>•</span>
            <span className="text-emerald-400">Nutrients: {telemetry.nutrientCount}</span>
            <span>•</span>
            <span className="text-cyan-300">Organisms: {telemetry.organismCount}</span>
            <span>•</span>
            <span className="text-amber-300">Gen: {telemetry.highestGeneration}</span>
            <span>•</span>
            <span className="text-slate-300 font-mono">Phys: {telemetry.physicsThroughput} Hz ({telemetry.fps} FPS) · {telemetry.achievedSimSpeed.toFixed(1)}× achieved</span>
          </div>
        </div>

        {/* Action Controls & Overlays */}
        <div className="flex items-center gap-2">
          {/* Speed Buttons */}
          <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs">
            {[1, 2, 5, 99].map((spd) => (
              <button
                key={spd}
                onClick={() => {
                  setGameState((prev) => ({ ...prev, speed: spd }));
                  gameAudio.playCrispClick();
                }}
                className={`px-2.5 py-1 rounded font-bold transition-all ${
                  gameState.speed === spd ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}>
                {spd === 99 ? 'MAX' : `${spd}x`}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setGameState((prev) => ({
                ...prev,
                status: prev.status === 'PLAYING' ? 'PAUSED' : 'PLAYING',
              }));
              gameAudio.playCrispClick();
            }}
            className="bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-700 p-2 rounded-lg text-xs font-bold flex items-center gap-1"
            title="Pause / Play (Space)">
            {gameState.status === 'PAUSED' ? <Play size={14} /> : <Pause size={14} />}
          </button>

          <button
            onClick={() => {
              setIsLedgerOpen((prev) => !prev);
              gameAudio.playCrispClick();
            }}
            className={`p-2 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
              isLedgerOpen ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 text-emerald-400 border-slate-700 hover:bg-slate-800'
            }`}
            title="Chemical Energy Ledger">
            <Activity size={14} />
          </button>

          <button
            onClick={handleRunVerification}
            className="p-2 bg-slate-900 text-amber-400 border border-slate-700 hover:bg-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
            title="Locomotion & Physics Verification Suite">
            <CheckCircle2 size={14} />
          </button>

          {/* Menu Button */}
          <button
            onClick={() => {
              setIsMenuOpen(true);
              gameAudio.playCrispClick();
            }}
            className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md active:scale-95 ml-2">
            Menu
          </button>
        </div>
      </header>

      {/* MAIN 3D SIMULATION CANVAS */}
      <div className="flex-1 w-full min-h-0 relative">
        <Game
          simulationRef={simRef}
          gameState={gameState}
          setGameState={setGameState}
          selectedOrgId={selectedOrgId}
          setSelectedOrgId={(id) => {
            setSelectedOrgId(id);
            if (id) gameAudio.playConfirmSelect();
          }}
          followSelected={followSelected}
          showEyeRays={showEyeRays}
          showMouthApertures={showMouthApertures}
          cameraPreset={cameraPreset}
        />

        {/* FLOATING QUICK HUD */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap justify-between items-end pointer-events-none gap-2 z-20">
          <div className="flex flex-wrap gap-2 pointer-events-auto bg-slate-950/85 backdrop-blur-md p-2 rounded-xl border border-cyan-900/50 shadow-2xl">
            <button
              onClick={() => {
                simRef.current?.seedNutrients(30);
                gameAudio.playCoinPickup();
              }}
              className="bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow transition-all active:scale-95">
              <Plus size={14} /> +30 Nutrients
            </button>
            <button
              onClick={handleSpawnFounder}
              className="bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow transition-all active:scale-95">
              <Plus size={14} /> +1 Pioneer
            </button>
            <button
              onClick={handleFeedAll}
              className="bg-cyan-600/90 hover:bg-cyan-500 text-slate-950 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow transition-all active:scale-95">
              <Zap size={14} /> Feed All
            </button>
            <button
              onClick={() => {
                setIsSpecimenBankOpen(true);
                gameAudio.playCrispClick();
              }}
              className="bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 border border-cyan-900 transition-all">
              <BookOpen size={14} /> Specimen Bank
            </button>
          </div>

          <div className="flex gap-1 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-xl border border-cyan-900/50 pointer-events-auto">
            {(['free', 'top', 'front', 'side'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setCameraPreset(preset);
                  gameAudio.playHoverMicroTone();
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded capitalize transition-all ${
                  cameraPreset === preset ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}>
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* SELECTED ORGANISM INSPECTOR SIDEBAR */}
        {selectedOrg && (
          <aside className="absolute top-4 right-4 w-72 md:w-80 bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-4 shadow-2xl z-20 flex flex-col gap-3 max-h-[85vh] overflow-y-auto ui-layer text-xs">
            <div className="flex items-center justify-between border-b border-cyan-900/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full shadow" style={{ backgroundColor: selectedOrg.genome.color }} />
                <h3 className="font-black text-cyan-300 text-sm tracking-wide">{selectedOrg.genome.name}</h3>
              </div>
              <button
                onClick={() => setSelectedOrgId(null)}
                className="text-slate-400 hover:text-white p-1 rounded">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 text-[11px] block">Reserves</span>
                <span className="font-bold text-emerald-400 text-sm">{Math.round(selectedOrg.reserves)} / {Math.round(selectedOrg.reserveCapacity)} energy</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Generation</span>
                <span className="font-bold text-amber-400 text-sm">Gen {selectedOrg.genome.generation}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Age</span>
                <span className="font-mono text-slate-200">{formatTime(selectedOrg.ageSec)}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Food Eaten</span>
                <span className="font-mono text-cyan-300">{selectedOrg.totalFoodEaten}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">COM Speed</span>
                <span className="font-mono text-slate-200">{(selectedOrg.comVel.length() * 100).toFixed(1)} cm/s</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Mechanical Work</span>
                <span className="font-mono text-slate-200">{Math.round(selectedOrg.totalWorkJoules)} physical J</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Body construction</span>
                <span className="font-mono text-slate-200">{Math.round(selectedOrg.structuralEnergy)} energy</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Egg eligibility</span>
                <span className="font-mono text-slate-200">{simRef.current?.reproductionBlockReason(selectedOrg) ?? 'Ready to lay'}</span>
              </div>
            </div>

            {/* Joints and Anchor Error Readout */}
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-bold block mb-1">
                Anatomy ({selectedOrg.bodies.length} parts, {selectedOrg.joints.length} joints)
              </span>
              <div className="space-y-1 text-[11px]">
                {selectedOrg.bodies.filter(b => (b.partGene.thicknessScaleY ?? 1) < 1).map(b => (
                  <div key={b.id} className="flex justify-between items-center text-slate-300 bg-slate-950/50 px-2 py-1 rounded">
                    <span>{b.id} · thin plate</span>
                    <span className="font-mono text-cyan-400">
                      {(b.dimX * 100).toFixed(0)} × {(b.dimY * 100).toFixed(1)} × {(b.dimZ * 100).toFixed(0)} cm
                    </span>
                  </div>
                ))}
                {selectedOrg.joints.map((j, idx) => (
                  <div key={idx} className="flex justify-between items-center text-slate-300 bg-slate-950/50 px-2 py-1 rounded">
                    <span>
                      Joint #{idx + 1} ({j.child.partGene.hingeAxis}-axis)
                      {j.child.partGene.motorStrokeDuty !== undefined &&
                        <span className="text-sky-400 ml-1">power {Math.round(j.child.partGene.motorStrokeDuty * 100)}%</span>}
                      {j.child.partGene.motorFeatherAngle !== undefined &&
                        <span className="text-teal-400 ml-1">feather {(j.child.partGene.motorFeatherAngle * 180 / Math.PI).toFixed(0)}°</span>}
                    </span>
                    <span className="font-mono text-cyan-400">
                      {(j.currentAngle * (180 / Math.PI)).toFixed(1)}° | err: {(j.anchorError * 1000).toFixed(2)}mm
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mouth Aperture & Feeding Inspector */}
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-400 font-bold block">
                  Mouth Apertures ({selectedOrg.bodies.filter((b) => b.partGene.hasMouth).length})
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Real-time Aperture</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                {selectedOrg.bodies
                  .filter((b) => b.partGene.hasMouth)
                  .map((b) => {
                    const diet = b.partGene.mouthDiet || 'herbivore';
                    const face = b.partGene.mouthFace || '-Z';
                    const dietColor =
                      diet === 'carnivore'
                        ? 'text-red-400'
                        : diet === 'herbivore'
                        ? 'text-emerald-400'
                        : 'text-purple-400';
                    const permittedFoods =
                      diet === 'herbivore'
                        ? 'Nutrients only'
                        : diet === 'carnivore'
                        ? 'Prey & Eggs only'
                        : 'Nutrients, Prey & Eggs (0.5x)';

                    return (
                      <div key={b.id} className="bg-slate-950/60 p-2 rounded border border-slate-800/80">
                        <div className="flex justify-between items-center mb-0.5 font-semibold">
                          <span className="text-slate-200">{b.id} (Face: <span className="text-cyan-300">{face}</span>)</span>
                          <span className={`capitalize font-bold ${dietColor}`}>{diet}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mb-1">
                          Permitted: <span className="text-slate-300">{permittedFoods}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Recent Successful Feeding Events */}
              <div className="mt-2 pt-2 border-t border-slate-800/80">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                  Recent Feeding Events
                </span>
                {selectedOrg.recentFeedingEvents.length === 0 ? (
                  <div className="text-[10px] text-slate-500 italic">No recent feeding events recorded.</div>
                ) : (
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {selectedOrg.recentFeedingEvents.slice(0, 4).map((evt, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[10px] bg-slate-950/40 px-1.5 py-0.5 rounded font-mono">
                        <span className="text-slate-400">
                          {evt.foodType.toUpperCase()} ({evt.mouthFace})
                        </span>
                        <span className="text-emerald-400 font-bold">+{evt.energyGained.toFixed(1)} J</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFollowSelected((prev) => !prev)}
                className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  followSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}>
                <Camera size={14} /> Follow
              </button>
              <button
                onClick={() => setShowEyeRays((prev) => !prev)}
                className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  showEyeRays ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}>
                <Eye size={14} /> 3D Rays
              </button>
            </div>

            {/* Show Mouth Apertures Toggle */}
            <button
              onClick={() => setShowMouthApertures((prev) => !prev)}
              className={`w-full py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                showMouthApertures ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}>
              <Layers size={14} /> Show Mouth Apertures
            </button>

            <button
              onClick={() => {
                setIsBrainOpen(true);
                gameAudio.playCrispClick();
              }}
              className="w-full bg-cyan-600/90 hover:bg-cyan-500 text-slate-950 font-black py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg">
              <Activity size={15} /> Inspect Neural Brain
            </button>

            <button
              onClick={() => handleSaveSpecimen(selectedOrg.genome)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold py-2 rounded-xl flex items-center justify-center gap-2 border border-cyan-900">
              <Award size={15} /> Save to Specimen Bank
            </button>
          </aside>
        )}

        {/* NEURAL BRAIN INSPECTOR OVERLAY */}
        {isBrainOpen && selectedOrg && (
          <div className="absolute inset-4 md:inset-10 bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 rounded-3xl p-6 shadow-2xl z-40 flex flex-col gap-4 overflow-hidden ui-layer">
            <div className="flex items-center justify-between border-b border-cyan-900 pb-3">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedOrg.genome.color }} />
                <h2 className="text-xl font-black text-cyan-300 tracking-wide">
                  Brain Inspector: {selectedOrg.genome.name} (Gen {selectedOrg.genome.generation})
                </h2>
              </div>
              <button
                onClick={() => setIsBrainOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 border border-slate-800">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto pr-1 text-xs">
              <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col">
                <h4 className="font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
                  <span>Sensory Inputs ({selectedOrg.brain.inputs.length})</span>
                  <span className="text-cyan-400 font-mono">RGB + Proprioception</span>
                </h4>
                <div className="space-y-1.5 overflow-y-auto flex-1 max-h-60 md:max-h-none pr-1">
                  {Array.from(selectedOrg.brain.inputs).slice(0, 24).map((val, idx) => (
                    <div key={idx} className="flex items-center justify-between font-mono bg-slate-950/60 px-2 py-1 rounded">
                      <span className="text-slate-400">In #{idx}</span>
                      <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden mx-2">
                        <div
                          className="bg-cyan-400 h-full transition-all duration-75"
                          style={{ width: `${Math.min(100, Math.max(0, (val + 1) * 50))}%` }}
                        />
                      </div>
                      <span className="text-cyan-300 w-10 text-right">{val.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col">
                <h4 className="font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
                  <span>Recurrent Hidden State ({selectedOrg.brain.genome.hiddenCount})</span>
                  <span className="text-amber-400 font-mono">Leaky Integrators</span>
                </h4>
                <div className="space-y-1.5 overflow-y-auto flex-1 max-h-60 md:max-h-none pr-1">
                  {Array.from(selectedOrg.brain.hiddenState).map((val, idx) => (
                    <div key={idx} className="flex items-center justify-between font-mono bg-slate-950/60 px-2 py-1 rounded">
                      <span className="text-slate-400">Neuron #{idx}</span>
                      <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden mx-2">
                        <div
                          className={`h-full transition-all duration-75 ${val >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.abs(val) * 100}%` }}
                        />
                      </div>
                      <span className="text-amber-300 w-10 text-right">{val.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col">
                <h4 className="font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between">
                  <span>Motor Outputs ({selectedOrg.brain.outputs.length})</span>
                  <span className="text-emerald-400 font-mono">Revolute Drives</span>
                </h4>
                <div className="space-y-1.5 overflow-y-auto flex-1 max-h-60 md:max-h-none pr-1">
                  {Array.from(selectedOrg.brain.outputs).map((val, idx) => (
                    <div key={idx} className="flex items-center justify-between font-mono bg-slate-950/60 px-2 py-1 rounded">
                      <span className="text-slate-400">Hinge Ch #{idx}</span>
                      <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden mx-2">
                        <div
                          className={`h-full transition-all duration-75 ${val >= 0 ? 'bg-cyan-400' : 'bg-orange-400'}`}
                          style={{ width: `${Math.abs(val) * 100}%` }}
                        />
                      </div>
                      <span className="text-emerald-300 w-10 text-right">{val.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
              <span className="text-slate-400 text-xs">Synapse Connectivity Threshold: {synapseThreshold.toFixed(2)}</span>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={synapseThreshold}
                onChange={(e) => setSynapseThreshold(parseFloat(e.target.value))}
                className="w-48 accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* VERIFICATION RESULTS MODAL */}
        {isVerificationOpen && (
          <div className="absolute inset-4 md:inset-16 bg-slate-950/95 backdrop-blur-xl border border-amber-500/40 rounded-3xl p-6 shadow-2xl z-50 flex flex-col gap-4 overflow-hidden ui-layer text-xs">
            <div className="flex items-center justify-between border-b border-amber-900/60 pb-3">
              <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
                <CheckCircle2 size={20} /> Locomotion &amp; Physics Rigorous Verification
              </h2>
              <button
                onClick={() => setIsVerificationOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 border border-slate-800">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {verificationReports.map((report, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border ${
                    report.passed ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200' : 'bg-rose-950/25 border-rose-500/30 text-rose-200'
                  }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${report.passed ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      {report.testName}
                    </span>
                    <span className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${report.passed ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'}`}>
                      {report.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-amber-300 mb-1">{report.measurement}</div>
                  <div className="text-slate-400 text-[11px] leading-relaxed">{report.details}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHEMICAL ENERGY LEDGER OVERLAY */}
        {isLedgerOpen && (
          <div className="absolute top-4 left-4 w-80 bg-slate-950/95 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-4 shadow-2xl z-30 ui-layer text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <h3 className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Activity size={15} /> Chemical Energy Ledger
              </h3>
              <button onClick={() => setIsLedgerOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 font-mono">
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Total External Input:</span>
                <span className="text-slate-200 font-bold">{Math.round(telemetry.chemicalEnergyLedger.totalInput)} energy</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Organism Reserves:</span>
                <span className="text-emerald-400">{Math.round(telemetry.chemicalEnergyLedger.organismReserves)} energy</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Organism Tissue:</span>
                <span className="text-cyan-400">{Math.round(telemetry.chemicalEnergyLedger.organismTissue)} energy</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Egg Energy:</span>
                <span className="text-amber-400">{Math.round(telemetry.chemicalEnergyLedger.eggEnergy)} energy</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-slate-400">Nutrients in Water:</span>
                <span className="text-emerald-300">{Math.round(telemetry.chemicalEnergyLedger.nutrientEnergy)} energy</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Chemical heat / losses:</span>
                <span className="text-rose-400">{Math.round(telemetry.chemicalEnergyLedger.dissipatedMetabolicWork)} energy</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">External removals:</span>
                <span className="text-amber-300">{Math.round(telemetry.chemicalEnergyLedger.externalRemovals)} energy</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Physical motor work:</span>
                <span className="text-slate-200">{Math.round(telemetry.chemicalEnergyLedger.mechanicalWorkJoules)} J</span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-700">
                <span className="text-slate-200 font-bold">Conservation residual:</span>
                <span className={Math.abs(telemetry.chemicalEnergyLedger.conservationResidual) < 0.01 ? 'text-emerald-400' : 'text-rose-400'}>
                  {telemetry.chemicalEnergyLedger.conservationResidual.toFixed(3)} energy
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SPECIMEN BANK MODAL */}
        {isSpecimenBankOpen && (
          <div className="absolute inset-6 md:inset-20 bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 rounded-3xl p-6 shadow-2xl z-40 flex flex-col gap-4 ui-layer text-xs">
            <div className="flex items-center justify-between border-b border-cyan-900 pb-3">
              <h2 className="text-lg font-black text-cyan-300 flex items-center gap-2">
                <BookOpen size={18} /> Specimen Bank &amp; Ancestry
              </h2>
              <button
                onClick={() => setIsSpecimenBankOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-900 border border-slate-800">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {savedSpecimens.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No curated specimens saved yet. Select an organism in the tank and click &quot;Save to Specimen Bank&quot;.
                </div>
              ) : (
                savedSpecimens.map((specimen) => (
                  <div
                    key={specimen.id}
                    className="flex items-center justify-between bg-slate-900/80 p-3 rounded-xl border border-slate-800 hover:border-cyan-500/30">
                    <div className="flex items-center gap-3">
                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: specimen.color }} />
                      <div>
                        <div className="font-bold text-slate-200">{specimen.name}</div>
                        <div className="text-[11px] text-slate-400">
                          Gen {specimen.generation} • {specimen.parts.length} segments • 24 neurons
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (simRef.current) {
                            try { simRef.current.addOrganism(specimen, new THREE.Vector3(0, 8, 0)); } catch(error) { console.warn(error); return; }
                            gameAudio.playPowerupChime();
                          }
                        }}
                        className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg">
                        Spawn In Tank
                      </button>
                      <button
                        onClick={() => {
                          const jsonStr = JSON.stringify(specimen, null, 2);
                          const blob = new Blob([jsonStr], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${specimen.name.replace(/\s+/g, '_')}_genome.json`;
                          a.click();
                        }}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg">
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* START SCREEN OVERLAY */}
      {gameState.status === 'START' && (
        <MenuOverlay tone="neutral">
          <div className="bg-slate-950/90 border border-cyan-500/40 p-6 md:p-8 rounded-2xl shadow-2xl flex flex-col items-center w-full max-w-md backdrop-blur-xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center mb-4 text-cyan-400">
              <Sparkles size={32} />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-cyan-400 mb-2 tracking-wider">
              VIDA 3D
            </h1>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              A 3D voxel aquatic artificial-life sandbox. Observe articulated neural organisms sense 3D colors, swim via genuine physical hydrodynamics, feed, and evolve across generations.
            </p>
            <button
              onClick={initSimulation}
              autoFocus
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-6 py-3.5 rounded-full text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 active:scale-95">
              <Play size={20} />
              ENTER ECOSYSTEM
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* GAME MENU OVERLAY */}
      {isMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={40}>
          <div className="w-full max-w-md flex flex-col items-center bg-slate-900 border-2 border-cyan-500/40 rounded-2xl p-6 shadow-2xl text-slate-100">
            <h2 className="text-2xl font-black text-cyan-400 mb-6 uppercase tracking-wider">
              Simulation Menu
            </h2>

            <div className="w-full space-y-3">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  gameAudio.playCrispClick();
                }}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black py-3 rounded-xl text-base transition-all flex items-center justify-center gap-2">
                <Play size={18} /> Resume Simulation
              </button>

              <button
                onClick={() => {
                  initSimulation();
                  setIsMenuOpen(false);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-sm border border-slate-700 flex items-center justify-center gap-2">
                <RotateCcw size={16} /> Reset Ecosystem (New Seed)
              </button>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    const newMuted = !isMuted;
                    setIsMuted(newMuted);
                    gameAudio.playCrispClick();
                  }}
                  className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border ${
                    isMuted ? 'bg-red-950/40 border-red-800 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}>
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  Music: {isMuted ? 'Off' : 'On'}
                </button>

                <button
                  onClick={() => {
                    const newSfx = gameAudio.toggleMute();
                    setSfxMuted(newSfx);
                  }}
                  className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 border ${
                    sfxMuted ? 'bg-red-950/40 border-red-800 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}>
                  {sfxMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  SFX: {sfxMuted ? 'Off' : 'On'}
                </button>
              </div>

              <button
                onClick={() => {
                  setIsHowToPlayOpen(true);
                  gameAudio.playCrispClick();
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold py-2.5 rounded-xl text-sm border border-cyan-900 flex items-center justify-center gap-2">
                <Info size={16} /> How to Observe &amp; Play
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* HOW TO PLAY GUIDE OVERLAY */}
      {isHowToPlayOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[1001] flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-cyan-500/50 rounded-2xl p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-cyan-400 mb-4 flex items-center gap-2">
              <BookOpen size={20} /> Guide to VIDA 3D
            </h3>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div>
                <h4 className="font-bold text-cyan-300 text-sm mb-1">1. Artificial Life &amp; 3D Hydrodynamics</h4>
                <p>
                  Creatures consist of articulated voxel-based cuboids, including evolvable physically thin plates, connected by real revolute joints. Swimming emerges from the normal linear surface-resistance model in 3D water without artificial forces.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-cyan-300 text-sm mb-1">2. 3D Ray Vision</h4>
                <p>
                  Eyes cast a 3×3 cone of 3D occluding rays into the aquarium, sensing physical emerald nutrients, amber eggs, and other swimming organisms in genuine RGB space.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-cyan-300 text-sm mb-1">3. Feeding &amp; Evolution</h4>
                <p>
                  Organisms ingest food when nutrients physically touch mouth apertures. Funded eggs hatch mutated offspring with altered morphology, motor limits, and recurrent neural synaptic weights.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setIsHowToPlayOpen(false);
                gameAudio.playCrispClick();
              }}
              className="mt-6 w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black py-2.5 rounded-xl transition-all">
              Close Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
