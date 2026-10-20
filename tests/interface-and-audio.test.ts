import assert from 'node:assert/strict';
import { test } from 'node:test';
import packageJson from '../package.json' with { type: 'json' };
import { VIDA_VERSION, VIDA_CREDITS } from '../version';
import { scanAudioBoundaries, createSeamlessLoopBuffer } from '../utils/BackgroundMusic';

test('UI identity stays synchronized to the package version', () => {
  assert.equal(VIDA_VERSION, 'v' + packageJson.version);
  assert.equal(VIDA_CREDITS, 'by Hernán Garro and Federico Regueira');
});

test('decoded audio loop trims silence and crossfades at bounded sample points', () => {
  const sampleRate = 1000, length = 2000;
  const samples = new Float32Array(length);
  for (let i = 100; i < 1700; i++) samples[i] = 0.5 * Math.sin(i * Math.PI / 10);
  const source = {
    sampleRate, numberOfChannels: 1, length, duration: length / sampleRate,
    getChannelData: () => samples,
  } as unknown as AudioBuffer;
  const boundaries = scanAudioBoundaries(source);
  assert.ok(boundaries.startSample >= 0 && boundaries.startSample < 101);
  assert.ok(boundaries.endSample > 1690 && boundaries.endSample < 1750);
  const context = {
    createBuffer: (channels: number, size: number, rate: number) => {
      const data = Array.from({length: channels}, () => new Float32Array(size));
      return {duration: size / rate, getChannelData: (channel: number) => data[channel]};
    },
  } as unknown as BaseAudioContext;
  const loop = createSeamlessLoopBuffer(context, source, boundaries, 0.2);
  assert.ok(loop.loopStartSec > 0 && loop.loopEndSec <= source.duration);
  assert.ok(loop.loopEndSec - loop.loopStartSec > 0);
  const data = loop.buffer.getChannelData(0), start = Math.round(loop.loopStartSec * sampleRate);
  assert.ok(Math.abs(data[data.length - 1] - data[start]) < 0.05, 'no discontinuity at buffer loop seam');
});
