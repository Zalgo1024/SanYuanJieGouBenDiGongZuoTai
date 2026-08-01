import { ReportReaderScreen } from "@/components/app-screens";
export default async function ReportReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportReaderScreen reportId={id} />;
}
