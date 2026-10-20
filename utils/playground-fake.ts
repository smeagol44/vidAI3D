export class FakePlaygroundSDK {
  private isInitialized = false;
  private onGameEvent: ((event: any) => void) | null = null;
  private onPlayerPresence: ((presence: any) => void) | null = null;
  private onLobbyStatus: ((status: any) => void) | null = null;
  private onError: ((error: any) => void) | null = null;

  async init(
    onGameEvent: (event: any) => void,
    onPlayerPresence: (presence: any) => void,
    onLobbyStatus?: (status: any) => void,
    onError?: (error: any) => void,
  ): Promise<void> {
    this.onGameEvent = onGameEvent;
    this.onPlayerPresence = onPlayerPresence;
    if (onLobbyStatus) this.onLobbyStatus = onLobbyStatus;
    if (onError) this.onError = onError;
    this.isInitialized = true;
    window.parent?.postMessage({type: 'PREVIEW_READY'}, '*');
  }

  startGame(lobbyId?: string): void {}
  sendGameEvent(eventData: any): void {}
  scoreUpdated(scoreData: any): void {}
  levelComplete(level: number | string): void {}
  gameOver(lobbyId?: string): void {}
  pauseStateChanged(isPaused: boolean): void {}
}
