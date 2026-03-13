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

describe("GetRelease Tool", () => {
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

  it("should get release with explicit project ID", async () => {
    const mockRelease = getMockRelease("rel-group-2", {
      project_id: "proj-2",
      app_version: "1.0.0",
      total_sessions_count: 50,
      unhandled_sessions_count: 5,
      accumulative_daily_users_seen: 30,
      accumulative_daily_users_with_unhandled: 3,
    });

    const mockBuildsInRelease = [
      getMockRelease("build-1", {
        release_time: "2023-01-01T00:00:00Z",
        app_version: "1.0.0",
        total_sessions_count: 100,
        unhandled_sessions_count: 10,
        accumulative_daily_users_seen: 5,
        accumulative_daily_users_with_unhandled: 1,
      }),
    ];

    mockCache.get
      .mockReturnValueOnce(mockProjects)
      .mockReturnValueOnce(mockProjects)
      .mockReturnValueOnce(mockProjects);
    mockProjectAPI.getReleaseGroup.mockResolvedValue({
      body: mockRelease,
    });

    mockProjectAPI.listBuildsInRelease.mockResolvedValue({
      body: mockBuildsInRelease,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Release",
    )[1];

    const result = await toolHandler({
      projectId: "proj-2",
      releaseId: "rel-group-2",
    });

    expect(mockProjectAPI.getReleaseGroup).toHaveBeenCalledWith("rel-group-2");
    expect(result.content[0].text).toBe(
      JSON.stringify({
        release: {
          ...mockRelease,
          user_stability: 0.9,
          session_stability: 0.9,
          stability_target_type: "user",
          target_stability: 0.995,
          critical_stability: 0.85,
          meets_target_stability: false,
          meets_critical_stability: true,
        },
        builds: [
          {
            ...mockBuildsInRelease[0],
            user_stability: 0.8,
            session_stability: 0.9,
            stability_target_type: "user",
            target_stability: 0.995,
            critical_stability: 0.85,
            meets_target_stability: false,
            meets_critical_stability: false,
          },
        ],
      }),
    );
  });

  it("should throw error when release not found", async () => {
    mockCache.get
      .mockReturnValueOnce(mockProjects[0])
      .mockReturnValueOnce(null);
    mockProjectAPI.getReleaseGroup.mockResolvedValue({ body: null });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Release",
    )[1];

    await expect(
      toolHandler({ releaseId: "non-existent-release-id" }),
    ).rejects.toThrow("No release for non-existent-release-id found.");
  });
});
