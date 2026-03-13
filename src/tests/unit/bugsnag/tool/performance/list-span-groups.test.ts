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

import type { SpanGroup } from "../../../../../bugsnag/client/api/api.js";
import { BugsnagClient } from "../../../../../bugsnag/client.js";
import { getMockProject, getMockSpanGroup } from "../../utils/factories.js";
import { resetAllMocks } from "../../utils/test-helpers.js";

describe("ListSpanGroups Tool", () => {
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

  it("should list span groups with default parameters", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    const mockSpanGroups: SpanGroup[] = [
      getMockSpanGroup(1, "GET /api/users", "app_start"),
      getMockSpanGroup(2, "POST /api/login", "http_request"),
    ];

    mockCache.get.mockReturnValue(mockProject);
    mockProjectAPI.listProjectSpanGroups.mockResolvedValue({
      body: mockSpanGroups,
      nextUrl: null,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);

    const listSpanGroupsHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Span Groups",
    )[1];

    const result = await listSpanGroupsHandler({});

    expect(mockProjectAPI.listProjectSpanGroups).toHaveBeenCalledWith(
      "proj-1",
      undefined,
      "desc",
      30,
      undefined,
      {
        "span.since": [
          {
            type: "eq",
            value: "7d",
          },
        ],
      },
      undefined,
      undefined,
    );
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            data: mockSpanGroups,
            next_url: null,
            count: 2,
          }),
        },
      ],
    });
  });

  it("should list span groups with sorting and filtering", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    const mockSpanGroups: SpanGroup[] = [
      getMockSpanGroup(1, "GET /api/users", "http_request"),
    ];
    const filters = {
      "span_group.category": [{ type: "eq", value: "http_request" }],
    };

    mockCache.get.mockReturnValue(mockProject);
    mockProjectAPI.listProjectSpanGroups.mockResolvedValue({
      body: mockSpanGroups,
      nextUrl: "/next",
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);

    const listSpanGroupsHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Span Groups",
    )[1];

    const result = await listSpanGroupsHandler({
      sort: "duration_p95",
      direction: "desc",
      perPage: 10,
      starredOnly: true,
      filters: filters,
    });

    expect(mockProjectAPI.listProjectSpanGroups).toHaveBeenCalledWith(
      "proj-1",
      "duration_p95",
      "desc",
      10,
      undefined,
      filters,
      true,
      undefined,
    );
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            data: mockSpanGroups,
            next_url: "/next",
            count: 1,
          }),
        },
      ],
    });
  });
});
