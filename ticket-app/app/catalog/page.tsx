"use client";

import { useState, useEffect } from "react";
import { ShoppingCart, Search, Laptop, Key, Wifi, HelpCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CatalogItem {
  id: number;
  title: string;
  description: string | null;
  category: string;
  icon: string | null;
  sla_hours: number;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Laptop,
  Key,
  Wifi,
  HelpCircle,
};

function formatSla(hours: number): string {
  if (hours < 24) return `${hours}時間`;
  return `${Math.round(hours / 24)}営業日`;
}

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/catalog");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error("Failed to fetch catalog:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">サービスカタログ</h1>
            <p className="text-sm text-muted-foreground">定型リクエストの申請</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCatalog} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          更新
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="サービスを検索..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-6 w-24 mt-2" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {filteredItems.map((item) => {
            const IconComponent = iconMap[item.icon || "HelpCircle"] || HelpCircle;
            return (
              <Card key={item.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelectedItem(item)}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="outline">{formatSla(item.sla_hours)}</Badge>
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">申請する</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedItem?.title}</DialogTitle>
            <DialogDescription>{selectedItem?.description}</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">カテゴリ</p>
                  <Badge variant="outline">{selectedItem.category}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">SLA</p>
                  <p className="font-medium">{formatSla(selectedItem.sla_hours)}</p>
                </div>
              </div>
              <Button className="w-full" onClick={() => setSelectedItem(null)}>申請する</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
