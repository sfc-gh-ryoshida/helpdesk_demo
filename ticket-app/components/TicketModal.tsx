"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Bot, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Ticket {
  ticket_id: string;
  reporter_name: string;
  location: string;
  issue_type: string;
  urgency: string;
  summary: string;
  status: string;
  assigned_to: string;
  resolution_notes: string;
  source_channel: string;
  created_at: string;
  thread_ts?: string;
}

interface Log {
  id: number;
  log_type: string;
  message: string;
  ai_response_text: string;
  summary: string;
  category: string;
  priority: string;
  created_at: string;
}

interface TicketModalProps {
  ticket: Ticket;
  onClose: () => void;
  onUpdate: (ticketId: string, data: Partial<Ticket>) => Promise<void>;
}

const statusOptions = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "ESCALATED"];
const assigneeOptions = ["高橋美咲", "田中太郎", "佐藤花子"];

export function TicketModal({ ticket, onClose, onUpdate }: TicketModalProps) {
  const [status, setStatus] = useState(ticket.status);
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to || "none");
  const [notes, setNotes] = useState(ticket.resolution_notes || "");
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!ticket.thread_ts) {
        setLoadingLogs(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/logs?thread_ts=${encodeURIComponent(ticket.thread_ts)}`
        );
        if (res.ok) {
          const data = await res.json();
          setLogs(data);
        }
      } catch (error) {
        console.error("Failed to fetch logs:", error);
      } finally {
        setLoadingLogs(false);
      }
    };
    fetchLogs();
  }, [ticket.thread_ts]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(ticket.ticket_id, {
        status,
        assigned_to: assignedTo === "none" ? "" : assignedTo,
        resolution_notes: notes,
      });
    } finally {
      setSaving(false);
    }
  };

  const getUrgencyVariant = (
    urgency: string
  ): "default" | "destructive" | "secondary" | "outline" => {
    switch (urgency?.toUpperCase()) {
      case "HIGH":
        return "destructive";
      case "MEDIUM":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getLogIcon = (logType: string) => {
    if (logType === "AI_RESPONSE")
      return <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    return <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
              {ticket.ticket_id}
            </span>
            <Badge variant={getUrgencyVariant(ticket.urgency)}>
              {ticket.urgency}
            </Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">{ticket.summary}</p>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">詳細</TabsTrigger>
            <TabsTrigger value="history">会話履歴</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">
                  報告者
                </label>
                <p className="text-sm">{ticket.reporter_name || "不明"}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">
                  場所
                </label>
                <p className="text-sm">{ticket.location || "不明"}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">
                  種別
                </label>
                <Badge variant="outline">{ticket.issue_type}</Badge>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">
                  チャネル
                </label>
                <p className="text-sm">{ticket.source_channel}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">
                  作成日時
                </label>
                <p className="text-sm">
                  {new Date(ticket.created_at).toLocaleString("ja-JP")}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">ステータス</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">担当者</label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="未アサイン" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未アサイン</SelectItem>
                    {assigneeOptions.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">対応メモ</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="対応内容を記録..."
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">会話履歴</span>
            </div>

            {loadingLogs ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Skeleton className="w-4 h-4 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4 mt-1" />
                  </div>
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center bg-muted/50 rounded-lg">
                会話履歴がありません
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "p-3 rounded-lg border",
                      log.log_type === "AI_RESPONSE"
                        ? "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800"
                        : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getLogIcon(log.log_type)}
                      <span className="text-xs font-medium">
                        {log.log_type === "AI_RESPONSE"
                          ? "AIアシスタント"
                          : "ユーザー"}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(log.created_at).toLocaleString("ja-JP")}
                      </span>
                    </div>

                    {log.log_type === "AI_RESPONSE" ? (
                      <div>
                        <p className="text-sm font-medium">{log.summary}</p>
                        {log.ai_response_text && (
                          <p className="text-sm mt-2 whitespace-pre-wrap text-muted-foreground">
                            {log.ai_response_text}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{log.message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
