"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, Search, Plus, RefreshCw, Eye, Trash2, Edit } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

interface KnowledgeArticle {
  id: number;
  title: string;
  content: string | null;
  category: string;
  tags: string | null;
  views: number;
  author: string | null;
  created_at: string;
}

const CATEGORIES = ["HARDWARE", "SOFTWARE", "ACCOUNT", "NETWORK", "OTHER"];
const CATEGORY_LABELS: Record<string, string> = {
  HARDWARE: "ハードウェア",
  SOFTWARE: "ソフトウェア",
  ACCOUNT: "アカウント",
  NETWORK: "ネットワーク",
  OTHER: "その他",
};

export default function KnowledgePage() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeArticle | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "FAQ",
    tags: "",
    author: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter && categoryFilter !== "ALL") params.set("category", categoryFilter);
      const res = await fetch(`/api/knowledge?${params}`);
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      }
    } catch (error) {
      console.error("Failed to fetch knowledge:", error);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchArticles();
  };

  const incrementViews = async (article: KnowledgeArticle) => {
    try {
      await fetch(`/api/knowledge/${article.id}/view`, { method: "POST" });
    } catch (error) {
      console.error("Failed to increment views:", error);
    }
  };

  const handleArticleClick = (article: KnowledgeArticle) => {
    setSelectedArticle(article);
    setIsEditMode(false);
    incrementViews(article);
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.category) return;
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsCreateOpen(false);
        setFormData({ title: "", content: "", category: "HARDWARE", tags: "", author: "" });
        fetchArticles();
      }
    } catch (error) {
      console.error("Failed to create article:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedArticle || !formData.title) return;
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedArticle.id, ...formData }),
      });
      if (res.ok) {
        setSelectedArticle(null);
        setIsEditMode(false);
        fetchArticles();
      }
    } catch (error) {
      console.error("Failed to update article:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/knowledge?id=${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteTarget(null);
        setSelectedArticle(null);
        fetchArticles();
      }
    } catch (error) {
      console.error("Failed to delete article:", error);
    }
  };

  const openEditMode = () => {
    if (selectedArticle) {
      setFormData({
        title: selectedArticle.title,
        content: selectedArticle.content || "",
        category: selectedArticle.category,
        tags: selectedArticle.tags || "",
        author: selectedArticle.author || "",
      });
      setIsEditMode(true);
    }
  };

  const openCreateDialog = () => {
    setFormData({ title: "", content: "", category: "HARDWARE", tags: "", author: "" });
    setIsCreateOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">ナレッジベース</h1>
            <p className="text-sm text-muted-foreground">解決策・手順書の管理</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchArticles} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            更新
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            記事を追加
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <form onSubmit={handleSearch} className="relative max-w-md flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ナレッジを検索..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        <div className="flex gap-2 flex-wrap">
          <Badge
            variant={categoryFilter === "ALL" ? "default" : "outline"}
            className="cursor-pointer hover:bg-primary/80 transition-colors"
            onClick={() => setCategoryFilter("ALL")}
          >
            すべて
          </Badge>
          {CATEGORIES.map((cat) => (
            <Badge
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/80 transition-colors"
              onClick={() => setCategoryFilter(cat)}
            >
              {CATEGORY_LABELS[cat] || cat}
            </Badge>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          ナレッジ記事がありません
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {articles.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleArticleClick(item)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{CATEGORY_LABELS[item.category] || item.category}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {item.views}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{item.title}</p>
                {item.author && (
                  <p className="text-xs text-muted-foreground mt-1">by {item.author}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedArticle && !isEditMode} onOpenChange={(open) => !open && setSelectedArticle(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{CATEGORY_LABELS[selectedArticle.category] || selectedArticle.category}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {selectedArticle.views} views
                  </span>
                </div>
                <DialogTitle className="text-xl">{selectedArticle.title}</DialogTitle>
                {selectedArticle.author && (
                  <p className="text-sm text-muted-foreground">
                    作成者: {selectedArticle.author}
                  </p>
                )}
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-sm text-muted-foreground">内容</h3>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {selectedArticle.content || "内容がありません"}
                  </div>
                </div>
                {selectedArticle.tags && (
                  <div className="flex gap-1 flex-wrap">
                    {selectedArticle.tags.split(",").map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{tag.trim()}</Badge>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  作成日: {new Date(selectedArticle.created_at).toLocaleDateString("ja-JP")}
                </div>
              </div>
              <DialogFooter className="mt-4 gap-2">
                <Button variant="outline" onClick={openEditMode}>
                  <Edit className="w-4 h-4 mr-2" />
                  編集
                </Button>
                <Button variant="destructive" onClick={() => setDeleteTarget(selectedArticle)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  削除
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新規ナレッジ記事</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>タイトル *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="記事のタイトル"
              />
            </div>
            <div className="space-y-2">
              <Label>カテゴリ *</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="記事の内容..."
                rows={6}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>タグ (カンマ区切り)</Label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="VPN, ネットワーク"
                />
              </div>
              <div className="space-y-2">
                <Label>作成者</Label>
                <Input
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  placeholder="山田太郎"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>キャンセル</Button>
            <Button onClick={handleCreate} disabled={saving || !formData.title}>
              {saving ? "保存中..." : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditMode} onOpenChange={(open) => !open && setIsEditMode(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ナレッジ記事を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>タイトル *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>カテゴリ *</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label>タグ (カンマ区切り)</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditMode(false)}>キャンセル</Button>
            <Button onClick={handleUpdate} disabled={saving || !formData.title}>
              {saving ? "保存中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>記事を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.title}」を削除します。この操作は取り消せません。
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
