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

describe("GetNetworkEndpointGroupings Tool", () => {
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

  it("should get network grouping rules with project from cache", async () => {
    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const getNetworkGroupingHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Network Endpoint Groupings",
    )?.[1];

    const mockProject = { id: "proj-1", name: "Project 1" };
    const mockRuleset = {
      projectId: "proj-1",
      endpoints: [
        "/api/users/{userId}",
        "/api/products/{productId}",
        "https://*.example.com/api/{version}",
      ],
    };

    mockCache.get.mockReturnValueOnce(mockProject);
    mockProjectAPI.getProjectNetworkGroupingRuleset.mockResolvedValue({
      body: mockRuleset,
    });

    const result = await getNetworkGroupingHandler({}, {});

    expect(
      mockProjectAPI.getProjectNetworkGroupingRuleset,
    ).toHaveBeenCalledWith("proj-1");
    expect(JSON.parse(result.content[0].text)).toEqual(mockRuleset.endpoints);
  });

  it("should get network grouping rules with explicit project ID", async () => {
    clientWithNoApiKey.registerTools(registerToolsSpy, getInputFunctionSpy);
    const getNetworkGroupingHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Network Endpoint Groupings",
    )?.[1];

    const mockProjects = [
      { id: "proj-1", name: "Project 1" },
      { id: "proj-2", name: "Project 2" },
    ];
    const mockRuleset = {
      projectId: "proj-2",
      endpoints: ["/api/{version}/items/{itemId}"],
    };

    mockCache.get.mockReturnValueOnce(mockProjects);
    mockProjectAPI.getProjectNetworkGroupingRuleset.mockResolvedValue({
      body: mockRuleset,
    });

    const result = await getNetworkGroupingHandler({ projectId: "proj-2" }, {});

    expect(
      mockProjectAPI.getProjectNetworkGroupingRuleset,
    ).toHaveBeenCalledWith("proj-2");
    expect(JSON.parse(result.content[0].text)).toEqual(mockRuleset.endpoints);
  });

  it("should return empty array when no endpoints configured", async () => {
    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const getNetworkGroupingHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Network Endpoint Groupings",
    )?.[1];

    const mockProject = { id: "proj-1", name: "Project 1" };
    const mockRuleset = {
      projectId: "proj-1",
      endpoints: [],
    };

    mockCache.get.mockReturnValueOnce(mockProject);
    mockProjectAPI.getProjectNetworkGroupingRuleset.mockResolvedValue({
      body: mockRuleset,
    });

    const result = await getNetworkGroupingHandler({}, {});

    expect(JSON.parse(result.content[0].text)).toEqual([]);
  });

  it("should throw error when no project ID available", async () => {
    clientWithNoApiKey.registerTools(registerToolsSpy, getInputFunctionSpy);
    const getNetworkGroupingHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Network Endpoint Groupings",
    )?.[1];

    mockCache.get.mockReturnValueOnce(null);

    await expect(getNetworkGroupingHandler({}, {})).rejects.toThrow(
      "No current project found",
    );
  });
});
