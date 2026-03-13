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

describe("GetTrace Tool", () => {
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

  it("should get all spans for a trace", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    const mockSpans: Span[] = [
      getMockSpan("trace-abc", 1, "GET /api/users", "http_request"),
      getMockSpan("trace-abc", 2, "POST /api/login", "http_request"),
    ];

    mockCache.get.mockReturnValue(mockProject);
    mockProjectAPI.listSpansByTraceId.mockResolvedValue({
      body: mockSpans,
      nextUrl: null,
    });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);

    const getTraceHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Get Trace",
    )[1];

    const result = await getTraceHandler({
      traceId: "trace-abc",
      from: "2024-01-01T00:00:00Z",
      to: "2024-01-01T23:59:59Z",
      targetSpanId: "span-1",
      perPage: 50,
    });

    expect(mockProjectAPI.listSpansByTraceId).toHaveBeenCalledWith(
      "proj-1",
      "trace-abc",
      "2024-01-01T00:00:00Z",
      "2024-01-01T23:59:59Z",
      "span-1",
      50,
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
