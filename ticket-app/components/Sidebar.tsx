"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Ticket,
  BarChart3,
  MessageSquare,
  BookOpen,
  Package,
  ShoppingCart,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";

const mainNavItems = [
  { href: "/", icon: Ticket, label: "チケット" },
  { href: "/analytics", icon: BarChart3, label: "分析" },
  { href: "/logs", icon: MessageSquare, label: "ログ" },
];

const itsmNavItems = [
  { href: "/knowledge", icon: BookOpen, label: "ナレッジ", badge: "NEW" },
  { href: "/assets", icon: Package, label: "資産", badge: "NEW" },
  { href: "/catalog", icon: ShoppingCart, label: "カタログ", badge: "NEW" },
];

const adminNavItems = [
  { href: "/settings", icon: Settings, label: "設定" },
  { href: "/audit", icon: FileText, label: "監査ログ", badge: "NEW" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const NavItem = ({
    href,
    icon: Icon,
    label,
    badge,
  }: {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    badge?: string;
  }) => {
    const isActive = pathname === href;
    const content = (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1">{label}</span>
            {badge && (
              <span className="rounded bg-blue-500 px-1.5 py-0.5 text-xs text-white">
                {badge}
              </span>
            )}
          </>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col border-r bg-card transition-all duration-300",
          collapsed ? "w-16" : "w-56"
        )}
      >
        <div className="flex h-14 items-center border-b px-3">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Ticket className="h-6 w-6 text-primary" />
              <span>Helpdesk v2</span>
            </Link>
          )}
          {collapsed && <Ticket className="mx-auto h-6 w-6 text-primary" />}
        </div>

        <nav className="flex-1 space-y-1 p-2">
          <div className="space-y-1">
            {mainNavItems.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>

          <div className="my-4 border-t" />

          <div className="space-y-1">
            {!collapsed && (
              <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
                ITSM
              </p>
            )}
            {itsmNavItems.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>

          <div className="my-4 border-t" />

          <div className="space-y-1">
            {!collapsed && (
              <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
                管理
              </p>
            )}
            {adminNavItems.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        </nav>

        <div className="border-t p-2">
          <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between px-2")}>
            {!collapsed && <ThemeToggle />}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
