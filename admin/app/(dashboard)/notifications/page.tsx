"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send, Bell, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"all" | "premium" | "specific">("all");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title || !body) {
      toast.error("Title and body are required");
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    toast.success(`Notification sent to ${target === "all" ? "all users" : target}`);
    setTitle("");
    setBody("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-textMuted">Send broadcast notifications to users</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-colonyPurple" />
              Compose Notification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-textSecondary block mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title"
                className="w-full h-10 px-4 bg-bgPrimary border border-white/10 rounded-lg text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-colonyPurple"
              />
            </div>
            <div>
              <label className="text-sm text-textSecondary block mb-2">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Notification body"
                rows={4}
                className="w-full p-4 bg-bgPrimary border border-white/10 rounded-lg text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-colonyPurple resize-none"
              />
            </div>
            <div>
              <label className="text-sm text-textSecondary block mb-2">Target</label>
              <div className="flex gap-2">
                {(["all", "premium", "specific"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTarget(t)}
                    className={`px-4 py-2 text-sm rounded-lg capitalize ${
                      target === t ? "bg-colonyPurple text-white" : "bg-bgTertiary text-textMuted hover:text-textPrimary"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleSend} disabled={sending} className="w-full purple-gradient">
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send Notification
            </Button>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-colonyPurple" />
              Recent Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { title: "Welcome to Colony!", body: "Start exploring your neighborhood", time: "2 hours ago", target: "all" },
                { title: "Premium Offer", body: "50% off premium this weekend", time: "1 day ago", target: "free" },
                { title: "New Feature: Stories", body: "Share your day with your colony", time: "3 days ago", target: "all" },
              ].map((notif, i) => (
                <div key={i} className="p-3 bg-bgPrimary rounded-lg border border-white/5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{notif.title}</p>
                    <span className="text-xs text-textMuted">{notif.time}</span>
                  </div>
                  <p className="text-xs text-textMuted mt-1">{notif.body}</p>
                  <span className="text-xs text-colonyPurple mt-1 inline-block">{notif.target}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
