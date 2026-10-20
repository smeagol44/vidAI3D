export const OUTER_DT = 1 / 60;
export const MAX_SPEED = 99;

/** Pure scheduler used by App and deterministic tests; no physics dt depends on rendering. */
export class SimulationClock {
  accumulator = 0;
  droppedSeconds = 0;
  reset() { this.accumulator = 0; this.droppedSeconds = 0; }
  advance(elapsed: number, running: boolean, speed: number, tick: (dt: number) => void,
    now: () => number = () => performance.now(), budgetMs = 6): number {
    if (!running) return 0;
    if (!Number.isFinite(elapsed) || elapsed < 0 || ![1,2,5,MAX_SPEED].includes(speed)) throw new Error('Invalid simulation clock input.');
    const max = speed === MAX_SPEED;
    if (!max) {
      this.droppedSeconds += Math.max(0,elapsed-.1)*speed;
      this.accumulator += Math.min(elapsed,.1) * speed;
      if(this.accumulator > .25) { this.droppedSeconds += this.accumulator-.25; this.accumulator=.25; }
    }
    const deadline=now()+budgetMs;
    let steps=0;
    while((max || this.accumulator+1e-12 >= OUTER_DT) && steps < 256 && (steps === 0 || now()<deadline)) {
      tick(OUTER_DT); steps++;
      if(!max) this.accumulator=Math.max(0,this.accumulator-OUTER_DT);
    }
    return steps;
  }
}
