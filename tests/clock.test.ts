import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SimulationClock,OUTER_DT,MAX_SPEED} from '../sim/clock';

test('equal real time requests identical fixed ticks at 30, 60 and 144 FPS',()=>{
  for(const speed of [1,2,5])for(const fps of [30,60,144]){
    const clock=new SimulationClock();let ticks=0;
    for(let i=0;i<fps*10;i++)clock.advance(1/fps,true,speed,dt=>{assert.equal(dt,OUTER_DT);ticks++;},()=>0);
    assert.equal(ticks,600*speed,`${fps} FPS / ${speed}x`);
  }
});
test('paused frames never call biology/physics and retain the fractional accumulator',()=>{
  const clock=new SimulationClock();let calls=0;clock.advance(.01,true,1,()=>calls++,()=>0);const remainder=clock.accumulator;
  for(let i=0;i<120;i++)clock.advance(1/60,false,5,()=>calls++,()=>0);
  assert.equal(calls,0);assert.equal(clock.accumulator,remainder);clock.advance(.01,true,1,()=>calls++,()=>0);assert.equal(calls,1);
});
test('MAX is wall-time budgeted rather than a fixed number of ticks',()=>{
  const run=(cost:number)=>{const clock=new SimulationClock();let now=0,ticks=0;
    clock.advance(1/60,true,MAX_SPEED,()=>{ticks++;now+=cost;},()=>now,6);return ticks;};
  assert.equal(run(1),6);assert.equal(run(2),3);assert.equal(run(4),2);
});
test('overload work/backlog is bounded and discarded time is exposed',()=>{
  const clock=new SimulationClock();let now=0,ticks=0;
  clock.advance(20,true,5,()=>{ticks++;now+=10;},()=>now,6);
  assert.equal(ticks,1);assert.ok(clock.accumulator<=.25);assert.ok(clock.droppedSeconds>0);
  clock.reset();assert.equal(clock.accumulator,0);assert.equal(clock.droppedSeconds,0);
});
