import { beforeEach, describe, expect, it, vi } from "vitest";
import { BugsnagClient } from "../../../../../bugsnag/client.js";
import { getMockProject } from "../../utils/factories.js";
import {
  mockCache,
  mockConsole,
  mockCurrentUserAPI,
  mockErrorAPI,
  mockProjectAPI,
  resetAllMocks,
} from "../../utils/test-helpers.js";

vi.mock("../../../../../bugsnag/client/api/index.js", () => ({
  ...vi.importActual("../../../../../bugsnag/client/api/index.js"),
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

vi.mock("../../../../../common/bugsnag.js", () => ({
  default: {
    notify: vi.fn(),
  },
}));

describe("UpdateError Tool", () => {
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

  it("should link a Jira issue to an error (link_issue)", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    mockCache.get.mockReturnValue(mockProject);
    mockErrorAPI.updateErrorOnProject.mockResolvedValue({ status: 200 });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    const result = await toolHandler({
      errorId: "error-1",
      operation: "link_issue",
      issue_url: "https://jira.example.com/browse/ISSUE-123",
    });

    expect(mockErrorAPI.updateErrorOnProject).toHaveBeenCalledWith(
      "proj-1",
      "error-1",
      {
        operation: "link_issue",
        issue_url: "https://jira.example.com/browse/ISSUE-123",
        verify_issue_url: true,
      },
    );
    expect(result.content[0].text).toBe(JSON.stringify({ success: true }));
  });

  it("should unlink a Jira issue from an error (unlink_issue)", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    mockCache.get.mockReturnValue(mockProject);
    mockErrorAPI.updateErrorOnProject.mockResolvedValue({ status: 200 });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    const result = await toolHandler({
      errorId: "error-1",
      operation: "unlink_issue",
    });

    expect(mockErrorAPI.updateErrorOnProject).toHaveBeenCalledWith(
      "proj-1",
      "error-1",
      {
        operation: "unlink_issue",
      },
    );
    expect(result.content[0].text).toBe(JSON.stringify({ success: true }));
  });

  it("should update error status to snooze for 1 hour with project from cache", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    mockCache.get.mockReturnValue(mockProject);
    mockErrorAPI.updateErrorOnProject.mockResolvedValue({ status: 200 });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    const result = await toolHandler({
      errorId: "error-1",
      operation: "snooze",
      reopenRules: {
        reopenIf: "occurs_after",
        seconds: 3600,
      },
    });

    expect(mockErrorAPI.updateErrorOnProject).toHaveBeenCalledWith(
      "proj-1",
      "error-1",
      {
        operation: "snooze",
        reopen_rules: {
          reopen_if: "occurs_after",
          seconds: 3600,
        },
      },
    );
    expect(result.content[0].text).toBe(JSON.stringify({ success: true }));
  });

  it("should update error status to snooze until 10 additional users affected", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    mockCache.get.mockReturnValue(mockProject);
    mockErrorAPI.updateErrorOnProject.mockResolvedValue({ status: 200 });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    const result = await toolHandler({
      errorId: "error-1",
      operation: "snooze",
      reopenRules: {
        reopenIf: "n_additional_users",
        additionalUsers: 10,
      },
    });

    expect(mockErrorAPI.updateErrorOnProject).toHaveBeenCalledWith(
      "proj-1",
      "error-1",
      {
        operation: "snooze",
        reopen_rules: {
          reopen_if: "n_additional_users",
          additional_users: 10,
        },
      },
    );
    expect(result.content[0].text).toBe(JSON.stringify({ success: true }));
  });

  it("should update error status to snooze until 10 additional occurrences", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    mockCache.get.mockReturnValue(mockProject);
    mockErrorAPI.updateErrorOnProject.mockResolvedValue({ status: 200 });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    const result = await toolHandler({
      errorId: "error-1",
      operation: "snooze",
      reopenRules: {
        reopenIf: "n_additional_occurrences",
        additionalOccurrences: 10,
      },
    });

    expect(mockErrorAPI.updateErrorOnProject).toHaveBeenCalledWith(
      "proj-1",
      "error-1",
      {
        operation: "snooze",
        reopen_rules: {
          reopen_if: "n_additional_occurrences",
          additional_occurrences: 10,
        },
      },
    );
    expect(result.content[0].text).toBe(JSON.stringify({ success: true }));
  });

  it("should update error status to snooze until 10 occurrences in 2 hours", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    mockCache.get.mockReturnValue(mockProject);
    mockErrorAPI.updateErrorOnProject.mockResolvedValue({ status: 200 });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    const result = await toolHandler({
      errorId: "error-1",
      operation: "snooze",
      reopenRules: {
        reopenIf: "n_occurrences_in_m_hours",
        occurrences: 10,
        hours: 2,
      },
    });

    expect(mockErrorAPI.updateErrorOnProject).toHaveBeenCalledWith(
      "proj-1",
      "error-1",
      {
        operation: "snooze",
        reopen_rules: {
          reopen_if: "n_occurrences_in_m_hours",
          occurrences: 10,
          hours: 2,
        },
      },
    );
    expect(result.content[0].text).toBe(JSON.stringify({ success: true }));
  });

  it("should update error successfully with project from cache", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    mockCache.get.mockReturnValue(mockProject);
    mockErrorAPI.updateErrorOnProject.mockResolvedValue({ status: 200 });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    const result = await toolHandler({
      errorId: "error-1",
      operation: "fix",
    });

    expect(mockErrorAPI.updateErrorOnProject).toHaveBeenCalledWith(
      "proj-1",
      "error-1",
      { operation: "fix" },
    );
    expect(result.content[0].text).toBe(JSON.stringify({ success: true }));
  });

  it("should update error successfully with explicit project ID", async () => {
    const mockProjects = [
      getMockProject("proj-1", "Project 1"),
      getMockProject("proj-2", "Project 2"),
    ];
    mockCache.get.mockReturnValue(mockProjects);
    mockErrorAPI.updateErrorOnProject.mockResolvedValue({ status: 204 });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    const result = await toolHandler({
      projectId: "proj-1",
      errorId: "error-1",
      operation: "ignore",
    });

    expect(mockErrorAPI.updateErrorOnProject).toHaveBeenCalledWith(
      "proj-1",
      "error-1",
      { operation: "ignore" },
    );
    expect(result.content[0].text).toBe(JSON.stringify({ success: true }));
  });

  it("should handle all permitted operations", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    // Test all operations except override_severity which requires special elicitInput handling
    const operations = ["open", "fix", "ignore", "discard", "undiscard"];

    mockCache.get.mockReturnValue(mockProject);
    mockErrorAPI.updateErrorOnProject.mockResolvedValue({ status: 200 });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    for (const operation of operations) {
      await toolHandler({
        errorId: "error-1",
        operation: operation as any,
      });

      expect(mockErrorAPI.updateErrorOnProject).toHaveBeenCalledWith(
        "proj-1",
        "error-1",
        { operation, severity: undefined },
      );
    }

    expect(mockErrorAPI.updateErrorOnProject).toHaveBeenCalledTimes(
      operations.length,
    );
  });

  it("should handle override_severity operation with elicitInput", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    getInputFunctionSpy.mockResolvedValue({
      action: "accept",
      content: { severity: "warning" },
    });

    mockCache.get.mockReturnValue(mockProject);
    mockErrorAPI.updateErrorOnProject.mockResolvedValue({ status: 200 });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    const result = await toolHandler({
      errorId: "error-1",
      operation: "override_severity",
    });

    expect(getInputFunctionSpy).toHaveBeenCalledWith({
      message:
        "Please provide the new severity for the error (e.g. 'info', 'warning', 'error', 'critical')",
      requestedSchema: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["info", "warning", "error"],
            description: "The new severity level for the error",
          },
        },
        required: ["severity"],
      },
    });

    expect(mockErrorAPI.updateErrorOnProject).toHaveBeenCalledWith(
      "proj-1",
      "error-1",
      { operation: "override_severity", severity: "warning" },
    );
    expect(result.content[0].text).toBe(JSON.stringify({ success: true }));
  });

  it("should handle override_severity operation when elicitInput is rejected", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    getInputFunctionSpy.mockResolvedValue({
      action: "reject",
    });

    mockCache.get.mockReturnValue(mockProject);
    mockErrorAPI.updateErrorOnProject.mockResolvedValue({ status: 200 });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    const result = await toolHandler({
      errorId: "error-1",
      operation: "override_severity",
    });

    expect(mockErrorAPI.updateErrorOnProject).toHaveBeenCalledWith(
      "proj-1",
      "error-1",
      { operation: "override_severity", severity: undefined },
    );
    expect(result.content[0].text).toBe(JSON.stringify({ success: true }));
  });

  it("should return false when API returns non-success status", async () => {
    const mockProject = getMockProject("proj-1", "Project 1");
    mockCache.get.mockReturnValue(mockProject);
    mockErrorAPI.updateErrorOnProject.mockResolvedValue({ status: 400 });

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    const result = await toolHandler({
      errorId: "error-1",
      operation: "fix",
    });

    expect(result.content[0].text).toBe(JSON.stringify({ success: false }));
  });

  it("should throw error when no project found", async () => {
    mockCache.get.mockReturnValue(null);

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    await expect(
      toolHandler({
        errorId: "error-1",
        operation: "fix",
      }),
    ).rejects.toThrow(
      "No current project found. Please provide a projectId or configure a project API key.",
    );
  });

  it("should throw error when project ID not found", async () => {
    const mockProjects = [getMockProject("proj-1", "Project 1")];

    mockCache.get.mockReturnValueOnce(mockProjects); // Return projects for lookup

    client.registerTools(registerToolsSpy, getInputFunctionSpy);
    const toolHandler = registerToolsSpy.mock.calls.find(
      (call: any) => call[0].title === "Update Error",
    )[1];

    await expect(
      toolHandler({
        projectId: "non-existent-project",
        errorId: "error-1",
        operation: "fix",
      }),
    ).rejects.toThrow("Project with ID non-existent-project not found.");
  });
});
