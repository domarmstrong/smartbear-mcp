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

import type { TraceField } from "../../../../../bugsnag/client/api/api.js";
import { BugsnagClient } from "../../../../../bugsnag/client.js";
import { getMockProject, getMockTrace } from "../../utils/factories.js";
import { resetAllMocks } from "../../utils/test-helpers.js";

describe("ListTraceFields Tool", () => {
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

  it("should list available trace fields", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    const mockTraceFields = [
      getMockTrace("user.id", "string"),
      getMockTrace("device.type", "string"),
      getMockTrace("app.version", "string"),
    ];

    mockCache.get.mockImplementation((key: string) => {
      if (key === "bugsnag_current_project") {
        return mockProject;
      }
      return undefined;
    });
    mockProjectAPI.listProjectTraceFields.mockResolvedValue({
      body: mockTraceFields,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);

    const listTraceFieldsHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Trace Fields",
    )[1];

    const result = await listTraceFieldsHandler({});

    expect(mockProjectAPI.listProjectTraceFields).toHaveBeenCalledWith(
      "proj-1",
    );
    expect(mockCache.set).toHaveBeenCalledWith("bugsnag_project_trace_fields", {
      "proj-1": mockTraceFields,
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify(mockTraceFields),
        },
      ],
    });
  });

  it("should use cached trace fields when available", async () => {
    const mockProject = { id: "proj-1", name: "Project 1" };
    const mockPerformanceFilters: TraceField[] = [
      getMockTrace("cached.field", "string"),
      getMockTrace("another.field", "number"),
    ];
    const mockCachedFilters = { "proj-1": mockPerformanceFilters };

    mockCache.get.mockImplementation((key: string) => {
      if (key === "bugsnag_project_trace_fields") {
        return mockCachedFilters;
      }
      if (key === "bugsnag_current_project") {
        return mockProject;
      }
      return undefined;
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);

    const listTraceFieldsHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Trace Fields",
    )[1];

    const result = await listTraceFieldsHandler({});

    // Should use cache and not call API
    expect(mockProjectAPI.listProjectTraceFields).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify(mockPerformanceFilters),
        },
      ],
    });
  });

  it("should work with explicit projectId", async () => {
    const mockProjects = [
      getMockProject("proj-1", "Project 1"),
      getMockProject("proj-2", "Project 2"),
    ];
    const mockTraceFields: TraceField[] = [
      getMockTrace("cached.field", "string"),
    ];

    mockCache.get.mockImplementation((key: string) => {
      if (key === "bugsnag_projects") {
        return mockProjects;
      }
      return undefined;
    });
    mockProjectAPI.listProjectTraceFields.mockResolvedValue({
      body: mockTraceFields,
    });

    clientWithNoApiKey.registerTools(registerToolsSpy, getInputFunctionSpy);

    const listTraceFieldsHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Trace Fields",
    )[1];

    const result = await listTraceFieldsHandler({
      projectId: "proj-2",
    });

    expect(mockProjectAPI.listProjectTraceFields).toHaveBeenCalledWith(
      "proj-2",
    );
    expect(mockCache.set).toHaveBeenCalledWith("bugsnag_project_trace_fields", {
      "proj-2": mockTraceFields,
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify(mockTraceFields),
        },
      ],
    });
  });
});
