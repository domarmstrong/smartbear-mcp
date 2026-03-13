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
import { getMockProject } from "../../utils/factories.js";
import { resetAllMocks } from "../../utils/test-helpers.js";

describe("ListProjects Tool", () => {
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

  it("should return all projects", async () => {
    const mockProjects = [getMockProject("proj-1", "Project 1")];
    mockCache.get.mockReturnValue(mockProjects);

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Projects",
    )[1];

    const result = await toolHandler({});

    const expectedResult = {
      data: mockProjects,
      count: 1,
    };
    expect(result.content[0].text).toBe(JSON.stringify(expectedResult));
  });

  it("should handle no projects found", async () => {
    mockCache.get.mockReturnValue([]);

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Projects",
    )[1];

    await expect(toolHandler({})).rejects.toThrow(
      "No BugSnag projects found for the current user.",
    );
  });

  it("should filter projects by API key parameter", async () => {
    const mockProjects = [
      getMockProject("proj-1", "Project 1", "key-1"),
      getMockProject("proj-2", "Project 2", "key-2"),
    ];
    mockCache.get.mockReturnValue(mockProjects);

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Projects",
    )[1];

    const result = await toolHandler({ apiKey: "key-2" });
    const expectedResult = {
      data: [mockProjects[1]],
      count: 1,
    };
    expect(result.content[0].text).toBe(JSON.stringify(expectedResult));
  });

  it("should filter projects by apiKey parameter - no match", async () => {
    const mockProjects = [getMockProject("proj-1", "Project 1", "key-1")];
    mockCache.get.mockReturnValue(mockProjects);

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Projects",
    )[1];

    const result = await toolHandler({ apiKey: "key-x" });
    const expectedResult = {
      data: [],
      count: 0,
    };
    expect(result.content[0].text).toBe(JSON.stringify(expectedResult));
  });
});
