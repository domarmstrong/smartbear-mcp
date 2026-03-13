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
  ErrorApiView,
  EventField,
} from "../../../../../bugsnag/client/api/api.js";
import { BugsnagClient } from "../../../../../bugsnag/client.js";
import { getMockEventField, getMockProject } from "../../utils/factories.js";
import { resetAllMocks } from "../../utils/test-helpers.js";

describe("ListProjectErrors Tool", () => {
  let client: BugsnagClient;
  let clientWithNoApiKey: BugsnagClient;
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

    clientWithNoApiKey = new BugsnagClient();
    await clientWithNoApiKey.configure(
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

  it("should list project errors with supplied parameters", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    const mockEventFields: Record<string, EventField[]> = {
      "proj-1": [
        getMockEventField("error.status"),
        getMockEventField("user.email"),
        getMockEventField("event.since"),
      ],
    };
    const mockErrors: ErrorApiView[] = [
      { id: "error-1", message: "Test error" },
    ];
    const filters = {
      "error.status": [{ type: "eq" as const, value: "for_review" }],
      "event.since": [{ type: "eq", value: "7d" }],
    };

    mockCache.get
      .mockReturnValueOnce(mockProject) // current project
      .mockReturnValueOnce(mockEventFields); // event fields
    mockErrorAPI.listProjectErrors.mockResolvedValue({
      body: mockErrors,
      totalCount: 1,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Project Errors",
    )[1];

    const result = await toolHandler({
      filters,
      sort: "last_seen",
      direction: "desc",
      perPage: 50,
    });

    expect(mockErrorAPI.listProjectErrors).toHaveBeenCalledWith(
      "proj-1",
      null,
      "last_seen",
      "desc",
      50,
      filters,
      undefined,
    );
    const expectedResult = {
      data: mockErrors,
      data_count: 1,
      total_count: 1,
    };
    expect(result.content[0].text).toBe(JSON.stringify(expectedResult));
  });

  it("should use default filters when not specified", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    const mockEventFields: Record<string, EventField[]> = {
      "proj-1": [
        getMockEventField("error.status"),
        getMockEventField("user.email"),
        getMockEventField("event.since"),
      ],
    };
    const mockErrors: ErrorApiView[] = [
      { id: "error-1", message: "Test error" },
    ];
    const defaultFilters = {
      "error.status": [{ type: "eq" as const, value: "open" }],
      "event.since": [{ type: "eq", value: "30d" }],
    };

    mockCache.get
      .mockReturnValueOnce(mockProject) // current project
      .mockReturnValueOnce(mockEventFields); // event fields
    mockErrorAPI.listProjectErrors.mockResolvedValue({
      body: mockErrors,
      totalCount: 3,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Project Errors",
    )[1];

    const defaultFilterResult = await toolHandler({
      sort: "last_seen",
      direction: "desc",
      perPage: 50,
    });

    expect(mockErrorAPI.listProjectErrors).toHaveBeenCalledWith(
      "proj-1",
      null,
      "last_seen",
      "desc",
      50,
      defaultFilters,
      undefined,
    );
    const expectedResult = {
      data: mockErrors,
      data_count: 1,
      total_count: 3,
    };
    expect(defaultFilterResult.content[0].text).toBe(
      JSON.stringify(expectedResult),
    );
  });

  it("should validate filter keys against cached event fields", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    const mockEventFields: Record<string, EventField[]> = {
      "proj-1": [
        getMockEventField("error.status"),
        getMockEventField("event.since"),
      ],
    };
    const filters = {
      "invalid.field": [{ type: "eq" as const, value: "test" }],
    };

    mockCache.get
      .mockReturnValueOnce(mockProject)
      .mockReturnValueOnce(mockEventFields);

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Project Errors",
    )[1];

    await expect(toolHandler({ filters })).rejects.toThrow(
      "Invalid filter key: invalid.field",
    );
  });

  it("should throw error when no project ID available", async () => {
    const mockProjects = [getMockProject("proj-1", "Project 1")];
    mockCache.get.mockReturnValueOnce(mockProjects); // Return projects so the lookup can happen

    clientWithNoApiKey.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Project Errors",
    )[1];

    await expect(toolHandler({ projectId: "no-match" })).rejects.toThrow(
      "Project with ID no-match not found.",
    );
  });
});
