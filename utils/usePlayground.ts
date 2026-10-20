import {useCallback, useEffect, useRef, useState} from 'react';

export function usePlayground() {
  const [isReady, setIsReady] = useState(false);
  const sdkRef = useRef<any>(null);

  useEffect(() => {
    if (sdkRef.current) return;
    const initSDK = async () => {
      try {
        const module = await import('./playground-fake');
        sdkRef.current = new module.FakePlaygroundSDK();
        await sdkRef.current.init(() => {}, () => {});
        setIsReady(true);
      } catch (error) {
        console.error('Playground SDK initialization failed:', error);
      }
    };
    initSDK();
  }, []);

  return {
    sdk: sdkRef.current,
    isReady,
  };
}

export interface BaseGameState {
  status: string;
  score: number;
  level?: number | string;
}

export function usePlaygroundGameLifecycle(
  gameState: BaseGameState,
  sdk?: any,
) {
  const defaultHook = usePlayground();
  const activeSdk = sdk ?? defaultHook.sdk;

  useEffect(() => {
    if (!activeSdk) return;
    const status = (gameState.status || '').toUpperCase();
    if (status === 'PLAYING') {
      activeSdk.scoreUpdated({
        value: gameState.score,
        level: String(gameState.level ?? 1),
      });
    }
  }, [gameState.score, gameState.status, gameState.level, activeSdk]);
}

export function useRpc<RequestType, ResponseType>(
  rpcName: string,
): [(payload: RequestType) => Promise<ResponseType>, boolean] {
  const callRpc = useCallback(async (payload: RequestType): Promise<ResponseType> => {
    return {} as ResponseType;
  }, [rpcName]);
  return [callRpc, false];
}
