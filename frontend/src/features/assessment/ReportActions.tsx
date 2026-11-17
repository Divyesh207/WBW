import { useState } from "react";
import { Braces, FileDown, Printer } from "lucide-react";
import { Button } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { ApiError, api } from "../../services/api";

/** Download PDF / export JSON / print — used on the assessment, report list and report pages. */
export function ReportActions({ id, compact, onPrint }: { id: number; compact?: boolean; onPrint?: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"pdf" | "json" | null>(null);

  const run = async (kind: "pdf" | "json") => {
    setBusy(kind);
    try {
      const name = await (kind === "pdf" ? api.downloadPdf(id) : api.downloadJson(id));
      toast.success(`Downloaded ${name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  };

  const size = compact ? "sm" : "md";
  return (
    <>
      <Button variant={compact ? "secondary" : "primary"} size={size} onClick={() => run("pdf")} loading={busy === "pdf"}>
        {busy !== "pdf" && <FileDown className="h-4 w-4" aria-hidden />} {compact ? "PDF" : "Download PDF"}
      </Button>
      <Button variant="secondary" size={size} onClick={() => run("json")} loading={busy === "json"}>
        {busy !== "json" && <Braces className="h-4 w-4" aria-hidden />} {compact ? "JSON" : "Export JSON"}
      </Button>
      {onPrint && (
        <Button variant="secondary" size={size} onClick={onPrint}>
          <Printer className="h-4 w-4" aria-hidden /> Print report
        </Button>
      )}
    </>
  );
}
