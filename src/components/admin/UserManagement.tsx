import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, Ban, Unlock, KeyRound, Pencil, Loader2 } from "lucide-react";

interface AppUserRow {
  id: string;
  auth_user_id: string;
  nome_completo: string;
  email: string;
  status: string;
  acesso: boolean;
  is_master_admin: boolean;
  municipality_id: string | null;
  health_unit_id: string | null;
  job_function_id: string | null;
  profile_id: string | null;
  cpf: string | null;
  cns: string | null;
  telefone: string | null;
}

interface SelectOption { id: string; name: string; }

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente_aprovacao: { label: "Pendente", variant: "outline" },
  aprovado: { label: "Aprovado", variant: "default" },
  bloqueado: { label: "Bloqueado", variant: "destructive" },
  reprovado: { label: "Reprovado", variant: "destructive" },
  inativo: { label: "Inativo", variant: "secondary" },
};

export function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [municipalities, setMunicipalities] = useState<SelectOption[]>([]);
  const [healthUnits, setHealthUnits] = useState<SelectOption[]>([]);
  const [jobFunctions, setJobFunctions] = useState<SelectOption[]>([]);
  const [profiles, setProfiles] = useState<SelectOption[]>([]);

  const [editUser, setEditUser] = useState<AppUserRow | null>(null);
  const [editForm, setEditForm] = useState({ municipality_id: "", health_unit_id: "", job_function_id: "", profile_id: "" });
  const [editUnits, setEditUnits] = useState<SelectOption[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase.from("app_users").select("*").order("created_at", { ascending: false });
      if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
      const { data, error: queryError } = await q;
      if (queryError) throw new Error(queryError.message);
      setUsers((data as AppUserRow[]) || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [filterStatus]);

  useEffect(() => {
    supabase.from("municipalities").select("id, name").eq("is_active", true).order("name").then(({ data }) => setMunicipalities(data || []));
    supabase.from("job_functions").select("id, name").eq("is_active", true).order("name").then(({ data }) => setJobFunctions(data || []));
    supabase.from("access_profiles").select("id, name").eq("is_active", true).order("name").then(({ data }) => setProfiles(data || []));
  }, []);

  const updateStatus = async (appUser: AppUserRow, action: string, status: "pendente_aprovacao" | "aprovado" | "bloqueado" | "reprovado" | "inativo", acesso: boolean) => {
    const { error } = await supabase.from("app_users").update({ status, acesso }).eq("id", appUser.id);
    if (error) { toast.error(error.message); return; }
    if (!user) { toast.error("Sessão expirada. Faça login novamente."); return; }
    await supabase.from("approval_logs").insert({
      app_user_id: appUser.id,
      action,
      performed_by: user.id,
    });
    toast.success(`Usuário ${action} com sucesso.`);
    fetchUsers();
  };

  const resetPassword = async (appUser: AppUserRow) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/admin-reset-password`;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ target_user_id: appUser.auth_user_id }),
    });
    const result = await res.json();
    if (result.success) {
      toast.success("Senha resetada com sucesso!", {
        description: `Senha temporária: ${result.temp_password}. Copie esta senha agora, pois ela não será mostrada novamente.`,
        duration: 10000,
      });
      fetchUsers();
    } else {
      toast.error(result.error || "Erro ao resetar senha.");
    }
  };

  const openEdit = (u: AppUserRow) => {
    setEditUser(u);
    setEditForm({
      municipality_id: u.municipality_id || "",
      health_unit_id: u.health_unit_id || "",
      job_function_id: u.job_function_id || "",
      profile_id: u.profile_id || "",
    });
    if (u.municipality_id) {
      supabase.from("health_units").select("id, name").eq("municipality_id", u.municipality_id).eq("is_active", true).order("name")
        .then(({ data }) => setEditUnits(data || []));
    }
  };

  useEffect(() => {
    if (editForm.municipality_id) {
      supabase.from("health_units").select("id, name").eq("municipality_id", editForm.municipality_id).eq("is_active", true).order("name")
        .then(({ data }) => setEditUnits(data || []));
    } else {
      setEditUnits([]);
    }
  }, [editForm.municipality_id]);

  const saveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    const { error } = await supabase.from("app_users").update({
      municipality_id: editForm.municipality_id || null,
      health_unit_id: editForm.health_unit_id || null,
      job_function_id: editForm.job_function_id || null,
      profile_id: editForm.profile_id || null,
    }).eq("id", editUser.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Usuário atualizado.");
    setEditUser(null);
    fetchUsers();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gestão de Usuários</CardTitle>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente_aprovacao">Pendentes</SelectItem>
            <SelectItem value="aprovado">Aprovados</SelectItem>
            <SelectItem value="bloqueado">Bloqueados</SelectItem>
            <SelectItem value="reprovado">Reprovados</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchUsers}>Tentar novamente</Button>
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhum usuário encontrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const st = statusLabels[u.status] || { label: u.status, variant: "outline" as const };
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nome_completo}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u.status === "pendente_aprovacao" && (
                          <>
                            <Button size="icon" variant="ghost" title="Aprovar" onClick={() => updateStatus(u, "aprovado", "aprovado", true)}><Check className="h-4 w-4 text-green-600" /></Button>
                            <Button size="icon" variant="ghost" title="Reprovar" onClick={() => updateStatus(u, "reprovado", "reprovado", false)}><X className="h-4 w-4 text-red-600" /></Button>
                          </>
                        )}
                        {u.status === "aprovado" && !u.is_master_admin && (
                          <Button size="icon" variant="ghost" title="Bloquear" onClick={() => updateStatus(u, "bloqueado", "bloqueado", false)}><Ban className="h-4 w-4" /></Button>
                        )}
                        {(u.status === "bloqueado" || u.status === "reprovado") && (
                          <Button size="icon" variant="ghost" title="Desbloquear" onClick={() => updateStatus(u, "desbloqueado", "aprovado", true)}><Unlock className="h-4 w-4" /></Button>
                        )}
                        {!u.is_master_admin && (
                          <>
                            <Button size="icon" variant="ghost" title="Resetar senha" onClick={() => resetPassword(u)}><KeyRound className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Município</Label>
                <Select value={editForm.municipality_id} onValueChange={(v) => setEditForm((f) => ({ ...f, municipality_id: v, health_unit_id: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{municipalities.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Unidade</Label>
                <Select value={editForm.health_unit_id} onValueChange={(v) => setEditForm((f) => ({ ...f, health_unit_id: v }))} disabled={!editForm.municipality_id}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{editUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Função</Label>
                <Select value={editForm.job_function_id} onValueChange={(v) => setEditForm((f) => ({ ...f, job_function_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{jobFunctions.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Perfil</Label>
                <Select value={editForm.profile_id} onValueChange={(v) => setEditForm((f) => ({ ...f, profile_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
              <Button onClick={saveEdit} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
