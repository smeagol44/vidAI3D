/** Opt-in bounded physical locomotion diagnostic; no artificial selection. */
import { initializePhysics } from '../sim/physics';
import { runLocomotionTrial, type LocomotionFounder, type LocomotionTrialResult } from '../sim/locomotionAudit';

const args = process.argv.slice(2);
function positiveInt(flag: string, fallback: number) {
  const index = args.indexOf(flag);
  if(index < 0) return fallback;
  const value = Number(args[index+1]);
  if(!Number.isInteger(value) || value<=0) throw new Error(flag+' must be a positive integer');
  return value;
}
const seed = positiveInt('--seed', 4242);
const seconds = positiveInt('--seconds', 8);
if(seconds < 2 || seconds > 60) throw new Error('Use between 2 and 60 seconds');
await initializePhysics();
const founders: LocomotionFounder[]=['planar_swimmer','3d_serpent','fin_tail'];
const results:LocomotionTrialResult[]=[];
for(const founder of founders)for(const yawRadians of [0,Math.PI]){
  results.push(runLocomotionTrial({founder,seed,yawRadians,seconds}));
}
process.stdout.write(JSON.stringify({
  method:'production WorldSimulation, live genome RNN, real Rapier articulation, water drag, conserved energy',
  conditions:{seed,seconds,yawsRadians:[0,Math.PI],food:0,organismsPerTrial:1,maximumIncubatingEggs:0},
  constraints:'Observational benchmark ONLY; no offspring selection, scripted brain signals, survival subsidy or world optimization',
  trials:results
},null,2)+'\n');
