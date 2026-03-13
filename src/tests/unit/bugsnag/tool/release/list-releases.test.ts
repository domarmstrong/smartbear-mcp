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
import { getMockProject, getMockRelease } from "../../utils/factories.js";
import { resetAllMocks } from "../../utils/test-helpers.js";

describe("ListReleases Tool", () => {
  let client: BugsnagClient;
  let registerToolsSpy: any;
  let getInputFunctionSpy: any;

  const mockProjects = [
    getMockProject("proj-1", "Project 1"),
    getMockProject("proj-2", "Project 2", undefined, {
      target_stability: {
        value: 0.995,
      },
      critical_stability: {
        value: 0.85,
      },
      stability_target_type: "user" as const,
    }),
  ];

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

  it("should list releases with project from cache", async () => {
    const mockReleases = [
      getMockRelease("rel-group-1", {
        app_version: "1.0.0",
        total_sessions_count: 50,
        unhandled_sessions_count: 5,
        accumulative_daily_users_seen: 30,
        accumulative_daily_users_with_unhandled: 3,
      }),
    ];

    mockCache.get
      .mockReturnValueOnce(mockProjects[1])
      .mockReturnValueOnce([mockProjects[1]]);
    mockProjectAPI.listProjectReleaseGroups.mockResolvedValue({
      body: mockReleases,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Releases",
    )[1];

    const result = await toolHandler({
      releaseStage: "production",
      visibleOnly: true,
    });

    expect(mockProjectAPI.listProjectReleaseGroups).toHaveBeenCalledWith(
      "proj-2",
      "production",
      false,
      true,
      30,
      undefined,
    );
    expect(result.content[0].text).toBe(
      JSON.stringify({
        data: [
          {
            ...mockReleases[0],
            user_stability: 0.9,
            session_stability: 0.9,
            stability_target_type: "user",
            target_stability: 0.995,
            critical_stability: 0.85,
            meets_target_stability: false,
            meets_critical_stability: true,
          },
        ],
        data_count: 1,
      }),
    );
  });

  it("should list releases with explicit project ID", async () => {
    const mockReleases = [
      getMockRelease("rel-group-2", {
        app_version: "1.0.0",
        total_sessions_count: 50,
        unhandled_sessions_count: 5,
        accumulative_daily_users_seen: 30,
        accumulative_daily_users_with_unhandled: 3,
      }),
    ];

    mockCache.get
      .mockReturnValueOnce(mockProjects)
      .mockReturnValueOnce(mockProjects);
    mockProjectAPI.listProjectReleaseGroups.mockResolvedValue({
      body: mockReleases,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Releases",
    )[1];

    const result = await toolHandler({
      projectId: "proj-2",
      releaseStage: "staging",
      visibleOnly: false,
    });

    expect(mockProjectAPI.listProjectReleaseGroups).toHaveBeenCalledWith(
      "proj-2",
      "staging",
      false,
      false,
      30,
      undefined,
    );
    expect(result.content[0].text).toBe(
      JSON.stringify({
        data: [
          {
            ...mockReleases[0],
            user_stability: 0.9,
            session_stability: 0.9,
            stability_target_type: "user",
            target_stability: 0.995,
            critical_stability: 0.85,
            meets_target_stability: false,
            meets_critical_stability: true,
          },
        ],
        data_count: 1,
      }),
    );
  });

  it("should handle empty releases list", async () => {
    mockCache.get.mockReturnValueOnce(mockProjects[0]);
    mockProjectAPI.listProjectReleaseGroups.mockResolvedValue({ body: [] });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Releases",
    )[1];

    const result = await toolHandler({
      visibleOnly: true,
    });

    expect(mockProjectAPI.listProjectReleaseGroups).toHaveBeenCalledWith(
      "proj-1",
      "production",
      false,
      true,
      30,
      undefined,
    );
    expect(result.content[0].text).toBe(
      JSON.stringify({ data: [], data_count: 0 }),
    );
  });

  it("should throw error when no project ID available", async () => {
    mockCache.get.mockReturnValue(null);

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Releases",
    )[1];

    await expect(toolHandler({})).rejects.toThrow(
      "No current project found. Please provide a projectId or configure a project API key.",
    );
  });
});
