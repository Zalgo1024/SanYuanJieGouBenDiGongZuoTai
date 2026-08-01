"use client";

import React from "react";
import type { Report } from "@/lib/domain";
import { MarkdownReport } from "@/lib/markdown";

export function TaskReportPreview({ report }: { report: Report }) {
  return (
    <section className="task-report-preview">
      <MarkdownReport markdown={report.markdown} />
    </section>
  );
}
