"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Search,
  AlertCircle,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketModal } from "@/components/TicketModal";
import { SLABadge } from "@/components/SLAIndicator";

export interface TicketType {
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

interface TicketListProps {
  apiEndpoint: string;
  title: string;
  accentColor: "blue" | "green" | "purple";
}

const PAGE_SIZE = 10;
const AUTO_REFRESH_INTERVAL = 30000;

export function TicketList({ apiEndpoint, title, accentColor }: TicketListProps) {
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const accentColors = {
    blue: { stat: "text-blue-600", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
    green: { stat: "text-green-600", badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
    purple: { stat: "text-purple-600", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  };

  const fetchTickets = useCallback(async (showToast = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (urgencyFilter && urgencyFilter !== "all") params.set("urgency", urgencyFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", String(currentPage));
      params.set("limit", String(PAGE_SIZE));

      const res = await fetch(`${apiEndpoint}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch tickets");
      const data = await res.json();
      setTickets(data.tickets || data);
      setTotalCount(data.total || data.length);
      if (showToast) toast.success("データを更新しました");
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
      toast.error("チケットの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, statusFilter, urgencyFilter, searchQuery, currentPage]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    const interval = setInterval(() => fetchTickets(false), AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, urgencyFilter, searchQuery]);

  const handleUpdateTicket = async (ticketId: string, data: Partial<TicketType>) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("チケットを更新しました");
      await fetchTickets();
      setSelectedTicket(null);
    } catch (error) {
      console.error("Failed to update:", error);
      toast.error("チケットの更新に失敗しました");
      throw error;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "OPEN": return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case "HUMAN_REQUESTED": return <UserCircle className="w-4 h-4 text-yellow-500" />;
      case "IN_PROGRESS": return <Clock className="w-4 h-4 text-yellow-500" />;
      case "RESOLVED":
      case "CLOSED": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "ESCALATED": return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getUrgencyVariant = (urgency: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (urgency?.toUpperCase()) {
      case "HIGH": return "destructive";
      case "MEDIUM": return "secondary";
      default: return "outline";
    }
  };

  const activeTickets = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS" || t.status === "HUMAN_REQUESTED");
  const stats = {
    total: totalCount || tickets.length,
    open: activeTickets.filter((t) => t.status === "OPEN" || t.status === "HUMAN_REQUESTED").length,
    inProgress: activeTickets.filter((t) => t.status === "IN_PROGRESS").length,
    highUrgency: activeTickets.filter((t) => t.urgency === "HIGH").length,
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        <Badge className={accentColors[accentColor].badge}>
          {title.includes("人事") ? "HR" : title.includes("経理") ? "Finance" : "IT"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">総チケット</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{stats.total}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">未対応</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <p className={`text-2xl font-bold ${accentColors[accentColor].stat}`}>{stats.open}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">対応中</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">高緊急度</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-red-600">{stats.highUrgency}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-[200px]" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="ステータス" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全ステータス</SelectItem>
                  <SelectItem value="OPEN">OPEN</SelectItem>
                  <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                  <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                  <SelectItem value="CLOSED">CLOSED</SelectItem>
                  <SelectItem value="ESCALATED">ESCALATED</SelectItem>
                  <SelectItem value="HUMAN_REQUESTED">HUMAN_REQUESTED</SelectItem>
                </SelectContent>
              </Select>
              <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="緊急度" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全緊急度</SelectItem>
                  <SelectItem value="HIGH">HIGH</SelectItem>
                  <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                  <SelectItem value="LOW">LOW</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchTickets(true)} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />更新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>報告者</TableHead>
                  <TableHead>場所</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>緊急度</TableHead>
                  <TableHead className="min-w-[200px]">要約</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>担当者</TableHead>
                  <TableHead>作成日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : tickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">チケットがありません</TableCell>
                  </TableRow>
                ) : (
                  tickets.map((ticket) => (
                    <TableRow key={ticket.ticket_id} onClick={() => setSelectedTicket(ticket)} className="cursor-pointer">
                      <TableCell className="font-mono text-xs">{ticket.ticket_id}</TableCell>
                      <TableCell>{ticket.reporter_name || "-"}</TableCell>
                      <TableCell>{ticket.location || "-"}</TableCell>
                      <TableCell><Badge variant="outline">{ticket.issue_type}</Badge></TableCell>
                      <TableCell><Badge variant={getUrgencyVariant(ticket.urgency)}>{ticket.urgency}</Badge></TableCell>
                      <TableCell className="max-w-[200px] truncate">{ticket.summary}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(ticket.status)}
                          <span className="text-sm">{ticket.status === "HUMAN_REQUESTED" ? "OPEN" : ticket.status}</span>
                        </div>
                      </TableCell>
                      <TableCell><SLABadge createdAt={ticket.created_at} urgency={ticket.urgency} status={ticket.status} /></TableCell>
                      <TableCell>{ticket.assigned_to || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(ticket.created_at).toLocaleDateString("ja-JP")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                {totalCount}件中 {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)}件
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">{currentPage} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTicket && (
        <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onUpdate={handleUpdateTicket} />
      )}
    </div>
  );
}
