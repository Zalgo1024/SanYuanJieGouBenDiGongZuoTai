import { TaskWorkbench } from "@/components/task-workbench";

export default async function AnalysisTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <TaskWorkbench taskId={taskId} />;
}
