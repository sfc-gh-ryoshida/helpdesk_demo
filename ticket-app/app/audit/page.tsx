"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

interface AuditLog {
  id: number;
  ticket_id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  author: string;
  created_at: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [authors, setAuthors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (authorFilter !== "all") params.set("author", authorFilter);
      const res = await fetch(`/api/audit?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setAuthors(data.authors);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, authorFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">監査ログ</h1>
            <p className="text-sm text-muted-foreground">変更履歴・操作ログ</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          更新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="アクション" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全アクション</SelectItem>
                <SelectItem value="作成">作成</SelectItem>
                <SelectItem value="変更">変更</SelectItem>
              </SelectContent>
            </Select>
            <Select value={authorFilter} onValueChange={setAuthorFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="ユーザー" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全ユーザー</SelectItem>
                {authors.map((author) => (
                  <SelectItem key={author} value={author}>{author}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              監査ログがありません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日時</TableHead>
                  <TableHead>アクション</TableHead>
                  <TableHead>対象</TableHead>
                  <TableHead>変更内容</TableHead>
                  <TableHead>ユーザー</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.action === "作成" ? "default" : "secondary"}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{log.ticket_id}</span>
                    </TableCell>
                    <TableCell>
                      {log.field ? (
                        <span className="text-sm">
                          <span className="font-medium">{log.field}</span>:{" "}
                          <span className="line-through text-muted-foreground">{log.old_value || "null"}</span>
                          {" → "}
                          <span className="font-medium">{log.new_value}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{log.author}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>監査ログ詳細</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">日時</p>
                <p>{new Date(selectedLog.created_at).toLocaleString("ja-JP")}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">アクション</p>
                  <Badge variant={selectedLog.action === "作成" ? "default" : "secondary"}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">実行者</p>
                  <p className="font-medium">{selectedLog.author}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">対象チケット</p>
                <p className="font-mono text-sm">{selectedLog.ticket_id}</p>
              </div>
              {selectedLog.field && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground mb-2">変更内容</p>
                  <p className="text-sm"><span className="font-medium">{selectedLog.field}</span></p>
                  <p className="text-sm mt-1">
                    <span className="line-through text-muted-foreground">{selectedLog.old_value || "null"}</span>
                    {" → "}
                    <span className="font-medium text-green-500">{selectedLog.new_value}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
