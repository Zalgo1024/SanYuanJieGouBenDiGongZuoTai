import type { AnalysisType, Project, ProjectStatus, Report } from "./domain";

type SortOrder = "updated-desc" | "updated-asc";

export interface ProjectFilters {
  query: string;
  type: "all" | AnalysisType;
  status: "all" | ProjectStatus;
  sort: SortOrder;
}

export interface ReportFilters {
  query: string;
  type: "all" | AnalysisType;
  sort: SortOrder;
}

function compareUpdatedAt(a: { updatedAt: string }, b: { updatedAt: string }, sort: SortOrder) {
  const difference = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
  return sort === "updated-asc" ? difference : -difference;
}

export function filterProjects(projects: Project[], filters: ProjectFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return projects
    .filter((project) => !query || `${project.name} ${project.description}`.toLocaleLowerCase().includes(query))
    .filter((project) => filters.type === "all" || project.type === filters.type)
    .filter((project) => filters.status === "all" || project.status === filters.status)
    .sort((a, b) => compareUpdatedAt(a, b, filters.sort));
}

export function filterReports(reports: Report[], filters: ReportFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return reports
    .filter((report) => !query || `${report.title} ${report.markdown}`.toLocaleLowerCase().includes(query))
    .filter((report) => filters.type === "all" || report.type === filters.type)
    .sort((a, b) => compareUpdatedAt(a, b, filters.sort));
}
