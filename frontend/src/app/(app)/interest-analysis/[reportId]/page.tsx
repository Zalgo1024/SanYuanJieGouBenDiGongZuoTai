import { InterestAnalysisScreen } from "@/components/app-screens";
export default async function InterestAnalysisPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return <InterestAnalysisScreen reportId={reportId} />;
}
