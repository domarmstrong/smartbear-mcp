import { vi } from "vitest";
import type { BaseAPI } from "../../../../bugsnag/client/api/base.js";
import type {
  CurrentUserAPI,
  ErrorAPI,
} from "../../../../bugsnag/client/api/index.js";
import type { ProjectAPI } from "../../../../bugsnag/client/api/Project.js";

// Mock the CurrentUserAPI
export const mockCurrentUserAPI = {
  listUserOrganizations: vi.fn(),
  getOrganizationProjects: vi.fn(),
} satisfies Omit<CurrentUserAPI, keyof BaseAPI>;

// Mock the ErrorAPI
export const mockErrorAPI = {
  viewErrorOnProject: vi.fn(),
  listEventsOnProject: vi.fn(),
  viewEventById: vi.fn(),
  listProjectErrors: vi.fn(),
  updateErrorOnProject: vi.fn(),
  getPivotValuesOnAnError: vi.fn(),
} satisfies Omit<ErrorAPI, keyof BaseAPI>;

// Mock the ProjectAPI
export const mockProjectAPI = {
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

// Mock cache
export const mockCache = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
};

// Mock console methods
export const mockConsole = {
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
};

// Reset all mocks
export function resetAllMocks() {
  mockCurrentUserAPI.listUserOrganizations.mockReset();
  mockCurrentUserAPI.getOrganizationProjects.mockReset();
  mockErrorAPI.viewErrorOnProject.mockReset();
  mockErrorAPI.listEventsOnProject.mockReset();
  mockErrorAPI.viewEventById.mockReset();
  mockErrorAPI.listProjectErrors.mockReset();
  mockErrorAPI.updateErrorOnProject.mockReset();
  mockErrorAPI.getPivotValuesOnAnError.mockReset();
  mockProjectAPI.listProjectEventFields.mockReset();
  mockProjectAPI.getProjectReleaseById.mockReset();
  mockProjectAPI.listProjectReleaseGroups.mockReset();
  mockProjectAPI.getReleaseGroup.mockReset();
  mockProjectAPI.listBuildsInRelease.mockReset();
  mockProjectAPI.getProjectNetworkGroupingRuleset.mockReset();
  mockProjectAPI.updateProjectNetworkGroupingRuleset.mockReset();
  mockProjectAPI.getProjectSpanGroup.mockReset();
  mockProjectAPI.getProjectSpanGroupDistribution.mockReset();
  mockProjectAPI.getProjectSpanGroupTimeline.mockReset();
  mockProjectAPI.listProjectSpanGroups.mockReset();
  mockProjectAPI.listProjectTraceFields.mockReset();
  mockProjectAPI.listSpansBySpanGroupId.mockReset();
  mockProjectAPI.listSpansByTraceId.mockReset();
  mockCache.set.mockReset();
  mockCache.get.mockReset();
  mockCache.del.mockReset();
  mockConsole.error.mockReset();
  mockConsole.warn.mockReset();
  mockConsole.log.mockReset();
}
