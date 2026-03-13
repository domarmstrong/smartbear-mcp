import type { ReadResourceTemplateCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Resource } from "../../common/resources";
import type { BugsnagClient } from "../client";

export class EventResource extends Resource<BugsnagClient> {
  name = "event";
  path = "{id}";

  handle: ReadResourceTemplateCallback = async (uri, variables, _extra) => {
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(
            await this.client.getEvent(variables.id as string),
          ),
        },
      ],
    };
  };
}
