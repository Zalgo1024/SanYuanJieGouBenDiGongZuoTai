"use client";

// 阶段三数据 hooks —— 统一基于 react-query 取后端账本数据。
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getProjects,
  getProject,
  getTasks,
  getAnalyze,
  type ProjectDTO,
  type TaskDTO,
  type TaskListParams,
  type AnalyzeResult,
} from "@/lib/api";
import { parseDiagram, type Diagram } from "@/lib/network";

export function useProjects() {
  return useQuery<ProjectDTO[]>({
    queryKey: ["projects"],
    queryFn: getProjects,
  });
}

export function useProject(id?: string | null) {
  return useQuery<ProjectDTO | null>({
    queryKey: ["project", id],
    queryFn: () => getProject(id as string),
    enabled: !!id,
  });
}

export function useTasks(params: TaskListParams = {}) {
  return useQuery<TaskDTO[]>({
    queryKey: ["tasks", params],
    queryFn: () => getTasks(params),
  });
}

export function useReport(taskId?: string | null) {
  return useQuery<AnalyzeResult>({
    queryKey: ["report", taskId],
    queryFn: () => getAnalyze(taskId as string),
    enabled: !!taskId,
  });
}

/** 取某报告的 DIAGRAM 利益关系图（解析自 Markdown）。 */
export function useDiagram(taskId?: string | null): {
  diagram: Diagram | null;
  isLoading: boolean;
  isError: boolean;
} {
  const q = useReport(taskId);
  const diagram = useMemo(
    () => (q.data?.data ? parseDiagram(q.data.data.markdown) : null),
    [q.data]
  );
  return { diagram, isLoading: q.isLoading, isError: q.isError };
}
