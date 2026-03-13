import { beforeEach, describe, expect, it, vi } from "vitest";
import { BugsnagClient } from "../../../../../bugsnag/client.js";
import { getMockEvent, getMockProject } from "../../utils/factories.js";
import {
  mockCache,
  mockConsole,
  mockCurrentUserAPI,
  mockErrorAPI,
  mockProjectAPI,
  resetAllMocks,
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

describe("GetEventDetailsFromDashboardUrl Tool", () => {
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

  it("should get event details from dashboard URL", async () => {
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
      (call: any) => call[0].title === "Get Event Details From Dashboard URL",
    )[1];

    const result = await toolHandler({
      link: "https://app.bugsnag.com/my-org/my-project/errors/error-123?event_id=event-1",
    });

    expect(mockErrorAPI.viewEventById).toHaveBeenCalledWith(
      "proj-1",
      "event-1",
    );
    expect(result.content[0].text).toBe(JSON.stringify(mockEvent));
  });

  it("should throw error when link is invalid", async () => {
    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Event Details From Dashboard URL",
    )[1];

    await expect(toolHandler({ link: "invalid-url" })).rejects.toThrow();
  });

  it("should throw error when project not found", async () => {
    mockCache.get.mockReturnValue([
      getMockProject("proj-1", "Other Project", "other-project"),
    ]);

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Event Details From Dashboard URL",
    )[1];

    await expect(
      toolHandler({
        link: "https://app.bugsnag.com/my-org/my-project/errors/error-123?event_id=event-1",
      }),
    ).rejects.toThrow("Project with the specified slug not found.");
  });

  it("should throw error when URL is missing required parameters", async () => {
    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Event Details From Dashboard URL",
    )[1];

    await expect(
      toolHandler({
        link: "https://app.bugsnag.com/my-org/my-project/errors/error-123", // Missing event_id
      }),
    ).rejects.toThrow(
      "Both projectSlug and eventId must be present in the link",
    );
  });
});
