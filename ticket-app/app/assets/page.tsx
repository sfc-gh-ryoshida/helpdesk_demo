"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Search, Plus, RefreshCw, Trash2, Edit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Asset {
  id: number;
  asset_id: string;
  asset_type: string;
  name: string;
  assignee: string | null;
  location: string | null;
  status: string;
}

interface Stats {
  total: number;
  byType: Record<string, number>;
  maintenance: number;
}

const ASSET_TYPES = ["ノートPC", "デスクトップPC", "モニター", "プリンター", "スマートフォン", "タブレット"];
const STATUSES = ["使用中", "修理中", "在庫", "共有", "廃棄予定"];

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, byType: {}, maintenance: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [formData, setFormData] = useState({
    asset_id: "",
    asset_type: "ノートPC",
    name: "",
    assignee: "",
    location: "",
    status: "使用中",
  });
  const [saving, setSaving] = useState(false);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/assets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch assets:", error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAssets();
  };

  const handleCreate = async () => {
    if (!formData.asset_id || !formData.name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsCreateOpen(false);
        setFormData({ asset_id: "", asset_type: "ノートPC", name: "", assignee: "", location: "", status: "使用中" });
        fetchAssets();
      }
    } catch (error) {
      console.error("Failed to create asset:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedAsset) return;
    setSaving(true);
    try {
      const res = await fetch("/api/assets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedAsset.id, ...formData }),
      });
      if (res.ok) {
        setSelectedAsset(null);
        setIsEditMode(false);
        fetchAssets();
      }
    } catch (error) {
      console.error("Failed to update asset:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/assets?id=${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteTarget(null);
        setSelectedAsset(null);
        fetchAssets();
      }
    } catch (error) {
      console.error("Failed to delete asset:", error);
    }
  };

  const openEditMode = () => {
    if (selectedAsset) {
      setFormData({
        asset_id: selectedAsset.asset_id,
        asset_type: selectedAsset.asset_type,
        name: selectedAsset.name,
        assignee: selectedAsset.assignee || "",
        location: selectedAsset.location || "",
        status: selectedAsset.status,
      });
      setIsEditMode(true);
    }
  };

  const openCreateDialog = () => {
    setFormData({ asset_id: "", asset_type: "ノートPC", name: "", assignee: "", location: "", status: "使用中" });
    setIsCreateOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      "使用中": "default",
      "修理中": "secondary",
      "廃棄予定": "destructive",
      "在庫": "outline",
      "共有": "outline",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">資産管理 (CMDB)</h1>
            <p className="text-sm text-muted-foreground">IT資産・構成アイテムの管理</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAssets} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            更新
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            資産を追加
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">総資産数</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{stats.total}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">ノートPC</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{stats.byType["ノートPC"] || 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">デスクトップPC</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{stats.byType["デスクトップPC"] || 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">修理中</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-yellow-600">{stats.maintenance}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <form onSubmit={handleSearch} className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="資産ID、名前、担当者で検索..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>資産ID</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>名前</TableHead>
                  <TableHead>担当者</TableHead>
                  <TableHead>場所</TableHead>
                  <TableHead>ステータス</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedAsset(asset)}>
                    <TableCell className="font-mono text-sm">{asset.asset_id}</TableCell>
                    <TableCell><Badge variant="outline">{asset.asset_type}</Badge></TableCell>
                    <TableCell>{asset.name}</TableCell>
                    <TableCell>{asset.assignee || "-"}</TableCell>
                    <TableCell>{asset.location || "-"}</TableCell>
                    <TableCell>{getStatusBadge(asset.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedAsset && !isEditMode} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>資産詳細</DialogTitle>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">資産ID</p>
                  <p className="font-mono">{selectedAsset.asset_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">種別</p>
                  <Badge variant="outline">{selectedAsset.asset_type}</Badge>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">名前</p>
                <p className="font-medium">{selectedAsset.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">担当者</p>
                  <p>{selectedAsset.assignee || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">場所</p>
                  <p>{selectedAsset.location || "-"}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ステータス</p>
                {getStatusBadge(selectedAsset.status)}
              </div>
            </div>
          )}
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={openEditMode}>
              <Edit className="w-4 h-4 mr-2" />
              編集
            </Button>
            <Button variant="destructive" onClick={() => setDeleteTarget(selectedAsset)}>
              <Trash2 className="w-4 h-4 mr-2" />
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新規資産登録</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>資産ID *</Label>
                <Input
                  value={formData.asset_id}
                  onChange={(e) => setFormData({ ...formData, asset_id: e.target.value })}
                  placeholder="DEV-0001"
                />
              </div>
              <div className="space-y-2">
                <Label>種別 *</Label>
                <Select value={formData.asset_type} onValueChange={(v) => setFormData({ ...formData, asset_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>名前 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ThinkPad X1 Carbon"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>担当者</Label>
                <Input
                  value={formData.assignee}
                  onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                  placeholder="山田太郎"
                />
              </div>
              <div className="space-y-2">
                <Label>場所</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="東京本社 3F"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ステータス</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>キャンセル</Button>
            <Button onClick={handleCreate} disabled={saving || !formData.asset_id || !formData.name}>
              {saving ? "保存中..." : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditMode} onOpenChange={(open) => !open && setIsEditMode(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>資産を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>資産ID</Label>
                <Input value={formData.asset_id} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>種別</Label>
                <Select value={formData.asset_type} onValueChange={(v) => setFormData({ ...formData, asset_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>名前</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>担当者</Label>
                <Input
                  value={formData.assignee}
                  onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>場所</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ステータス</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditMode(false)}>キャンセル</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "保存中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>資産を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」({deleteTarget?.asset_id}) を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
