export const createGracefulShutdown = ({
  server,
  closeStorage,
  timeoutMs = 10_000,
  onEvent = /** @type {(event: string, signal: string, error?: unknown) => void} */ (() => {}),
  onTimeout = /** @type {(signal: string) => void} */ (() => {})
}) => {
  let pending = null;

  return (signal) => {
    if (pending) return pending;
    onEvent('start', signal);
    pending = new Promise((resolve) => {
      let completed = false;
      const finish = async (error) => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        try {
          await closeStorage();
        } catch (closeError) {
          error ||= closeError;
        }
        onEvent('complete', signal, error || null);
        resolve({ signal, error: error || null });
      };
      const timer = setTimeout(() => {
        onTimeout(signal);
        server.closeAllConnections?.();
        void finish(new Error('Graceful shutdown timed out'));
      }, timeoutMs);
      timer.unref?.();
      server.close((error) => { void finish(error); });
    });
    return pending;
  };
};
