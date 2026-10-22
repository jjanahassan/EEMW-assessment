import { logger } from "../utils/logger";

export type DomainEvent = {
  type: "document.uploaded" | "document.versionAdded" | "document.versionRestored";
  documentId: string;
  userId: string;
};

type Handler = (event: DomainEvent) => void | Promise<void>;

export class EventBus {
  private handlers: Handler[] = [];

  subscribe(handler: Handler) {
    this.handlers.push(handler);
  }

  // A failing listener must never break the request that published the event
  async publish(event: DomainEvent) {
    const results = await Promise.allSettled(this.handlers.map(async (handler) => handler(event)));
    for (const result of results) {
      if (result.status === "rejected") {
        logger.error({ err: String(result.reason), event: event.type }, "Event handler failed");
      }
    }
  }
}