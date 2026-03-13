import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockCache,
  mockConsole,
  mockCurrentUserAPI,
  mockErrorAPI,
  mockProjectAPI,
} from "../utils/test-helpers.js";

vi.mock("../../../../bugsnag/client/api/index.js", () => ({
  ...vi.importActual("../../../../bugsnag/client/api/index.js"),
  CurrentUserAPI: vi.fn().mockImplementation(() => mockCurrentUserAPI),
  ErrorAPI: vi.fn().mockImplementation(() => mockErrorAPI),
  ProjectAPI: vi.fn().mockImplementation(() => mockProjectAPI),
  Configuration: vi.fn().mockImplementation((config) => config),
}));

vi.mock("../../../../common/bugsnag.js", () => ({
  default: {
    notify: vi.fn(),
  },
}));

import { BugsnagClient } from "../../../../bugsnag/client.js";
import { getMockEvent, getMockProject } from "../utils/factories.js";
import { resetAllMocks } from "../utils/test-helpers.js";

describe("EventResource", () => {
  let client: BugsnagClient;
  let registerResourcesSpy: any;

  beforeEach(async () => {
    resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(mockConsole.error);
    vi.spyOn(console, "warn").mockImplementation(mockConsole.warn);

    const mockOrg = { id: "org-1", name: "Test Org", slug: "test-org" };
    mockCurrentUserAPI.listUserOrganizations.mockResolvedValue({
      body: [mockOrg],
    });

    client = new BugsnagClient();
    await client.configure({ getCache: () => mockCache as any } as any, {
      auth_token: "test-token",
    });

    registerResourcesSpy = vi.fn();
  });

  it("should find event by ID across projects", async () => {
    const mockEvent = getMockEvent("event-1");
    const mockProjects = [getMockProject("proj-1", "Project 1")];

    mockCache.get.mockReturnValueOnce(mockProjects);
    mockErrorAPI.viewEventById.mockResolvedValue({ body: mockEvent });

    client.registerResources(registerResourcesSpy);
    const resourceHandler = registerResourcesSpy.mock.calls[0][2];

    const result = await resourceHandler(
      { href: "bugsnag://event/event-1" },
      { id: "event-1" },
    );

    expect(result.contents[0].uri).toBe("bugsnag://event/event-1");
    expect(result.contents[0].text).toBe(JSON.stringify(mockEvent));
  });
});
