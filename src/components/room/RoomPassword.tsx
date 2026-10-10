import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getRoomPassword, setRoomPassword } from "@/lib/rooms.functions";

export function RoomPassword({ gameId }: { gameId: string }) {
  const fetchPw = useServerFn(getRoomPassword);
  const savePw = useServerFn(setRoomPassword);
  const q = useQuery({ queryKey: ["room-password", gameId], queryFn: () => fetchPw({ data: { gameId } }) });
  const [shown, setShown] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await savePw({ data: { gameId, password: value } });
      toast.success(value ? "Mot de passe enregistré" : "Mot de passe retiré");
      setEditing(false); setValue(""); await q.refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  };

  const d = q.data;
  return (
    <section className="border-2 border-foreground p-4" aria-label="Mot de passe du salon">
      <p className="section-label">Mot de passe du salon · visible par toi seul</p>
      {q.isLoading && <p className="mt-2 text-sm">Chargement…</p>}
      {d && !editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!d.hasPassword && <span className="text-sm text-muted-foreground">Aucun mot de passe.</span>}
          {d.hasPassword && !d.recoverable && <span className="text-sm text-muted-foreground">Ancien mot de passe illisible : définis-le à nouveau pour pouvoir l'afficher.</span>}
          {d.password && (
            <>
              <span className="flex min-h-11 items-center border border-foreground px-3 font-pixel text-lg">{shown ? d.password : "••••••"}</span>
              <Button variant="outline" className="min-h-11 rounded-none" onClick={() => setShown((s) => !s)}>{shown ? "Masquer" : "Afficher"}</Button>
              <Button variant="outline" className="min-h-11 rounded-none" onClick={() => navigator.clipboard.writeText(d.password!).then(() => toast.success("Mot de passe copié"), () => toast.error("Copie impossible"))}>Copier</Button>
            </>
          )}
          <Button variant="outline" className="min-h-11 rounded-none" onClick={() => setEditing(true)}>{d.hasPassword ? "Changer" : "Ajouter"}</Button>
        </div>
      )}
      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input aria-label="Nouveau mot de passe" maxLength={64} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Vide = sans mot de passe" className="min-h-11 flex-1 border-2 border-foreground bg-background px-3" />
          <Button className="min-h-11 rounded-none" disabled={busy} onClick={save}>Enregistrer</Button>
          <Button variant="outline" className="min-h-11 rounded-none" onClick={() => { setEditing(false); setValue(""); }}>Annuler</Button>
        </div>
      )}
    </section>
  );
}
