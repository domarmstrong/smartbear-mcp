import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseAPI } from "../../../bugsnag/client/api/base.js";
import type {
  CurrentUserAPI,
  ErrorAPI,
} from "../../../bugsnag/client/api/index.js";
import type { ProjectAPI } from "../../../bugsnag/client/api/Project.js";
import { BugsnagClient } from "../../../bugsnag/client.js";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "../../../common/info.js";
import {
  getMockEvent,
  getMockOrganization,
  getMockProject,
} from "./utils/factories.ts";

// Mock the dependencies
const mockCurrentUserAPI = {
  listUserOrganizations: vi.fn(),
  getOrganizationProjects: vi.fn(),
} satisfies Omit<CurrentUserAPI, keyof BaseAPI>;

const mockErrorAPI = {
  viewErrorOnProject: vi.fn(),
  listEventsOnProject: vi.fn(),
  viewEventById: vi.fn(),
  listProjectErrors: vi.fn(),
  updateErrorOnProject: vi.fn(),
  getPivotValuesOnAnError: vi.fn(),
} satisfies Omit<ErrorAPI, keyof BaseAPI>;

const mockProjectAPI = {
  listProjectEventFields: vi.fn(),
  getProjectReleaseById: vi.fn(),
  listProjectReleaseGroups: vi.fn(),
  getReleaseGroup: vi.fn(),
  listBuildsInRelease: vi.fn(),
  getProjectNetworkGroupingRuleset: vi.fn(),
  updateProjectNetworkGroupingRuleset: vi.fn(),
  getProjectSpanGroup: vi.fn(),
  getProjectSpanGroupDistribution: vi.fn(),
  getProjectSpanGroupTimeline: vi.fn(),
  listProjectSpanGroups: vi.fn(),
  listProjectTraceFields: vi.fn(),
  listSpansBySpanGroupId: vi.fn(),
  listSpansByTraceId: vi.fn(),
} satisfies Omit<ProjectAPI, keyof BaseAPI>;

const mockCache = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
};

vi.mock("../../../bugsnag/client/api/index.js", () => ({
  ...vi.importActual("../../../bugsnag/client/api/index.js"),
  CurrentUserAPI: vi.fn().mockImplementation(() => mockCurrentUserAPI),
  ErrorAPI: vi.fn().mockImplementation(() => mockErrorAPI),
  ProjectAPI: vi.fn().mockImplementation(() => mockProjectAPI),
  Configuration: vi.fn().mockImplementation((config) => config),
  ErrorUpdateRequest: {
    OperationEnum: {
      Fix: "fix",
      Ignore: "ignore",
      OverrideSeverity: "override_severity",
      Open: "open",
      Discard: "discard",
      Undiscard: "undiscard",
      Snooze: "snooze",
      LinkIssue: "link_issue",
      UnlinkIssue: "unlink_issue",
    },
  },
}));

vi.mock("../../../common/bugsnag.js", () => ({
  default: {
    notify: vi.fn(),
  },
}));

// Mock console methods to prevent noisy test output and allow verification
const mockConsole = {
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Store original console methods
const originalConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log,
  info: console.info,
  debug: console.debug,
};

// Helper to create and configure a client
async function createConfiguredClient(
  authToken = "test-token",
  projectApiKey?: string,
  endpoint?: string,
): Promise<BugsnagClient> {
  const client = new BugsnagClient();
  const mockServer = { getCache: () => mockCache } as any;
  await client.configure(mockServer, {
    auth_token: authToken,
    project_api_key: projectApiKey,
    endpoint,
  });
  mockCache.get.mockClear();
  return client;
}

describe("BugsnagClient", () => {
  let client: BugsnagClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mock implementations to ensure no persistent return values affect tests
    mockCache.get.mockReset();
    mockCache.set.mockReset();
    mockCache.del.mockReset();

    // Mock console methods
    console.error = mockConsole.error;
    console.warn = mockConsole.warn;
    console.log = mockConsole.log;
    console.info = mockConsole.info;
    console.debug = mockConsole.debug;

    // Reset console mocks
    mockConsole.error.mockClear();
    mockConsole.warn.mockClear();
    mockConsole.log.mockClear();
    mockConsole.info.mockClear();
    mockConsole.debug.mockClear();
  });

  afterEach(() => {
    // Restore original console methods
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
  });

  describe("constructor", () => {
    it("should create client instance with proper dependencies", async () => {
      const client = new BugsnagClient();
      expect(client).toBeInstanceOf(BugsnagClient);
    });

    it("should configure endpoints correctly during construction", async () => {
      const { Configuration } = await import(
        "../../../bugsnag/client/api/index.js"
      );
      const MockedConfiguration = vi.mocked(Configuration);

      await createConfiguredClient("test-token", "00000hub-key");

      expect(MockedConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          basePath: "https://api.bugsnag.smartbear.com",
          apiKey: "token test-token",
          headers: expect.objectContaining({
            "User-Agent": `${MCP_SERVER_NAME}/${MCP_SERVER_VERSION}`,
            "Content-Type": "application/json",
            "X-Bugsnag-API": "true",
            "X-Version": "2",
          }),
        }),
      );
    });

    it("should set project API key when provided", async () => {
      const client = await createConfiguredClient(
        "test-token",
        "test-project-key",
      );
      expect(client).toBeInstanceOf(BugsnagClient);
    });
  });

  describe("getEndpoint method", () => {
    const client = new BugsnagClient();
    describe("without custom endpoint", () => {
      describe("with Hub API key (00000 prefix)", () => {
        it("should return Hub domain for api subdomain", async () => {
          const result = client.getEndpoint("api", "00000hub-key");
          expect(result).toBe("https://api.bugsnag.smartbear.com");
        });

        it("should return Hub domain for app subdomain", async () => {
          const result = client.getEndpoint("app", "00000test-key");
          expect(result).toBe("https://app.bugsnag.smartbear.com");
        });

        it("should return Hub domain for custom subdomain", async () => {
          const result = client.getEndpoint("custom", "00000key");
          expect(result).toBe("https://custom.bugsnag.smartbear.com");
        });

        it("should handle empty string after prefix", async () => {
          const result = client.getEndpoint("api", "00000");
          expect(result).toBe("https://api.bugsnag.smartbear.com");
        });
      });

      describe("with regular API key (non-Hub)", () => {
        it("should return Bugsnag domain for api subdomain", async () => {
          const result = client.getEndpoint("api", "regular-key");
          expect(result).toBe("https://api.bugsnag.com");
        });

        it("should return Bugsnag domain for app subdomain", async () => {
          const result = client.getEndpoint("app", "abc123def");
          expect(result).toBe("https://app.bugsnag.com");
        });

        it("should return Bugsnag domain for custom subdomain", async () => {
          const result = client.getEndpoint("custom", "test-key-123");
          expect(result).toBe("https://custom.bugsnag.com");
        });

        it("should handle API key with 00000 in middle", async () => {
          const result = client.getEndpoint("api", "key-00000-middle");
          expect(result).toBe("https://api.bugsnag.com");
        });
      });

      describe("without API key", () => {
        it("should return Bugsnag domain when API key is undefined", async () => {
          const result = client.getEndpoint("api", undefined);
          expect(result).toBe("https://api.bugsnag.com");
        });

        it("should return Bugsnag domain when API key is empty string", async () => {
          const result = client.getEndpoint("api", "");
          expect(result).toBe("https://api.bugsnag.com");
        });

        it("should return Bugsnag domain when API key is null", async () => {
          const result = client.getEndpoint("api", null as any);
          expect(result).toBe("https://api.bugsnag.com");
        });
      });
    });

    describe("with custom endpoint", () => {
      describe("Hub domain endpoints (always normalized)", () => {
        it("should normalize to HTTPS subdomain for exact hub domain match", async () => {
          const result = client.getEndpoint(
            "api",
            "00000key",
            "https://api.bugsnag.smartbear.com",
          );
          expect(result).toBe("https://api.bugsnag.smartbear.com");
        });

        it("should normalize to HTTPS subdomain regardless of input protocol", async () => {
          const result = client.getEndpoint(
            "api",
            "00000key",
            "http://app.bugsnag.smartbear.com",
          );
          expect(result).toBe("https://api.bugsnag.smartbear.com");
        });

        it("should normalize to HTTPS subdomain regardless of input subdomain", async () => {
          const result = client.getEndpoint(
            "app",
            "00000key",
            "https://api.bugsnag.smartbear.com",
          );
          expect(result).toBe("https://app.bugsnag.smartbear.com");
        });

        it("should normalize hub domain with port", async () => {
          const result = client.getEndpoint(
            "api",
            "00000key",
            "https://custom.bugsnag.smartbear.com:8080",
          );
          expect(result).toBe("https://api.bugsnag.smartbear.com");
        });

        it("should normalize hub domain with path", async () => {
          const result = client.getEndpoint(
            "api",
            "00000key",
            "https://custom.bugsnag.smartbear.com/path",
          );
          expect(result).toBe("https://api.bugsnag.smartbear.com");
        });

        it("should normalize complex subdomains to standard format", async () => {
          const result = client.getEndpoint(
            "api",
            "00000key",
            "https://staging.app.bugsnag.smartbear.com",
          );
          expect(result).toBe("https://api.bugsnag.smartbear.com");
        });
      });

      describe("Bugsnag domain endpoints (always normalized)", () => {
        it("should normalize to HTTPS subdomain for exact bugsnag domain match", async () => {
          const result = client.getEndpoint(
            "api",
            "regular-key",
            "https://api.bugsnag.com",
          );
          expect(result).toBe("https://api.bugsnag.com");
        });

        it("should normalize to HTTPS subdomain regardless of input protocol", async () => {
          const result = client.getEndpoint(
            "api",
            "regular-key",
            "http://app.bugsnag.com",
          );
          expect(result).toBe("https://api.bugsnag.com");
        });

        it("should normalize bugsnag domain with port", async () => {
          const result = client.getEndpoint(
            "app",
            "regular-key",
            "https://api.bugsnag.com:9000",
          );
          expect(result).toBe("https://app.bugsnag.com");
        });

        it("should normalize bugsnag domain with path", async () => {
          const result = client.getEndpoint(
            "app",
            "regular-key",
            "https://api.bugsnag.com/v2",
          );
          expect(result).toBe("https://app.bugsnag.com");
        });
      });

      describe("Custom domain endpoints (used as-is)", () => {
        it("should return custom endpoint exactly as provided", async () => {
          const customEndpoint = "https://custom.api.com";
          const result = client.getEndpoint("api", "00000key", customEndpoint);
          expect(result).toBe(customEndpoint);
        });

        it("should return custom endpoint as-is regardless of API key type", async () => {
          const customEndpoint = "https://my-custom-domain.com/api";
          const result = client.getEndpoint(
            "api",
            "regular-key",
            customEndpoint,
          );
          expect(result).toBe(customEndpoint);
        });

        it("should preserve HTTP protocol for custom domains", async () => {
          const customEndpoint = "http://localhost:3000";
          const result = client.getEndpoint("api", "00000key", customEndpoint);
          expect(result).toBe(customEndpoint);
        });

        it("should preserve custom domain with ports and paths", async () => {
          const customEndpoint = "https://192.168.1.100:8080/api/v1";
          const result = client.getEndpoint("api", "00000key", customEndpoint);
          expect(result).toBe(customEndpoint);
        });

        it("should preserve custom domain with query parameters", async () => {
          const customEndpoint = "https://custom.domain.com/api?version=1";
          const result = client.getEndpoint("api", "00000key", customEndpoint);
          expect(result).toBe(customEndpoint);
        });

        it("should preserve custom domain with fragments", async () => {
          const customEndpoint = "https://custom.domain.com/api#section";
          const result = client.getEndpoint("api", "00000key", customEndpoint);
          expect(result).toBe(customEndpoint);
        });
      });

      describe("edge cases", () => {
        it("should handle malformed custom endpoints gracefully", async () => {
          // This should throw due to invalid URL, which is expected behavior
          expect(() => {
            client.getEndpoint("api", "00000key", "not-a-valid-url");
          }).toThrow();
        });

        it("should preserve custom endpoints with userinfo", async () => {
          const customEndpoint = "https://user:pass@custom.domain.com";
          const result = client.getEndpoint("api", "00000key", customEndpoint);
          expect(result).toBe(customEndpoint);
        });

        it("should normalize known domains even with userinfo", async () => {
          const result = client.getEndpoint(
            "api",
            "00000key",
            "https://user:pass@app.bugsnag.smartbear.com",
          );
          expect(result).toBe("https://api.bugsnag.smartbear.com");
        });
      });
    });

    describe("subdomain validation", () => {
      it("should handle empty subdomain", async () => {
        const result = client.getEndpoint("", "00000key");
        expect(result).toBe("https://.bugsnag.smartbear.com");
      });

      it("should handle subdomain with special characters", async () => {
        const result = client.getEndpoint("test-api_v2", "00000key");
        expect(result).toBe("https://test-api_v2.bugsnag.smartbear.com");
      });

      it("should handle numeric subdomain", async () => {
        const result = client.getEndpoint("v1", "regular-key");
        expect(result).toBe("https://v1.bugsnag.com");
      });

      it("should handle very long subdomains", async () => {
        const longSubdomain = "very-long-subdomain-name-with-many-characters";
        const result = client.getEndpoint(longSubdomain, "00000key");
        expect(result).toBe(`https://${longSubdomain}.bugsnag.smartbear.com`);
      });
    });
  });

  describe("static utility methods", () => {
    // Test static methods if they exist in the class
    it("should have proper class structure", async () => {
      const client = new BugsnagClient();

      // Verify the client has expected methods
      expect(typeof client.configure).toBe("function");
      expect(typeof client.registerTools).toBe("function");
      expect(typeof client.registerResources).toBe("function");
    });
  });

  describe("error handling", () => {
    it("should handle invalid tokens gracefully during construction", async () => {
      expect(() => {
        new BugsnagClient();
      }).not.toThrow();

      expect(() => {
        new BugsnagClient();
      }).not.toThrow();
    });

    it("should handle special characters in project API key", async () => {
      expect(() => {
        new BugsnagClient();
      }).not.toThrow();
    });
  });

  describe("configuration validation", () => {
    it("should pass correct authToken to Configuration", async () => {
      const { Configuration } = await import(
        "../../../bugsnag/client/api/index.js"
      );
      const MockedConfiguration = vi.mocked(Configuration);
      const testToken = "super-secret-token-123";

      await createConfiguredClient(testToken);

      expect(MockedConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: `token ${testToken}`,
        }),
      );
    });

    it("should include all required headers", async () => {
      const { Configuration } = await import(
        "../../../bugsnag/client/api/index.js"
      );
      const MockedConfiguration = vi.mocked(Configuration);

      await createConfiguredClient("test-token");

      const configCall = MockedConfiguration.mock.calls[0][0];
      expect(configCall?.headers).toEqual({
        "User-Agent": `${MCP_SERVER_NAME}/${MCP_SERVER_VERSION}`,
        "Content-Type": "application/json",
        "X-Bugsnag-API": "true",
        "X-Version": "2",
      });
    });
  });

  describe("API client initialization", () => {
    it("should initialize all required API clients", async () => {
      const { CurrentUserAPI, ErrorAPI, ProjectAPI } = await import(
        "../../../bugsnag/client/api/index.js"
      );

      const MockedCurrentUserAPI = vi.mocked(CurrentUserAPI);
      const MockedErrorAPI = vi.mocked(ErrorAPI);
      const MockedProjectAPI = vi.mocked(ProjectAPI);

      // Clear previous calls from beforeEach and other tests
      MockedCurrentUserAPI.mockClear();
      MockedErrorAPI.mockClear();
      MockedProjectAPI.mockClear();

      await createConfiguredClient("test-token");

      expect(MockedCurrentUserAPI).toHaveBeenCalledOnce();
      expect(MockedErrorAPI).toHaveBeenCalledOnce();
      expect(MockedProjectAPI).toHaveBeenCalledOnce();
    });

    it("should use cache from server.getCache()", async () => {
      const client = new BugsnagClient();
      const mockServer = {
        getCache: vi.fn().mockReturnValue(mockCache),
      } as any;

      await client.configure(mockServer, { auth_token: "test-token" });

      // Cache should be used in getProjects
      mockCache.get.mockReturnValueOnce(null); // No cached org
      mockCache.get.mockReturnValueOnce(null); // No cached projects

      const mockOrg = getMockOrganization("org-1", "Test Org");
      const mockProjects = [getMockProject("proj-1", "Project 1")];
      mockCurrentUserAPI.listUserOrganizations.mockResolvedValue({
        body: [mockOrg],
      });
      mockCurrentUserAPI.getOrganizationProjects.mockResolvedValue({
        body: mockProjects,
      });

      await client.getProjects();

      expect(mockServer.getCache).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith("bugsnag_org", mockOrg);
      expect(mockCache.set).toHaveBeenCalledWith(
        "bugsnag_projects",
        mockProjects,
      );
    });
  });

  describe("initialization", () => {
    it("should initialize with API key", async () => {
      const client = new BugsnagClient();

      await client.configure({ getCache: () => mockCache } as any, {
        auth_token: "test-token",
        project_api_key: "project-api-key",
      });

      expect(client.isConfigured()).toBe(true);
    });
    it("should initialize without project API key", async () => {
      const client = new BugsnagClient();

      await client.configure({ getCache: () => mockCache } as any, {
        auth_token: "test-token",
      });

      expect(client.isConfigured()).toBe(true);
    });
  });

  describe("API methods", async () => {
    beforeEach(async () => {
      client = await createConfiguredClient("test-token", "test-project-key");
    });

    describe("getProjects", () => {
      const mockOrg = getMockOrganization("org-1", "Test Org");
      const mockProjects = [getMockProject("proj-1", "Project 1")];

      it("should return cached projects when available", async () => {
        mockCache.get.mockReturnValue(mockProjects);

        const result = await client.getProjects();

        expect(mockCache.get).toHaveBeenCalledWith("bugsnag_projects");
        expect(result).toEqual(mockProjects);
      });

      it("should fetch projects from API when not cached", async () => {
        mockCache.get
          .mockReturnValueOnce(null) // First call for projects
          .mockReturnValueOnce(mockOrg); // Second call for org
        mockCurrentUserAPI.getOrganizationProjects.mockResolvedValue({
          body: mockProjects,
        });

        const result = await client.getProjects();

        expect(mockCurrentUserAPI.getOrganizationProjects).toHaveBeenCalledWith(
          "org-1",
        );
        expect(mockCache.set).toHaveBeenCalledWith(
          "bugsnag_projects",
          mockProjects,
        );
        expect(result).toEqual(mockProjects);
      });

      it("should return empty array when no projects found", async () => {
        mockCache.get
          .mockReturnValueOnce(null) // First call for projects
          .mockReturnValueOnce(mockOrg); // Second call for org
        mockCurrentUserAPI.getOrganizationProjects.mockResolvedValue({
          body: [],
        });

        await expect(client.getProjects()).resolves.toEqual([]);
      });
    });

    describe("getEventById", () => {
      const mockOrgs = [getMockOrganization("org-1", "Test Org")];
      const mockProjects = [
        getMockProject("proj-1", "Project 1"),
        getMockProject("proj-2", "Project 2"),
      ];
      it("should find event across multiple projects", async () => {
        const mockEvent = getMockEvent("event-1");

        mockCache.get.mockReturnValueOnce(mockProjects);
        mockCache.get.mockReturnValueOnce(mockOrgs);
        mockCurrentUserAPI.getOrganizationProjects.mockResolvedValue({
          body: mockProjects,
        });
        mockErrorAPI.viewEventById
          .mockRejectedValueOnce(new Error("Not found")) // proj-1
          .mockResolvedValueOnce({ body: mockEvent }); // proj-2

        const result = await client.getEvent("event-1");

        expect(mockErrorAPI.viewEventById).toHaveBeenCalledWith(
          "proj-1",
          "event-1",
        );
        expect(mockErrorAPI.viewEventById).toHaveBeenCalledWith(
          "proj-2",
          "event-1",
        );
        expect(result).toEqual(mockEvent);
      });

      it("should return null when event not found in any project", async () => {
        mockCurrentUserAPI.listUserOrganizations.mockResolvedValue({
          body: mockOrgs,
        });
        mockCurrentUserAPI.getOrganizationProjects.mockResolvedValue({
          body: mockProjects,
        });
        mockErrorAPI.viewEventById.mockRejectedValue(new Error("Not found"));

        const result = await client.getEvent("event-1");

        expect(result).toBeNull();
      });
    });
  });

  describe("tool registration", () => {
    let registerToolsSpy: any;
    let getInputFunctionSpy: any;

    beforeEach(() => {
      registerToolsSpy = vi.fn();
      getInputFunctionSpy = vi.fn();
    });

    it("should register common tools", async () => {
      client.registerTools(registerToolsSpy, getInputFunctionSpy);

      const registeredTools = registerToolsSpy.mock.calls.map(
        (call: any) => call[0].title,
      );
      expect(registeredTools).toContain("Get Current Project");
      expect(registeredTools).toContain("List Projects");
      expect(registeredTools).toContain("Get Error");
      expect(registeredTools).toContain("Get Event");
      expect(registeredTools).toContain("Get Event Details From Dashboard URL");
      expect(registeredTools).toContain("List Project Errors");
      expect(registeredTools).toContain("List Project Event Filters");
      expect(registeredTools).toContain("Update Error");
      expect(registeredTools).toContain("Get Build");
      expect(registeredTools).toContain("List Releases");
      expect(registeredTools).toContain("Get Release");
      expect(registeredTools).toContain("List Span Groups");
      expect(registeredTools).toContain("Get Span Group");
      expect(registeredTools).toContain("List Spans");
      expect(registeredTools).toContain("Get Trace");
      expect(registeredTools).toContain("List Trace Fields");
      expect(registeredTools).toContain("Get Network Endpoint Groupings");
      expect(registeredTools).toContain("Set Network Endpoint Groupings");
      expect(registeredTools.length).toBe(18);
    });
  });

  describe("resource registration", () => {
    let registerResourcesSpy: any;

    beforeEach(() => {
      registerResourcesSpy = vi.fn();
    });

    it("should register event resource", async () => {
      client.registerResources(registerResourcesSpy);

      expect(registerResourcesSpy).toHaveBeenCalledWith(
        "event",
        "{id}",
        expect.any(Function),
      );
    });
  });
});
