"use client";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle, CheckCircle } from "lucide-react";

interface SLAIndicatorProps {
  createdAt: string;
  urgency: string;
  status: string;
  className?: string;
}

const SLA_HOURS: Record<string, number> = {
  HIGH: 2,
  MEDIUM: 8,
  LOW: 24,
};

export function SLAIndicator({ createdAt, urgency, status, className }: SLAIndicatorProps) {
  if (status === "RESOLVED" || status === "CLOSED") {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-green-600", className)}>
        <CheckCircle className="h-4 w-4" />
        <span>完了</span>
      </div>
    );
  }

  const created = new Date(createdAt);
  const now = new Date();
  const slaHours = SLA_HOURS[urgency] || 8;
  const deadline = new Date(created.getTime() + slaHours * 60 * 60 * 1000);
  const totalMs = slaHours * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - created.getTime();
  const remainingMs = deadline.getTime() - now.getTime();
  const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const progress = Math.min(100, (elapsedMs / totalMs) * 100);
  const isOverdue = remainingMs < 0;
  const isWarning = remainingMs > 0 && remainingMs < totalMs * 0.25;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1">
          {isOverdue ? (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          ) : isWarning ? (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
          <span className={cn(
            isOverdue && "text-red-500 font-medium",
            isWarning && "text-yellow-600 font-medium"
          )}>
            {isOverdue
              ? `SLA超過 ${Math.abs(remainingHours)}h${Math.abs(remainingMinutes)}m`
              : `残り ${remainingHours}h${remainingMinutes}m`}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          SLA: {slaHours}時間
        </span>
      </div>
      <Progress
        value={isOverdue ? 100 : progress}
        className={cn(
          "h-2",
          isOverdue && "[&>div]:bg-red-500",
          isWarning && "[&>div]:bg-yellow-500"
        )}
      />
    </div>
  );
}

export function SLABadge({ createdAt, urgency, status }: SLAIndicatorProps) {
  if (status === "RESOLVED" || status === "CLOSED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
        <CheckCircle className="h-3 w-3" />
        完了
      </span>
    );
  }

  const created = new Date(createdAt);
  const now = new Date();
  const slaHours = SLA_HOURS[urgency] || 8;
  const deadline = new Date(created.getTime() + slaHours * 60 * 60 * 1000);
  const remainingMs = deadline.getTime() - now.getTime();
  const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const isOverdue = remainingMs < 0;
  const isWarning = remainingMs > 0 && remainingMs < slaHours * 60 * 60 * 1000 * 0.25;

  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
        <AlertTriangle className="h-3 w-3" />
        超過
      </span>
    );
  }

  if (isWarning) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
        <Clock className="h-3 w-3" />
        {remainingHours}h{remainingMinutes}m
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      <Clock className="h-3 w-3" />
      {remainingHours}h{remainingMinutes}m
    </span>
  );
}
