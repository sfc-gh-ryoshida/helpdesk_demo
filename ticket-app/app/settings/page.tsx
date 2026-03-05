"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, Bell, Clock, Users, RefreshCw, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface SettingsData {
  sla_high: number;
  sla_medium: number;
  sla_low: number;
  auto_escalate: boolean;
  notify_new_ticket: boolean;
  notify_assign: boolean;
  notify_sla_warning: boolean;
  notify_sla_breach: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (updates: Partial<SettingsData>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setSettings((prev) => prev ? { ...prev, ...updates } : null);
        toast.success("設定を保存しました");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleSlaChange = (key: "sla_high" | "sla_medium" | "sla_low", value: string) => {
    const num = parseInt(value) || 0;
    setSettings((prev) => prev ? { ...prev, [key]: num } : null);
  };

  const handleToggle = (key: keyof SettingsData) => {
    if (!settings) return;
    const newValue = !settings[key];
    setSettings((prev) => prev ? { ...prev, [key]: newValue } : null);
    handleSave({ [key]: newValue });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">設定</h1>
            <p className="text-sm text-muted-foreground">システム設定・通知・SLA設定</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSettings} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          更新
        </Button>
      </div>

      <Tabs defaultValue="sla">
        <TabsList>
          <TabsTrigger value="sla">
            <Clock className="w-4 h-4 mr-2" />
            SLA設定
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            通知
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-2" />
            ユーザー
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sla" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>SLA設定</CardTitle>
              <CardDescription>緊急度別の対応期限を設定</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading || !settings ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">HIGH（高緊急度）</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={settings.sla_high}
                          onChange={(e) => handleSlaChange("sla_high", e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">時間</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">MEDIUM（中緊急度）</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={settings.sla_medium}
                          onChange={(e) => handleSlaChange("sla_medium", e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">時間</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">LOW（低緊急度）</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={settings.sla_low}
                          onChange={(e) => handleSlaChange("sla_low", e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">時間</span>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">SLA超過時に自動エスカレーション</p>
                      <p className="text-sm text-muted-foreground">期限超過時に上長へ自動通知</p>
                    </div>
                    <Switch
                      checked={settings.auto_escalate}
                      onCheckedChange={() => handleToggle("auto_escalate")}
                    />
                  </div>
                  <Button
                    onClick={() => handleSave({
                      sla_high: settings.sla_high,
                      sla_medium: settings.sla_medium,
                      sla_low: settings.sla_low,
                    })}
                    disabled={saving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    保存
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>通知設定</CardTitle>
              <CardDescription>メール・Slack通知の設定</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading || !settings ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">新規チケット通知</p>
                      <p className="text-sm text-muted-foreground">新しいチケットが作成されたとき</p>
                    </div>
                    <Switch
                      checked={settings.notify_new_ticket}
                      onCheckedChange={() => handleToggle("notify_new_ticket")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">アサイン通知</p>
                      <p className="text-sm text-muted-foreground">チケットがアサインされたとき</p>
                    </div>
                    <Switch
                      checked={settings.notify_assign}
                      onCheckedChange={() => handleToggle("notify_assign")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">SLA警告通知</p>
                      <p className="text-sm text-muted-foreground">SLA期限の25%前に通知</p>
                    </div>
                    <Switch
                      checked={settings.notify_sla_warning}
                      onCheckedChange={() => handleToggle("notify_sla_warning")}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">SLA超過通知</p>
                      <p className="text-sm text-muted-foreground">SLA期限を超過したとき</p>
                    </div>
                    <Switch
                      checked={settings.notify_sla_breach}
                      onCheckedChange={() => handleToggle("notify_sla_breach")}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>担当者管理</CardTitle>
              <CardDescription>チケット担当者の追加・編集</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-8 text-center">
                ※ v2で実装予定：ユーザー管理機能
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
