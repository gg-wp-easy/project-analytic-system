import { useEffect, useState } from "react";
import type { ValuationReport } from "../model/valuation-report.types";

// Bumped when the report shape changes: a report saved in an older shape is dropped.
const REPORT_VERSION = 4;

function readReport(key: string): ValuationReport | null {
  try {
    const raw = window.localStorage.getItem(key);
    const stored = raw ? (JSON.parse(raw) as { version?: number; report?: ValuationReport }) : null;
    return stored?.version === REPORT_VERSION && stored.report ? stored.report : null;
  } catch {
    return null;
  }
}

/** The latest valuation report of a page, kept next to the page's own saved state. */
export function usePersistentValuationReport(pageStateKey: string) {
  const key = `${pageStateKey}:valuation-report`;
  const [report, setReport] = useState<ValuationReport | null>(() => readReport(key));

  useEffect(() => {
    try {
      if (report) {
        window.localStorage.setItem(key, JSON.stringify({ version: REPORT_VERSION, report }));
      } else {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Storage full or unavailable: the report still lives in memory.
    }
  }, [key, report]);

  return [report, setReport] as const;
}
