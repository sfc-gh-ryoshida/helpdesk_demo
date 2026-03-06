"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Bot, User, Clock, FileText, Sparkles, Paperclip, Send, CheckCircle, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SLAIndicator } from "@/components/SLAIndicator";

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
  evaluation: string;
  evaluation_comment: string;
  created_at: string;
}

interface Comment {
  id: number;
  author: string;
  content: string;
  created_at: string;
}

interface HistoryItem {
  id: number;
  action: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  author: string;
  created_at: string;
}

interface SimilarItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  similarity: number;
  reranker_score: number;
}

interface TicketModalProps {
  ticket: Ticket;
  onClose: () => void;
  onUpdate: (ticketId: string, data: Partial<Ticket>) => Promise<void>;
}

const statusOptions = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "ESCALATED"];
const assigneeOptions = ["高橋美咲", "田中太郎", "佐藤花子"];

function getCategoryFromTicketId(ticketId: string): string {
  if (ticketId.startsWith("FIN-")) return "finance";
  if (ticketId.startsWith("HR-")) return "hr";
  return "it";
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    finance: "経理",
    hr: "人事",
    it: "IT",
  };
  return labels[category] || "IT";
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    finance: "bg-green-100 text-green-800 border-green-200",
    hr: "bg-purple-100 text-purple-800 border-purple-200",
    it: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return colors[category] || colors.it;
}

export function TicketModal({ ticket, onClose, onUpdate }: TicketModalProps) {
  const [status, setStatus] = useState(ticket.status);
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to || "none");
  const [notes, setNotes] = useState(ticket.resolution_notes || "");
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [similarItems, setSimilarItems] = useState<SimilarItem[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(true);
  const [similarCategory, setSimilarCategory] = useState(() => getCategoryFromTicketId(ticket.ticket_id));
  const [expandedSimilarId, setExpandedSimilarId] = useState<string | null>(null);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/tickets/${ticket.ticket_id}/comments`);
        if (res.ok) {
          const data = await res.json();
          setComments(data);
        }
      } catch (error) {
        console.error("Failed to fetch comments:", error);
      } finally {
        setLoadingComments(false);
      }
    };

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/tickets/${ticket.ticket_id}/history`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data);
        }
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchComments();
    fetchHistory();
  }, [ticket.ticket_id]);

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

  useEffect(() => {
    const fetchSimilar = async () => {
      setLoadingSimilar(true);
      try {
        const res = await fetch(
          `/api/similar?query=${encodeURIComponent(ticket.summary)}&category=${similarCategory}&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setSimilarItems(data);
        }
      } catch (error) {
        console.error("Failed to fetch similar items:", error);
      } finally {
        setLoadingSimilar(false);
      }
    };
    fetchSimilar();
  }, [ticket.summary, similarCategory]);

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

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const res = await fetch(`/api/tickets/${ticket.ticket_id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: "現在のユーザー", content: newComment }),
      });
      if (res.ok) {
        const created = await res.json();
        setComments([...comments, created]);
        setNewComment("");
      }
    } catch (error) {
      console.error("Failed to add comment:", error);
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

  const getLogIcon = (logType: string, evaluation?: string) => {
    if (logType === "EVALUATION") {
      if (evaluation === "resolved") {
        return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
      }
      return <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
    }
    if (logType === "AI_RESPONSE")
      return <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    return <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  };

  const getLogLabel = (logType: string, evaluation?: string) => {
    if (logType === "EVALUATION") {
      if (evaluation === "resolved") return "解決済み";
      if (evaluation === "escalate") return "エスカレーション";
      return "評価";
    }
    if (logType === "AI_RESPONSE") return "AIアシスタント";
    return "ユーザー";
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                {ticket.ticket_id}
              </span>
              <Badge variant={getUrgencyVariant(ticket.urgency)}>
                {ticket.urgency}
              </Badge>
            </DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground pt-1">{ticket.summary}</p>
          <div className="pt-2">
            <SLAIndicator
              createdAt={ticket.created_at}
              urgency={ticket.urgency}
              status={ticket.status}
            />
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details">詳細</TabsTrigger>
            <TabsTrigger value="comments">
              コメント
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {comments.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="history">履歴</TabsTrigger>
            <TabsTrigger value="conversation">会話</TabsTrigger>
            <TabsTrigger value="similar">
              <Sparkles className="w-3 h-3 mr-1" />
              類似
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">報告者</label>
                <p className="text-sm">{ticket.reporter_name || "不明"}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">場所</label>
                <p className="text-sm">{ticket.location || "不明"}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">種別</label>
                <Badge variant="outline">{ticket.issue_type}</Badge>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">チャネル</label>
                <p className="text-sm">{ticket.source_channel}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">作成日時</label>
                <p className="text-sm">{new Date(ticket.created_at).toLocaleString("ja-JP")}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">ステータス</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
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
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Paperclip className="w-4 h-4" />
                  添付ファイル
                </label>
                <div className="border border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground">
                  ファイルをドラッグ＆ドロップ または クリックして選択
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="comments" className="mt-4 space-y-4">
            {loadingComments ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-3">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center bg-muted/50 rounded-lg">
                コメントはありません
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto">
                {comments.map((comment) => (
                  <Card key={comment.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{comment.author}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleString("ja-JP")}
                        </span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="コメントを入力..."
                rows={2}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button onClick={handleAddComment} size="icon" className="h-auto">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {loadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Skeleton className="w-4 h-4" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center bg-muted/50 rounded-lg">
                履歴はありません
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {history.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="mt-0.5">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.author}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleString("ja-JP")}
                        </span>
                      </div>
                      {item.action === "作成" ? (
                        <p className="text-sm text-muted-foreground">チケットを作成</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">{item.field}</span>を
                          <span className="line-through mx-1">{item.old_value}</span>
                          から
                          <span className="font-medium ml-1">{item.new_value}</span>
                          に変更
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="conversation" className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Slack会話履歴</span>
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
                      log.log_type === "EVALUATION" && log.evaluation === "resolved"
                        ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                        : log.log_type === "EVALUATION"
                        ? "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800"
                        : log.log_type === "AI_RESPONSE"
                        ? "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800"
                        : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getLogIcon(log.log_type, log.evaluation)}
                      <span className="text-xs font-medium">
                        {getLogLabel(log.log_type, log.evaluation)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(log.created_at).toLocaleString("ja-JP")}
                      </span>
                    </div>
                    {log.log_type === "EVALUATION" ? (
                      <div>
                        <p className="text-sm font-medium">
                          {log.evaluation === "resolved" ? "✅ 解決済みが選択されました" : "🚨 エスカレーションが選択されました"}
                        </p>
                        {log.evaluation_comment && (
                          <p className="text-sm mt-1 text-muted-foreground">
                            コメント: {log.evaluation_comment}
                          </p>
                        )}
                      </div>
                    ) : log.log_type === "AI_RESPONSE" ? (
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

          <TabsContent value="similar" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">ナレッジベース検索</span>
              </div>
              <div className="flex gap-1">
                {["it", "finance", "hr"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSimilarCategory(cat)}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md border transition-colors",
                      similarCategory === cat
                        ? getCategoryColor(cat)
                        : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                    )}
                  >
                    {getCategoryLabel(cat)}
                  </button>
                ))}
              </div>
            </div>
            {loadingSimilar ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : similarItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                類似するナレッジが見つかりませんでした
              </p>
            ) : (
              <div className="space-y-3">
                {similarItems.map((item) => (
                  <Card 
                    key={item.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedSimilarId(expandedSimilarId === item.id ? null : item.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(item.similarity * 100)}% 類似
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{item.question}</p>
                      {expandedSimilarId === item.id ? (
                        <div className="mt-2 p-3 bg-muted/50 rounded-md">
                          <p className="text-xs font-medium text-muted-foreground mb-1">回答:</p>
                          <p className="text-sm whitespace-pre-wrap">{item.answer}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {item.answer}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {item.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {expandedSimilarId === item.id ? "クリックで閉じる" : "クリックで詳細"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3 text-center">
              ※ Cortex Search による類似度検索結果
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button variant="secondary" onClick={async () => {
            setSaving(true);
            try {
              await onUpdate(ticket.ticket_id, {
                status: "ESCALATED",
                assigned_to: assignedTo === "none" ? "" : assignedTo,
                resolution_notes: notes,
              });
            } finally {
              setSaving(false);
            }
          }} disabled={saving}>
            エスカレーション
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
