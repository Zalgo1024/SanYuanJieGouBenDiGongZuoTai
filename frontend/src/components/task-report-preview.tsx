"use client";

import React from "react";
import type { Report } from "@/lib/domain";
import { ReportPresentation } from "./report-presentation";

export function TaskReportPreview({ report }: { report: Report }) {
  return (
    <section className="task-report-preview">
      <ReportPresentation markdown={report.markdown} fallbackTitle={report.title} mode="preview" reportHref={`/reports/${report.id}`} />
    </section>
  );
}
