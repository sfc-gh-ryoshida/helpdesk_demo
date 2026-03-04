"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  MessageSquare,
  Bot,
  ThumbsUp,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface Log {
  id: number;
  log_type: string;
  inquiry_id: number | null;
  user_id: string;
  channel_id: string;
  thread_ts: string;
  message: string;
  category: string;
  priority: string;
  summary: string;
  ai_response: string;
  ai_response_text: string;
  evaluation: string;
  evaluation_comment: string;
  status: string;
  created_at: string;
  resolved_at: string;
}

interface ThreadGroup {
  thread_ts: string;
  logs: Log[];
  first_message: string;
  created_at: string;
  has_evaluation: boolean;
  evaluation_result: string | null;
  status: string | null;
}

const AUTO_REFRESH_INTERVAL = 30000;

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async (showToast = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      setLogs(data);
      if (showToast) toast.success("データを更新しました");
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      toast.error("ログの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchLogs(false);
    }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const groupByThread = (logs: Log[]): ThreadGroup[] => {
    const groups: { [key: string]: Log[] } = {};

    logs.forEach((log) => {
      const key = log.thread_ts || `no-thread-${log.id}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(log);
    });

    return Object.entries(groups)
      .map(([thread_ts, threadLogs]) => {
        const sortedLogs = threadLogs.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const inquiry = sortedLogs.find((l) => l.log_type === "INQUIRY");
        const evaluation = sortedLogs.find((l) => l.log_type === "EVALUATION");
        const latestLog = sortedLogs[sortedLogs.length - 1];

        return {
          thread_ts,
          logs: sortedLogs,
          first_message: inquiry?.message || sortedLogs[0]?.message || "-",
          created_at: sortedLogs[0]?.created_at || "",
          has_evaluation: !!evaluation,
          evaluation_result: evaluation?.evaluation || null,
          status: latestLog?.status || null,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  };

  const toggleThread = (thread_ts: string) => {
    const newExpanded = new Set(expandedThreads);
    if (newExpanded.has(thread_ts)) {
      newExpanded.delete(thread_ts);
    } else {
      newExpanded.add(thread_ts);
    }
    setExpandedThreads(newExpanded);
  };

  const getLogTypeIcon = (logType: string) => {
    switch (logType) {
      case "INQUIRY":
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case "AI_RESPONSE":
        return <Bot className="w-4 h-4 text-purple-500" />;
      case "EVALUATION":
        return <ThumbsUp className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getEvaluationBadge = (evaluation: string | null) => {
    if (!evaluation)
      return (
        <span className="text-sm text-muted-foreground font-medium">未評価</span>
      );
    switch (evaluation) {
      case "helpful":
      case "resolved":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            ✅ 解決
          </Badge>
        );
      case "not_helpful":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
            👎 未解決
          </Badge>
        );
      case "escalate":
        return <Badge variant="destructive">🚨 エスカレ</Badge>;
      default:
        return <Badge variant="outline">{evaluation}</Badge>;
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    switch (status) {
      case "OPEN":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            OPEN
          </Badge>
        );
      case "IN_PROGRESS":
        return <Badge variant="secondary">対応中</Badge>;
      case "RESOLVED":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            解決済
          </Badge>
        );
      case "ESCALATED":
        return <Badge variant="destructive">エスカレ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const threadGroups = groupByThread(logs);

  const stats = {
    threads: threadGroups.length,
    resolved: threadGroups.filter(
      (t) => t.evaluation_result === "helpful" || t.evaluation_result === "resolved"
    ).length,
    escalated: threadGroups.filter((t) => t.evaluation_result === "escalate")
      .length,
    pending: threadGroups.filter((t) => !t.has_evaluation).length,
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="p-2 rounded-lg bg-primary/10">
              <Ticket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">対話ログ</h1>
              <p className="text-xs text-muted-foreground">
                スレッド単位の問い合わせ履歴
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                総スレッド
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold">{stats.threads}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                解決済み
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                エスカレ
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-red-600">{stats.escalated}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                評価待ち
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">スレッド一覧</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLogs(true)}
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                更新
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <Skeleton className="w-5 h-5" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))
              ) : threadGroups.length === 0 ? (
                <div className="px-4 py-12 text-center text-muted-foreground">
                  ログがありません
                </div>
              ) : (
                threadGroups.map((thread) => (
                  <div key={thread.thread_ts} className="hover:bg-muted/50">
                    <div
                      onClick={() => toggleThread(thread.thread_ts)}
                      className="px-4 py-3 cursor-pointer flex items-center gap-3"
                    >
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {expandedThreads.has(thread.thread_ts) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{thread.first_message}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(thread.created_at).toLocaleString("ja-JP")} ·{" "}
                          {thread.logs.length}件
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {getStatusBadge(thread.status)}
                        {getEvaluationBadge(thread.evaluation_result)}
                      </div>
                    </div>

                    {expandedThreads.has(thread.thread_ts) && (
                      <div className="bg-muted/30 px-4 py-3 ml-8 border-l-2 border-border">
                        {thread.logs.map((log) => (
                          <div key={log.id} className="py-2 flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getLogTypeIcon(log.log_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">
                                  {log.log_type}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(log.created_at).toLocaleTimeString(
                                    "ja-JP"
                                  )}
                                </span>
                              </div>
                              {log.log_type === "INQUIRY" && (
                                <p className="text-sm">{log.message}</p>
                              )}
                              {log.log_type === "AI_RESPONSE" && (
                                <div>
                                  <p className="text-sm text-muted-foreground">
                                    <span className="font-medium">カテゴリ:</span>{" "}
                                    {log.category} ·
                                    <span className="font-medium"> 優先度:</span>{" "}
                                    {log.priority}
                                  </p>
                                  <p className="text-sm mt-1 font-medium">
                                    {log.summary}
                                  </p>
                                  {log.ai_response_text && (
                                    <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                                      <p className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">
                                        💬 AIの回答:
                                      </p>
                                      <p className="text-sm whitespace-pre-wrap">
                                        {log.ai_response_text}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {log.log_type === "EVALUATION" && (
                                <div className="flex items-center gap-2">
                                  {getEvaluationBadge(log.evaluation)}
                                  {log.evaluation_comment && (
                                    <span className="text-sm">
                                      &quot;{log.evaluation_comment}&quot;
                                    </span>
                                  )}
                                </div>
                              )}
                              {log.log_type === "INFO_RECEIVED" && log.message && (
                                <p className="text-sm">{log.message}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
