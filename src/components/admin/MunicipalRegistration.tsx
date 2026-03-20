import { ChangeEvent, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Upload } from "lucide-react";

interface Item { id: string; name: string; code?: string | null; is_active: boolean; municipality_id?: string; }



function CrudTab({ table, label, hasMunicipality = false, hasCode = true }: { table: string; label: string; hasMunicipality?: boolean; hasCode?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [municipalityId, setMunicipalityId] = useState("");
  const [municipalities, setMunicipalities] = useState<{ id: string; name: string }[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterMunicipality, setFilterMunicipality] = useState("all");

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase.from(table as any).select("*").order("name");
      if (hasMunicipality && filterMunicipality !== "all") q = q.eq("municipality_id", filterMunicipality);
      const { data, error: queryError } = await q as any;
      if (queryError) throw new Error(queryError.message);
      setItems((data as Item[]) || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [filterMunicipality]);

  useEffect(() => {
    if (hasMunicipality) {
      supabase.from("municipalities").select("id, name").eq("is_active", true).order("name").then(({ data }) => setMunicipalities(data || []));
    }
  }, [hasMunicipality]);

  const openNew = () => { setEditItem(null); setName(""); setCode(""); setMunicipalityId(""); setIsActive(true); setDialogOpen(true); };
  const openEdit = (item: Item) => { setEditItem(item); setName(item.name); setCode(item.code || ""); setMunicipalityId(item.municipality_id || ""); setIsActive(item.is_active); setDialogOpen(true); };

  const save = async () => {
    if (!name.trim()) { toast.error("Nome é obrigatório."); return; }
    setSaving(true);
    const payload: any = { name: name.trim(), is_active: isActive };
    if (hasCode) payload.code = code.trim() || null;
    if (hasMunicipality) payload.municipality_id = municipalityId || null;

    if (editItem) {
      const { error } = await supabase.from(table as any).update(payload).eq("id", editItem.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success(`${label} atualizado.`);
    } else {
      const { error } = await supabase.from(table as any).insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success(`${label} cadastrado.`);
    }
    setSaving(false);
    setDialogOpen(false);
    fetchItems();
  };

  const deleteItem = async (item: Item) => {
    const { error } = await supabase.from(table as any).delete().eq("id", item.id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success(`${label} excluído permanentemente.`);
    fetchItems();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasMunicipality && (
            <Select value={filterMunicipality} onValueChange={setFilterMunicipality}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Filtrar município" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {municipalities.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={fetchItems}>Tentar novamente</Button>
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Nenhum registro encontrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              {hasCode && <TableHead>Código</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                {hasCode && <TableCell>{item.code || "—"}</TableCell>}
                <TableCell><Badge variant={item.is_active ? "default" : "secondary"}>{item.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteItem(item)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? `Editar ${label}` : `Novo ${label}`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {hasCode && (
              <div className="space-y-1">
                <Label>Código</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
            )}
            {hasMunicipality && (
              <div className="space-y-1">
                <Label>Município *</Label>
                <Select value={municipalityId} onValueChange={setMunicipalityId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{municipalities.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="is_active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <Label htmlFor="is_active" className="cursor-pointer">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HealthUnitsTab() {
  const [municipalities, setMunicipalities] = useState<{ id: string; name: string }[]>([]);
  const [uploadMunId, setUploadMunId] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    supabase.from("municipalities").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setMunicipalities(data || []));
  }, []);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!uploadMunId) { toast.error("Selecione o município antes de importar."); return; }

    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // Use header:1 to treat all rows as data (including header row)
      const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
      if (!allRows.length) { toast.error("Planilha vazia."); setUploading(false); return; }

      // Skip header row if it contains known header text or just skip row 0
      const dataRows = allRows.slice(1);
      if (!dataRows.length) { toast.error("Planilha sem dados após o cabeçalho."); setUploading(false); return; }

      const names = [...new Set(
        dataRows.map(r => String((r as unknown[])[0] ?? "").trim()).filter(n => n && n.toLowerCase() !== "nome" && n.toLowerCase() !== "unidade")
      )];
      if (!names.length) { toast.error("Nenhuma unidade encontrada."); setUploading(false); return; }

      // Check existing
      const { data: existing } = await supabase
        .from("health_units")
        .select("name")
        .eq("municipality_id", uploadMunId) as any;
      const existingSet = new Set(
        ((existing as { name: string }[]) || []).map(n => n.name.toLowerCase().trim())
      );
      const newNames = names.filter(n => !existingSet.has(n.toLowerCase().trim()));

      if (!newNames.length) {
        toast.info("Todas as unidades da planilha já estão cadastradas neste município.");
        setUploading(false);
        return;
      }

      const { error } = await supabase
        .from("health_units")
        .insert(newNames.map(name => ({ name, municipality_id: uploadMunId }))) as any;
      if (error) { toast.error("Erro ao importar: " + error.message); setUploading(false); return; }

      toast.success(`${newNames.length} unidade(s) importada(s) com sucesso.`);
      setRefreshKey(k => k + 1);
    } catch {
      toast.error("Erro ao ler planilha.");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="space-y-1">
          <Label className="text-xs">Município para importação</Label>
          <Select value={uploadMunId} onValueChange={setUploadMunId}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Selecione o município" /></SelectTrigger>
            <SelectContent>
              {municipalities.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="inline-flex cursor-pointer">
          <Button size="sm" variant="outline" disabled={uploading || !uploadMunId} asChild>
            <span>{uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}Importar Planilha</span>
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={uploading || !uploadMunId} />
        </label>
        <p className="text-xs text-muted-foreground">A primeira coluna da planilha será usada como nome da unidade.</p>
      </div>
      <CrudTab key={refreshKey} table="health_units" label="Unidade" hasMunicipality />
    </div>
  );
}


export function MunicipalRegistration() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cadastro Municipal</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="municipios">
          <TabsList className="mb-4">
            <TabsTrigger value="municipios">Municípios</TabsTrigger>
            <TabsTrigger value="unidades">Unidades de Saúde</TabsTrigger>
            <TabsTrigger value="funcoes">Funções</TabsTrigger>
          </TabsList>
          <TabsContent value="municipios"><CrudTab table="municipalities" label="Município" /></TabsContent>
          <TabsContent value="unidades">
            <HealthUnitsTab />
          </TabsContent>
          <TabsContent value="funcoes"><CrudTab table="job_functions" label="Função" hasCode={false} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
