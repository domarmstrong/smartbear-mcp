import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockCache,
  mockConsole,
  mockCurrentUserAPI,
  mockErrorAPI,
  mockProjectAPI,
} from "../../utils/test-helpers.js";

vi.mock("../../../../../bugsnag/client/api/index.js", () => ({
  ...vi.importActual("../../../../../bugsnag/client/api/index.js"),
  CurrentUserAPI: vi.fn().mockImplementation(() => mockCurrentUserAPI),
  ErrorAPI: vi.fn().mockImplementation(() => mockErrorAPI),
  ProjectAPI: vi.fn().mockImplementation(() => mockProjectAPI),
  Configuration: vi.fn().mockImplementation((config) => config),
}));

vi.mock("../../../../../common/bugsnag.js", () => ({
  default: {
    notify: vi.fn(),
  },
}));

import { BugsnagClient } from "../../../../../bugsnag/client.js";
import { getMockEvent, getMockProject } from "../../utils/factories.js";
import { resetAllMocks } from "../../utils/test-helpers.js";

describe("GetEvent Tool", () => {
  let client: BugsnagClient;
  let registerToolsSpy: any;
  let getInputFunctionSpy: any;

  beforeEach(async () => {
    resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(mockConsole.error);
    vi.spyOn(console, "warn").mockImplementation(mockConsole.warn);

    const mockOrg = { id: "org-1", name: "Test Org", slug: "test-org" };
    mockCurrentUserAPI.listUserOrganizations.mockResolvedValue({
      body: [mockOrg],
    });

    client = new BugsnagClient();
    await client.configure(
      {
        getCache: () => mockCache as any,
      } as any,
      {
        auth_token: "test-token",
      },
    );

    registerToolsSpy = vi.fn();
    getInputFunctionSpy = vi.fn();
  });

  it("should get event details from ID", async () => {
    const mockProjects = [
      getMockProject("proj-1", "My Project", undefined, {
        slug: "my-project",
      }),
    ];
    const mockEvent = getMockEvent("event-1");

    mockCache.get.mockReturnValue(mockProjects);
    mockErrorAPI.viewEventById.mockResolvedValue({ body: mockEvent });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Event",
    )[1];

    const result = await toolHandler({
      projectId: "proj-1",
      eventId: "event-1",
    });

    expect(mockErrorAPI.viewEventById).toHaveBeenCalledWith(
      "proj-1",
      "event-1",
    );
    expect(result.content[0].text).toBe(JSON.stringify(mockEvent));
  });
});
