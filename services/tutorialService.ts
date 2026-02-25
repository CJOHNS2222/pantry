// Centralized helper for tutorial interactive steps
type WaitOptions = {
  timeoutMs?: number;
  predicate?: () => boolean;
};

class TutorialService {
  private static instance: TutorialService;

  static getInstance() {
    if (!TutorialService.instance) TutorialService.instance = new TutorialService();
    return TutorialService.instance;
  }

  waitForInteraction(highlightId?: string, options?: WaitOptions): Promise<boolean> {
    const isTestEnv = (typeof process !== 'undefined' && process.env && (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || process.env.VITEST === '1')) ||
      (typeof (globalThis as any).__vitest !== 'undefined') ||
      (typeof (globalThis as any).vitest !== 'undefined') ||
      (typeof (globalThis as any).__vitest !== 'undefined') ||
      (typeof (globalThis as any).importMetaViteStubs !== 'undefined');
    const timeoutMs = options?.timeoutMs ?? (isTestEnv ? 500 : 120000); // short timeout in tests
    const predicate = options?.predicate;

    return new Promise<boolean>((resolve) => {
      let timedOut = false;
      let timeoutHandle: number | undefined;
      let safetyHandle: number | undefined;
      let settled = false;

      const checkPredicate = () => {
        try {
          if (predicate && predicate()) {
            cleanup();
            resolve(true);
            return true;
          }
        } catch (e) {
          // ignore predicate errors
        }
        return false;
      };

      const clickHandler = (ev: Event) => {
        const target = ev.target as HTMLElement | null;
        if (!target) return;
        let el: HTMLElement | null = target;
        while (el && el !== document.body) {
          if (el.hasAttribute('data-tutorial')) {
            const attr = el.getAttribute('data-tutorial');
            if (!highlightId || attr === highlightId) {
              cleanup();
              resolve(true);
              return;
            }
          }
          el = el.parentElement;
        }
      };

      const cleanup = () => {
        if (settled) return;
        settled = true;
        if (timeoutHandle) window.clearTimeout(timeoutHandle);
        if (safetyHandle) window.clearTimeout(safetyHandle);
        document.removeEventListener('click', clickHandler, true);
        // stop predicate checks by clearing interval
        window.clearInterval(predicateInterval);
      };

      // Poll predicate every 700ms if provided
      const predicateInterval = window.setInterval(() => {
        if (checkPredicate()) return;
      }, 700);

      document.addEventListener('click', clickHandler, true);

      // initial predicate check
      if (checkPredicate()) return;

      timeoutHandle = window.setTimeout(() => {
        if (settled) return;
        timedOut = true;
        cleanup();
        resolve(false);
      }, timeoutMs) as unknown as number;

      // In test environments, ensure we forcibly cleanup after a short safety window
      if (isTestEnv) {
        const safetyMs = Math.max(1000, timeoutMs + 200);
        safetyHandle = window.setTimeout(() => {
          if (settled) return;
          cleanup();
          resolve(false);
        }, safetyMs) as unknown as number;
      }
    });
  }
}

export const tutorialService = TutorialService.getInstance();

export default tutorialService;
