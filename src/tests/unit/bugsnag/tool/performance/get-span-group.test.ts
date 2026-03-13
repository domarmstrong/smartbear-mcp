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

describe("GetSpanGroup Tool", () => {
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

  it("should get span group with timeline and distribution", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    const mockSpanGroup: SpanGroup = getMockSpanGroup(
      1,
      "GET /api/users",
      "http_request",
    );
    const mockTimeline = {
      buckets: [{ timestamp: "2024-01-01", p95: 450 }],
    };
    const mockDistribution = { buckets: [{ range: "0-100ms", count: 50 }] };

    mockCache.get.mockReturnValue(mockProject);
    mockProjectAPI.getProjectSpanGroup.mockResolvedValue({
      body: mockSpanGroup,
    });
    mockProjectAPI.getProjectSpanGroupTimeline.mockResolvedValue({
      body: mockTimeline,
    });
    mockProjectAPI.getProjectSpanGroupDistribution.mockResolvedValue({
      body: mockDistribution,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);

    const getSpanGroupHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Span Group",
    )[1];

    const result = await getSpanGroupHandler({
      spanGroupId: "span-group-1",
    });

    expect(mockProjectAPI.getProjectSpanGroup).toHaveBeenCalledWith(
      "proj-1",
      "span-group-1",
      {
        "span.since": [
          {
            type: "eq",
            value: "7d",
          },
        ],
      },
    );
    expect(mockProjectAPI.getProjectSpanGroupTimeline).toHaveBeenCalledWith(
      "proj-1",
      "span-group-1",
      {
        "span.since": [
          {
            type: "eq",
            value: "7d",
          },
        ],
      },
    );
    expect(mockProjectAPI.getProjectSpanGroupDistribution).toHaveBeenCalledWith(
      "proj-1",
      "span-group-1",
      {
        "span.since": [
          {
            type: "eq",
            value: "7d",
          },
        ],
      },
    );
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ...mockSpanGroup,
            timeline: mockTimeline,
            distribution: mockDistribution,
          }),
        },
      ],
    });
  });
});
