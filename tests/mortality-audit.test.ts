import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldSimulation } from '../sim/simulation';
import { basalUpkeepPerSecond } from '../sim/energy';

test('bounded production-world mortality baseline: live reserves and cause proxies', () => {
  const sim = new WorldSimulation(4242, 14);
  const founding = new Map(sim.organisms.map(o=>[o.genome.id, {
    parts:o.bodies.length, start:o.reserves, basal:basalUpkeepPerSecond(o.genome),
    lifespan:o.genome.metabolism.lifespanSec,
    eggFunding:o.genome.metabolism.eggEnergyFunding,
  }]));
  const read = (at:number) => ({
    at, alive:sim.organisms.length, deaths:sim.totalDeaths, eggs:sim.eggs.length,
    fed:sim.totalFoodConsumed,
    groups: Array.from(founding.entries()).map(([id,g])=>{
      const o=sim.organisms.find(o=>o.genome.id===id);
      return {id,parts:g.parts,initial:g.start,basePerSec:g.basal,life:g.lifespan,
        r:o?.reserves ?? null,age:o?.ageSec ?? null,
        motor:o?.totalMotorChemicalSpent ?? null,
        food:o?.totalFoodEaten ?? null};
    }),
    residual:sim.getTelemetry().chemicalEnergyLedger.conservationResidual,
  });
  try {
    const records=[read(0)];
    for(let i=1;i<=45*60;i++) {
      sim.stepOuterTick();
      if (i%600===0 || i===45*60) records.push(read(i/60));
    }
    console.log('MORTALITY_EVIDENCE_027',JSON.stringify(records));
    assert.ok(records.every(r=>Math.abs(r.residual)<1e-5));
  }finally {sim.dispose();}
});
