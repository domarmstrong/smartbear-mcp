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

import type {
  EventApiView,
  PivotApiView,
} from "../../../../../bugsnag/client/api/api.js";
import { BugsnagClient } from "../../../../../bugsnag/client.js";
import {
  getMockError,
  getMockEvent,
  getMockEventField,
  getMockOrganization,
  getMockProject,
} from "../../utils/factories.js";
import { resetAllMocks } from "../../utils/test-helpers.js";

describe("GetError Tool", () => {
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

  it("should get error details with project from cache", async () => {
    const mockOrg = getMockOrganization("org-1", "Test Org", "test-org");
    const mockProject = getMockProject("proj-1", "Project 1", "my-project");
    const mockError = getMockError("error-1");
    const mockEvents: EventApiView[] = [
      {
        ...getMockEvent("event-1"),
        threads: [{ name: "thread-1" }], // Threads should be removed in response
      },
    ];
    const mockPivots: PivotApiView[] = [
      { name: "test-pivot", event_field_display_id: "test" },
    ];

    const defaultQueryString =
      "?filters[error][][type]=eq&filters[error][][value]=error-1" +
      "&filters[event.since][][type]=eq&filters[event.since][][value]=30d" +
      "&filters[error.status][][type]=eq&filters[error.status][][value]=open";

    mockCache.get.mockReturnValueOnce(mockProject).mockReturnValueOnce(mockOrg);
    mockProjectAPI.listProjectEventFields.mockResolvedValue({
      body: [
        getMockEventField("error"),
        getMockEventField("error.status"),
        getMockEventField("user.email"),
        getMockEventField("event.since"),
      ],
    });
    mockErrorAPI.viewErrorOnProject.mockResolvedValue({
      body: mockError,
    });
    mockErrorAPI.listEventsOnProject.mockResolvedValue({
      body: mockEvents,
    });
    mockErrorAPI.getPivotValuesOnAnError.mockResolvedValue({
      body: mockPivots,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Error",
    )[1];

    const result = await toolHandler({ errorId: "error-1" });

    expect(mockErrorAPI.viewErrorOnProject).toHaveBeenCalledWith(
      "proj-1",
      "error-1",
    );
    expect(result.content[0].text).toBe(
      JSON.stringify({
        error_details: mockError,
        latest_event: getMockEvent("event-1"),
        pivots: mockPivots,
        url: `https://app.bugsnag.com/${mockOrg.slug}/${mockProject.slug}/errors/error-1${encodeURI(defaultQueryString)}`,
      }),
    );
  });

  it("should get error details without any latest events or pivots", async () => {
    const mockOrg = getMockOrganization("org-1", "Test Org", "test-org");
    const mockProject = getMockProject("proj-1", "Project 1", "my-project");
    const mockError = getMockError("error-1");

    const defaultQueryString =
      "?filters[error][][type]=eq&filters[error][][value]=error-1" +
      "&filters[event.since][][type]=eq&filters[event.since][][value]=30d" +
      "&filters[error.status][][type]=eq&filters[error.status][][value]=open";

    mockCache.get.mockReturnValueOnce(mockProject).mockReturnValueOnce(mockOrg);
    mockProjectAPI.listProjectEventFields.mockResolvedValue({
      body: [
        getMockEventField("error"),
        getMockEventField("error.status"),
        getMockEventField("user.email"),
        getMockEventField("event.since"),
      ],
    });
    mockErrorAPI.viewErrorOnProject.mockResolvedValue({
      body: mockError,
    });
    mockErrorAPI.listEventsOnProject.mockResolvedValue({
      body: [],
    });
    mockErrorAPI.getPivotValuesOnAnError.mockResolvedValue({
      body: [],
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Error",
    )[1];

    const result = await toolHandler({ errorId: "error-1" });

    expect(mockErrorAPI.viewErrorOnProject).toHaveBeenCalledWith(
      "proj-1",
      "error-1",
    );
    expect(result.content[0].text).toBe(
      JSON.stringify({
        error_details: mockError,
        latest_event: null,
        pivots: [],
        url: `https://app.bugsnag.com/${mockOrg.slug}/${mockProject.slug}/errors/error-1${encodeURI(defaultQueryString)}`,
      }),
    );
  });

  it("should throw when error ID does not exist", async () => {
    const mockProject = getMockProject("proj-1", "Project 1", "my-project");
    const mockOrg = getMockOrganization("org-1", "Test Org", "test-org");

    mockCache.get.mockReturnValueOnce(mockProject).mockReturnValueOnce(mockOrg);
    mockErrorAPI.viewErrorOnProject.mockResolvedValue({ body: null });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Error",
    )[1];

    await expect(toolHandler({ errorId: "non-existent-id" })).rejects.toThrow(
      "Error with ID non-existent-id not found in project proj-1.",
    );
  });
});
