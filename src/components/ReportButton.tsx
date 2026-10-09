import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getReportData } from "@/lib/rooms.functions";

export function ReportButton({ gameId, className }: { gameId: string; className?: string }) {
  const fetchReport = useServerFn(getReportData);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    try {
      const data = await fetchReport({ data: { gameId } });
      const { downloadReportPdf } = await import("@/lib/report-pdf");
      const name = await downloadReportPdf(data as any);
      toast.success(`Rapport téléchargé : ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Le rapport n'a pas pu être généré.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button onClick={run} disabled={loading} className={`min-h-11 rounded-none font-black uppercase ${className ?? ""}`}>
      <FileDown /> {loading ? "Génération…" : "Télécharger le rapport PDF"}
    </Button>
  );
}
