import { EventAggregator } from '../events/eventAggregator';
import { RawEvent } from '../events/eventTypes';

export interface IObserver {
  start(): void;
  stop(): void;
}

export abstract class BaseObserver implements IObserver {
  protected disposables: { dispose(): any }[] = [];

  public abstract start(): void;

  public stop(): void {
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        // Suppress errors during observer disposal
      }
    }
    this.disposables = [];
  }

  protected publish(event: RawEvent): void {
    EventAggregator.getInstance().publishRaw(event);
  }
}
