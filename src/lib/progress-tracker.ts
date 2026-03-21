type ProgressListener = (progress: Record<string, number>) => void;

class ProgressTracker {
  private progress: Record<string, number> = {};
  private listeners: ProgressListener[] = [];

  constructor() {
    console.log("[ProgressTracker] New instance created");
  }

  update(key: string, value: number) {
    this.progress = { ...this.progress, [key]: value };
    this.notify();
  }

  reset() {
    this.progress = {};
    this.notify();
  }

  getProgress() {
    return { ...this.progress };
  }

  subscribe(listener: ProgressListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getSnapshot() {
    return this.progress;
  }

  private notify() {
    this.listeners.forEach((l) => l(this.progress));
  }
}

// Ensure global singleton even with HMR / multiple imports
const GLOBAL_KEY = "__INDICATOR_PROGRESS_TRACKER__";
if (!(window as any)[GLOBAL_KEY]) {
  (window as any)[GLOBAL_KEY] = new ProgressTracker();
}

export const indicatorProgressTracker: ProgressTracker = (window as any)[GLOBAL_KEY];
