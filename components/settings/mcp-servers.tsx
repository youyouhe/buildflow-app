"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Server,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Plug,
  Eye,
  EyeOff,
} from "lucide-react";
import { useMcp } from "@/hooks/useMcp";
import type { McpConnectionStatus } from "@/types";

function StatusDot({ status }: { status: McpConnectionStatus; enabled: boolean }) {
  const colors: Record<McpConnectionStatus, string> = {
    idle: "bg-neutral-500",
    connecting: "bg-yellow-500 animate-pulse",
    connected: "bg-green-500",
    error: "bg-red-500",
  };

  const labels: Record<McpConnectionStatus, string> = {
    idle: "Disconnected",
    connecting: "Connecting...",
    connected: "Connected",
    error: "Error",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block size-2 rounded-full ${colors[status]}`} />
      <span className="text-xs text-neutral-400">{labels[status]}</span>
    </div>
  );
}

interface ServerFormData {
  name: string;
  url: string;
  authToken: string;
}

const emptyForm: ServerFormData = { name: "", url: "", authToken: "" };

export function McpServersSettings() {
  const {
    servers,
    loading,
    connectServer,
    disconnectServer,
    testConnection,
    addServer,
    editServer,
    removeServer,
    toggleServer,
  } = useMcp();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServerFormData>(emptyForm);
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    toolCount?: number;
    error?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const openAddDialog = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowToken(false);
    setTestResult(null);
    setDialogOpen(true);
  };

  const openEditDialog = (id: string) => {
    const server = servers.find((s) => s.config.id === id);
    if (!server) return;
    setEditingId(id);
    setForm({
      name: server.config.name,
      url: server.config.url,
      authToken: server.config.authToken || "",
    });
    setShowToken(false);
    setTestResult(null);
    setDialogOpen(true);
  };

  const handleTestConnection = async () => {
    if (!form.url.trim()) {
      toast.error("Please enter a server URL");
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await testConnection({
      name: form.name || "test",
      url: form.url,
      authToken: form.authToken || undefined,
    });
    setTestResult(result);
    setTesting(false);
    if (result.success) {
      toast.success(`Connection successful - ${result.toolCount} tool(s) available`);
    } else {
      toast.error(result.error || "Connection failed");
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast.error("Name and URL are required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await editServer(editingId, {
          name: form.name,
          url: form.url,
          authToken: form.authToken || undefined,
        });
        toast.success("Server updated");
      } else {
        await addServer({
          name: form.name,
          url: form.url,
          authToken: form.authToken || undefined,
          enabled: false,
        });
        toast.success("Server added");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save server");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete MCP server "${name}"?`)) return;
    try {
      await removeServer(id);
      toast.success("Server deleted");
    } catch {
      toast.error("Failed to delete server");
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleServer(id, enabled);
      if (enabled) {
        await connectServer(id);
      }
    } catch {
      toast.error("Failed to toggle server");
    }
  };

  const handleConnect = async (id: string) => {
    await connectServer(id);
  };

  const handleDisconnect = async (id: string) => {
    await disconnectServer(id);
  };

  if (loading) {
    return (
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-800">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Server className="size-5" />
            MCP Servers
          </h2>
        </div>
        <div className="p-6 flex items-center justify-center text-neutral-400">
          <Loader2 className="size-4 animate-spin mr-2" />
          Loading...
        </div>
      </div>
    );
  }

  // Sort: built-in first, then by creation date
  const sortedServers = [...servers].sort((a, b) => {
    if (a.config.isBuiltIn && !b.config.isBuiltIn) return -1;
    if (!a.config.isBuiltIn && b.config.isBuiltIn) return 1;
    return a.config.createdAt - b.config.createdAt;
  });

  return (
    <>
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-800">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Server className="size-5" />
            MCP Servers
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Connect to Model Context Protocol servers for extended AI capabilities.
          </p>
        </div>

        <div className="divide-y divide-neutral-800">
          {sortedServers.map(({ config, status, tools, error }) => (
            <div key={config.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-medium text-white truncate">
                      {config.name}
                    </h3>
                    {config.isBuiltIn && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 uppercase tracking-wider">
                        Built-in
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500 truncate mt-0.5">
                    {config.url}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <StatusDot status={status} enabled={config.enabled} />
                    {status === "connected" && tools.length > 0 && (
                      <span className="text-xs text-neutral-500">
                        {tools.length} tool{tools.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {status === "error" && error && (
                      <span className="text-xs text-red-400 truncate max-w-xs">
                        {error}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-4 shrink-0">
                  {config.enabled && status !== "connected" && status !== "connecting" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConnect(config.id)}
                    >
                      <Plug className="size-3.5" />
                      Connect
                    </Button>
                  )}
                  {status === "connected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDisconnect(config.id)}
                    >
                      Disconnect
                    </Button>
                  )}

                  {!config.isBuiltIn && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-neutral-400 hover:text-white"
                        onClick={() => openEditDialog(config.id)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-neutral-400 hover:text-red-400"
                        onClick={() => handleDelete(config.id, config.name)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}

                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) =>
                      handleToggle(config.id, checked)
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          {sortedServers.length === 0 && (
            <div className="p-6 text-center text-neutral-500 text-sm">
              No MCP servers configured.
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-neutral-800">
          <Button variant="outline" onClick={openAddDialog} className="w-full">
            <Plus className="size-4 mr-2" />
            Add Server
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingId ? "Edit MCP Server" : "Add MCP Server"}
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Configure a remote MCP server endpoint.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                Name
              </label>
              <Input
                placeholder="My MCP Server"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                URL
              </label>
              <Input
                placeholder="https://example.com/mcp"
                value={form.url}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, url: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                Auth Token (optional)
              </label>
              <div className="relative">
                <Input
                  type={showToken ? "text" : "password"}
                  placeholder="Bearer token..."
                  value={form.authToken}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, authToken: e.target.value }))
                  }
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  {showToken ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`text-sm px-3 py-2 rounded-lg ${
                  testResult.success
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {testResult.success
                  ? `Connected successfully - ${testResult.toolCount} tool(s) available`
                  : testResult.error || "Connection failed"}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !form.url.trim()}
            >
              {testing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Plug className="size-4" />
                  Test Connection
                </>
              )}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.url.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : editingId ? (
                "Update"
              ) : (
                "Add Server"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
