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
    const timeoutMs = options?.timeoutMs ?? 120000; // default 2 minutes
    const predicate = options?.predicate;

    return new Promise<boolean>((resolve) => {
      let timedOut = false;
      let timeoutHandle: number | undefined;

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
        if (timeoutHandle) window.clearTimeout(timeoutHandle);
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
        timedOut = true;
        cleanup();
        resolve(false);
      }, timeoutMs) as unknown as number;
    });
  }
}

export const tutorialService = TutorialService.getInstance();

export default tutorialService;
