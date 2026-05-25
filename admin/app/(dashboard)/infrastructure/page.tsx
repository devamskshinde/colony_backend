"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Database, Globe, MessageSquare, Bell, Mail, CreditCard, Eye, EyeOff, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface CredentialField {
  label: string;
  value: string;
  masked: boolean;
  type?: string;
}

function CredentialSection({
  icon: Icon,
  title,
  fields,
  status,
  onTest,
  testLabel,
}: {
  icon: React.ElementType;
  title: string;
  fields: CredentialField[];
  status: string;
  onTest: () => void;
  testLabel: string;
}) {
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setTesting(false);
    toast.success(`${title} connection successful`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-colonyPurple/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-colonyPurple" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <Badge className={status === "connected" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                {status === "connected" ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                {status}
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {testLabel}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field.label}>
              <label className="text-xs text-textMuted block mb-1">{field.label}</label>
              <div className="relative">
                <input
                  type={field.masked && !showPasswords[field.label] ? "password" : "text"}
                  defaultValue={field.value}
                  className="w-full h-9 px-3 pr-9 bg-bgPrimary border border-white/10 rounded-lg text-sm text-textPrimary focus:outline-none focus:ring-1 focus:ring-colonyPurple"
                  readOnly={field.masked}
                />
                {field.masked && (
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => ({ ...prev, [field.label]: !prev[field.label] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-textMuted hover:text-textPrimary"
                  >
                    {showPasswords[field.label] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function InfrastructurePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Infrastructure</h1>
        <p className="text-textMuted">Database, cache, and service credentials</p>
      </div>

      <div className="grid gap-6">
        <CredentialSection
          icon={Database}
          title="PostgreSQL Database"
          fields={[
            { label: "Host", value: "localhost", masked: false },
            { label: "Port", value: "5432", masked: false },
            { label: "Database", value: "colony", masked: false },
            { label: "Username", value: "colony_user", masked: false },
            { label: "Password", value: "••••••••••••", masked: true },
          ]}
          status="connected"
          onTest={() => {}}
          testLabel="Test Connection"
        />

        <CredentialSection
          icon={Globe}
          title="Redis Cache"
          fields={[
            { label: "Host", value: "127.0.0.1", masked: false },
            { label: "Port", value: "6379", masked: false },
            { label: "Password", value: "••••••••••••", masked: true },
          ]}
          status="connected"
          onTest={() => {}}
          testLabel="Test Connection"
        />

        <CredentialSection
          icon={MessageSquare}
          title="SMS Gateway"
          fields={[
            { label: "Provider", value: "MSG91", masked: false },
            { label: "API Key", value: "••••••••••••", masked: true },
            { label: "Sender ID", value: "COLONY", masked: false },
          ]}
          status="connected"
          onTest={() => {}}
          testLabel="Test SMS"
        />

        <CredentialSection
          icon={Bell}
          title="Push Notifications (FCM)"
          fields={[
            { label: "Server Key", value: "••••••••••••", masked: true },
            { label: "Project ID", value: "colony-1", masked: false },
          ]}
          status="connected"
          onTest={() => {}}
          testLabel="Test Push"
        />

        <CredentialSection
          icon={Mail}
          title="Email SMTP"
          fields={[
            { label: "Host", value: "smtp.gmail.com", masked: false },
            { label: "Port", value: "587", masked: false },
            { label: "Username", value: "noreply@colony.app", masked: false },
            { label: "Password", value: "••••••••••••", masked: true },
          ]}
          status="connected"
          onTest={() => {}}
          testLabel="Test Email"
        />

        <CredentialSection
          icon={CreditCard}
          title="Payment Gateway (Razorpay)"
          fields={[
            { label: "Key ID", value: "••••••••••••", masked: true },
            { label: "Key Secret", value: "••••••••••••", masked: true },
          ]}
          status="connected"
          onTest={() => {}}
          testLabel="Test Payment"
        />
      </div>
    </div>
  );
}
