import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Settings } from "lucide-react";

const SECTIONS = [
  { key: "conexao", label: "Conexão" },
  { key: "upload", label: "Upload" },
  { key: "painel", label: "Painel de Indicadores" },
  { key: "c2-desenvolvimento-infantil", label: "C2 - Desenv. Infantil" },
  { key: "c3-gestantes-puerperas", label: "C3 - Gestantes e Puérperas" },
  { key: "c4-pessoas-diabetes", label: "C4 - Pessoa com Diabetes" },
  { key: "c5-pessoas-hipertensao", label: "C5 - Pessoa com Hipertensão" },
  { key: "c6-pessoa-idosa", label: "C6 - Pessoa Idosa" },
  { key: "c7-pccu-prevencao", label: "C7 - PCCU e Prevenção" },
  { key: "lista-geral", label: "Lista Geral" },
  { key: "exportacao", label: "Exportação de Dados" },
  { key: "auditoria", label: "Auditoria" },
  { key: "cadastro-municipal", label: "Cadastro Municipal" },
  { key: "perfis", label: "Perfis" },
  { key: "gestao-usuarios", label: "Gestão de Usuários" },
];

const ACCESS_OPTIONS = [
  { value: "sem_acesso", label: "Sem acesso" },
  { value: "visualizacao", label: "Visualização" },
  { value: "edicao", label: "Edição" },
  { value: "admin_total", label: "Admin total" },
];

interface Profile { id: string; name: string; description: string | null; is_active: boolean; }
interface PermissionRow { id?: string; section_key: string; access_level: string; }

export function ProfilesManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [perms, setPerms] = useState<Record<string, string>>({});
  const [savingPerms, setSavingPerms] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase.from("access_profiles").select("*").order("name");
      if (queryError) throw new Error(queryError.message);
      setProfiles((data as Profile[]) || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar perfis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfiles(); }, []);

  const openNew = () => { setEditProfile(null); setName(""); setDescription(""); setDialogOpen(true); };
  const openEdit = (p: Profile) => { setEditProfile(p); setName(p.name); setDescription(p.description || ""); setDialogOpen(true); };

  const save = async () => {
    if (!name.trim()) { toast.error("Nome é obrigatório."); return; }
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null };
    if (editProfile) {
      const { error } = await supabase.from("access_profiles").update(payload).eq("id", editProfile.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Perfil atualizado.");
    } else {
      const { error } = await supabase.from("access_profiles").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Perfil cadastrado.");
    }
    setSaving(false);
    setDialogOpen(false);
    fetchProfiles();
  };

  const toggleActive = async (p: Profile) => {
    const { error } = await supabase.from("access_profiles").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(p.is_active ? "Perfil inativado." : "Perfil ativado.");
    fetchProfiles();
  };

  const openPermissions = async (p: Profile) => {
    setSelectedProfile(p);
    const { data } = await supabase.from("profile_permissions").select("section_key, access_level").eq("profile_id", p.id);
    const permMap: Record<string, string> = {};
    SECTIONS.forEach((s) => { permMap[s.key] = "sem_acesso"; });
    (data || []).forEach((row: any) => { permMap[row.section_key] = row.access_level; });
    setPerms(permMap);
    setPermDialogOpen(true);
  };

  const savePermissions = async () => {
    if (!selectedProfile) return;
    setSavingPerms(true);

    // Delete existing and re-insert
    await supabase.from("profile_permissions").delete().eq("profile_id", selectedProfile.id);
    const rows = Object.entries(perms)
      .filter(([, level]) => level !== "sem_acesso")
      .map(([section_key, access_level]) => ({
        profile_id: selectedProfile.id,
        section_key,
        access_level: access_level as "sem_acesso" | "visualizacao" | "edicao" | "admin_total",
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from("profile_permissions").insert(rows);
      if (error) { toast.error(error.message); setSavingPerms(false); return; }
    }
    setSavingPerms(false);
    setPermDialogOpen(false);
    toast.success("Permissões salvas.");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Perfis de Acesso</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo Perfil</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchProfiles}>Tentar novamente</Button>
          </div>
        ) : profiles.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhum perfil cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.description || "—"}</TableCell>
                  <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" title="Permissões" onClick={() => openPermissions(p)}><Settings className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title={p.is_active ? "Inativar" : "Ativar"} onClick={() => toggleActive(p)}>
                      <Badge variant={p.is_active ? "destructive" : "default"} className="text-xs">{p.is_active ? "Off" : "On"}</Badge>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Edit/Create Profile Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editProfile ? "Editar Perfil" : "Novo Perfil"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1"><Label>Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Permissions Dialog */}
        <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Permissões: {selectedProfile?.name}</DialogTitle></DialogHeader>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {SECTIONS.map((s) => (
                <div key={s.key} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">{s.label}</span>
                  <Select value={perms[s.key] || "sem_acesso"} onValueChange={(v) => setPerms((p) => ({ ...p, [s.key]: v }))}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{ACCESS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPermDialogOpen(false)}>Cancelar</Button>
              <Button onClick={savePermissions} disabled={savingPerms}>{savingPerms && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Permissões</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
