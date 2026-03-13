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
import { resetAllMocks } from "../../utils/test-helpers.js";

describe("SetNetworkEndpointGroupings Tool", () => {
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

  it("should update network grouping rules with project from cache", async () => {
    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const setNetworkGroupingHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Set Network Endpoint Groupings",
    )?.[1];

    const mockProject = { id: "proj-1", name: "Project 1" };
    const endpoints = [
      "/api/users/{userId}",
      "/api/products/{productId}",
      "https://*.example.com/api/{version}",
    ];
    const mockRuleset = {
      projectId: "proj-1",
      endpoints: endpoints,
    };

    mockCache.get.mockReturnValueOnce(mockProject);
    mockProjectAPI.updateProjectNetworkGroupingRuleset.mockResolvedValue({
      status: 200,
      body: mockRuleset,
    });

    const result = await setNetworkGroupingHandler({ endpoints }, {});

    expect(
      mockProjectAPI.updateProjectNetworkGroupingRuleset,
    ).toHaveBeenCalledWith("proj-1", endpoints);
    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.projectId).toBe("proj-1");
    expect(response.endpoints).toEqual(endpoints);
  });

  it("should update network grouping rules with explicit project ID", async () => {
    clientWithNoApiKey.registerTools(registerToolsSpy, getInputFunctionSpy);
    const setNetworkGroupingHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Set Network Endpoint Groupings",
    )?.[1];

    const mockProjects = [
      { id: "proj-1", name: "Project 1" },
      { id: "proj-2", name: "Project 2" },
    ];
    const endpoints = [
      "/{organizationSlug}/{projectSlug}/performance/view-load",
    ];
    const mockRuleset = {
      projectId: "proj-2",
      endpoints: endpoints,
    };

    mockCache.get.mockReturnValueOnce(mockProjects);
    mockProjectAPI.updateProjectNetworkGroupingRuleset.mockResolvedValue({
      status: 200,
      body: mockRuleset,
    });

    const result = await setNetworkGroupingHandler(
      { projectId: "proj-2", endpoints },
      {},
    );

    expect(
      mockProjectAPI.updateProjectNetworkGroupingRuleset,
    ).toHaveBeenCalledWith("proj-2", endpoints);
    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.projectId).toBe("proj-2");
    expect(response.endpoints).toEqual(endpoints);
  });

  it("should handle 204 status as success", async () => {
    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const setNetworkGroupingHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Set Network Endpoint Groupings",
    )?.[1];

    const mockProject = { id: "proj-1", name: "Project 1" };
    const endpoints = ["/api/{version}/items/{itemId}"];

    mockCache.get.mockReturnValueOnce(mockProject);
    mockProjectAPI.updateProjectNetworkGroupingRuleset.mockResolvedValue({
      status: 204,
      body: { projectId: "proj-1", endpoints },
    });

    const result = await setNetworkGroupingHandler({ endpoints }, {});

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
  });

  it("should update with empty endpoints array", async () => {
    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const setNetworkGroupingHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Set Network Endpoint Groupings",
    )?.[1];

    const mockProject = { id: "proj-1", name: "Project 1" };
    const endpoints: string[] = [];

    mockCache.get.mockReturnValueOnce(mockProject);
    mockProjectAPI.updateProjectNetworkGroupingRuleset.mockResolvedValue({
      status: 200,
      body: { projectId: "proj-1", endpoints },
    });

    const result = await setNetworkGroupingHandler({ endpoints }, {});

    expect(
      mockProjectAPI.updateProjectNetworkGroupingRuleset,
    ).toHaveBeenCalledWith("proj-1", []);
    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.endpoints).toEqual([]);
  });

  it("should handle complex endpoint patterns", async () => {
    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const setNetworkGroupingHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Set Network Endpoint Groupings",
    )?.[1];

    const mockProject = { id: "proj-1", name: "Project 1" };
    const endpoints = [
      "https://*.example.com/api/v1/{resourceId}",
      "https://api.example.com/v2/users/{userId}",
      "/api/orders/{orderId}/items/{itemId}",
      "/graphql",
    ];

    mockCache.get.mockReturnValueOnce(mockProject);
    mockProjectAPI.updateProjectNetworkGroupingRuleset.mockResolvedValue({
      status: 200,
      body: { projectId: "proj-1", endpoints },
    });

    const result = await setNetworkGroupingHandler({ endpoints }, {});

    expect(
      mockProjectAPI.updateProjectNetworkGroupingRuleset,
    ).toHaveBeenCalledWith("proj-1", endpoints);
    const response = JSON.parse(result.content[0].text);
    expect(response.endpoints).toEqual(endpoints);
  });

  it("should throw error when no project ID available", async () => {
    clientWithNoApiKey.registerTools(registerToolsSpy, getInputFunctionSpy);
    const setNetworkGroupingHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Set Network Endpoint Groupings",
    )?.[1];

    mockCache.get.mockReturnValueOnce(null);

    await expect(
      setNetworkGroupingHandler({ endpoints: ["/api/{id}"] }, {}),
    ).rejects.toThrow("No current project found");
  });
});
