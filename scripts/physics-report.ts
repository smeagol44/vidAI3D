/** Focused physical references; no browser, long ecosystem run, or hidden reserve changes. */
import {writeFileSync} from 'node:fs';
import {initializePhysics,BODY_DENSITY,DEFAULT_WATER_RESISTANCE,PHYSICS_DT} from '../sim/physics';
import {measureReference} from '../sim/verification';
await initializePhysics();
const result={version:'0.2.0',solver:'@dimforge/rapier3d-compat 0.21.0',
  calibration:{voxelMeters:.3,densityKgPerCubicMeter:BODY_DENSITY,waterResistance:DEFAULT_WATER_RESISTANCE,
    physicsDt:PHYSICS_DT,outerDt:1/60,solverIterations:12,internalPgsIterations:2,
    frequencyHz:.65,maxTorqueNm:400,neutralTorqueAllowanceNm:200,neutralStiffnessNmPerRad:450,dampingNmSecondsPerRad:60,
    chemicalCostPerMechanicalJoule:.005,startingReserve:250},
  planar:measureReference('planar_swimmer'),nonplanar:measureReference('3d_serpent'),
  zeroDrag:measureReference('planar_swimmer',{mu:0}),motorsOff:measureReference('planar_swimmer',{seconds:1,motors:false}),
  limitations:['Controlled inherited swimming is not evidence of learned food seeking or ecological sustainability.',
    'Chemical energy ledger, funded tissue, decomposition, perception and identity issues remain separate work.',
    'No browser/manual verification was run, per user direction.'],
};
const json=JSON.stringify(result,null,2)+'\n';
const output=process.argv.indexOf('--output');if(output>=0){if(!process.argv[output+1])throw new Error('Missing output path');writeFileSync(process.argv[output+1],json);}
else process.stdout.write(json);
