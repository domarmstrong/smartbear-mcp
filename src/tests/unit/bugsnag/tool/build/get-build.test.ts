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

describe("GetBuild Tool", () => {
  let client: BugsnagClient;
  let registerToolsSpy: any;
  let getInputFunctionSpy: any;

  const mockProjects = [
    getMockProject("proj-1", "Project 1", undefined, {
      target_stability: {
        value: 0.995,
      },
      critical_stability: {
        value: 0.85,
      },
      stability_target_type: "user",
    }),
    getMockProject("proj-2", "Project 2"),
  ];

  const mockBuild = getMockRelease("rel-1", {
    errors_introduced_count: 5,
    errors_seen_count: 10,
    total_sessions_count: 100,
    unhandled_sessions_count: 10,
    accumulative_daily_users_seen: 50,
    accumulative_daily_users_with_unhandled: 5,
  });

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

  it("should get build details", async () => {
    const basicBuild = getMockRelease("rel-1", {
      ...mockBuild,
      errors_introduced_count: 5,
      errors_seen_count: 10,
      total_sessions_count: 100,
      unhandled_sessions_count: 10,
      accumulative_daily_users_seen: 50,
      accumulative_daily_users_with_unhandled: 5,
    });

    mockCache.get
      .mockReturnValueOnce(mockProjects[0])
      .mockReturnValueOnce([mockProjects[0]]);
    mockProjectAPI.getProjectReleaseById.mockResolvedValue({
      body: basicBuild,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Build",
    )[1];

    const result = await toolHandler({ buildId: "rel-1" });

    expect(mockProjectAPI.getProjectReleaseById).toHaveBeenCalledWith(
      "proj-1",
      "rel-1",
    );
    expect(result.content[0].text).toBe(
      JSON.stringify({
        ...basicBuild,
        user_stability: 0.9,
        session_stability: 0.9,
        stability_target_type: "user",
        target_stability: 0.995,
        critical_stability: 0.85,
        meets_target_stability: false,
        meets_critical_stability: true,
      }),
    );
  });

  it("should handle 0 daily users", async () => {
    const basicBuild = getMockRelease("rel-1", {
      ...mockBuild,
      accumulative_daily_users_seen: 0,
    });

    mockCache.get
      .mockReturnValueOnce(mockProjects[0])
      .mockReturnValueOnce([mockProjects[0]]);
    mockProjectAPI.getProjectReleaseById.mockResolvedValue({
      body: basicBuild,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Build",
    )[1];

    const result = await toolHandler({ buildId: "rel-1" });

    expect(mockProjectAPI.getProjectReleaseById).toHaveBeenCalledWith(
      "proj-1",
      "rel-1",
    );
    expect(result.content[0].text).toBe(
      JSON.stringify({
        ...basicBuild,
        user_stability: 0,
        session_stability: 0.9,
        stability_target_type: "user",
        target_stability: 0.995,
        critical_stability: 0.85,
        meets_target_stability: false,
        meets_critical_stability: false,
      }),
    );
  });

  it("should handle 0 sessions", async () => {
    const mockProjectSessionStability = getMockProject(
      mockProjects[0].id,
      undefined,
      undefined,
      {
        ...mockProjects[0],
        stability_target_type: "session" as const,
      },
    );
    const basicBuild = getMockRelease("rel-1", {
      ...mockBuild,
      total_sessions_count: 0,
    });

    mockCache.get
      .mockReturnValueOnce(mockProjectSessionStability)
      .mockReturnValueOnce([mockProjectSessionStability]);
    mockProjectAPI.getProjectReleaseById.mockResolvedValue({
      body: basicBuild,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Build",
    )[1];

    const result = await toolHandler({ buildId: "rel-1" });

    expect(mockProjectAPI.getProjectReleaseById).toHaveBeenCalledWith(
      "proj-1",
      "rel-1",
    );
    expect(result.content[0].text).toBe(
      JSON.stringify({
        ...basicBuild,
        user_stability: 0.9,
        session_stability: 0,
        stability_target_type: "session",
        target_stability: 0.995,
        critical_stability: 0.85,
        meets_target_stability: false,
        meets_critical_stability: false,
      }),
    );
  });

  it("should get build with explicit project ID", async () => {
    const basicBuild = getMockRelease("rel-1", {
      ...mockBuild,
      total_sessions_count: 50,
      unhandled_sessions_count: 5,
      accumulative_daily_users_seen: 30,
      accumulative_daily_users_with_unhandled: 3,
    });

    mockCache.get
      .mockReturnValueOnce(mockProjects)
      .mockReturnValueOnce(mockProjects);
    mockProjectAPI.getProjectReleaseById.mockResolvedValue({
      body: basicBuild,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Build",
    )[1];

    const result = await toolHandler({
      projectId: "proj-1",
      buildId: "rel-1",
    });

    expect(mockProjectAPI.getProjectReleaseById).toHaveBeenCalledWith(
      "proj-1",
      "rel-1",
    );
    expect(result.content[0].text).toBe(
      JSON.stringify({
        ...basicBuild,
        user_stability: 0.9,
        session_stability: 0.9,
        stability_target_type: "user",
        target_stability: 0.995,
        critical_stability: 0.85,
        meets_target_stability: false,
        meets_critical_stability: true,
      }),
    );
  });

  it("should throw error when build not found", async () => {
    mockCache.get
      .mockReturnValueOnce(mockProjects[0])
      .mockReturnValueOnce([mockProjects[0]]);
    mockProjectAPI.getProjectReleaseById.mockResolvedValue({ body: null });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Build",
    )[1];

    await expect(
      toolHandler({ buildId: "non-existent-release-id" }),
    ).rejects.toThrow("No build for non-existent-release-id found.");
  });

  it("should throw error when no project ID available", async () => {
    mockCache.get.mockReturnValue(null);

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Build",
    )[1];

    await expect(toolHandler({ buildId: "rel-1" })).rejects.toThrow(
      "No current project found. Please provide a projectId or configure a project API key.",
    );
  });
});
