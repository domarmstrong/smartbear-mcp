import type { ReadResourceTemplateCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "./types";

/**
 * Base class encapsulating a resource's name, path and handler, with reference to its client.
 */
export abstract class Resource<T extends Client> {
  protected readonly client: T;

  constructor(client: T) {
    this.client = client;
  }

  abstract name: string;
  abstract path: string;
  abstract handle: ReadResourceTemplateCallback;
}
