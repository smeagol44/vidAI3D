# Audio and music

The configured `backgroundMusicUrl` currently points at a remote MP3. When browser Web Audio and CORS access are available, VIDA 3D fetches/decodes the audio, detects audible sample boundaries, trims encoder padding/dead air, and synthesizes an approximately 0.6-second equal-power crossfade from tail into head. A repeating `AudioBufferSourceNode` uses sample-accurate loop points, restarting after the overlapped opening samples rather than repeating that overlap.

The soundtrack plays while the ecosystem is in Playing or Paused state. Pausing the **simulation clock** does not stop music. Browser gesture unlocking, tab visibility changes and smooth output gain changes are handled; changing the source URL aborts previous loading and disconnects old playback. Component unmount removes event listeners and closes the audio context.

If Web Audio is unavailable, or the remote URL fails CORS/fetch/decode, an HTML5 `<audio loop>` fallback remains. **The fallback is not guaranteed gapless.** Crossfading cannot always match incompatible musical phrase endpoints, and no manual listening/browser QA is claimed for the current remote track.

Music and sound effects currently have independent mute buttons in the simulation menu. Per-channel sliders and track switching are planned, **not yet implemented**.
