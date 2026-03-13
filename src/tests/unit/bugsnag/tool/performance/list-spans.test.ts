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

import type { Span } from "../../../../../bugsnag/client/api/api.js";
import { BugsnagClient } from "../../../../../bugsnag/client.js";
import { getMockProject, getMockSpan } from "../../utils/factories.js";
import { resetAllMocks } from "../../utils/test-helpers.js";

describe("ListSpans Tool", () => {
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

  it("should list spans for a span group", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    const mockSpans: Span[] = [
      getMockSpan("trace-def", 1, "GET /api/users", "http_request"),
      getMockSpan("trace-def", 2, "POST /api/login", "http_request"),
    ];

    mockCache.get.mockReturnValue(mockProject);
    mockProjectAPI.listSpansBySpanGroupId.mockResolvedValue({
      body: mockSpans,
      nextUrl: null,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);

    const listSpansHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "List Spans",
    )[1];

    const result = await listSpansHandler({
      spanGroupId: "span-group-1",
      sort: "duration",
      direction: "desc",
      perPage: 20,
    });

    expect(mockProjectAPI.listSpansBySpanGroupId).toHaveBeenCalledWith(
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
      "duration",
      "desc",
      20,
      undefined,
    );
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            data: mockSpans,
            next_url: null,
            count: 2,
          }),
        },
      ],
    });
  });
});
