/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Key, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from "lucide-react";
import {
  getApiKey,
  setApiKey,
  deleteApiKey,
  hasApiKey,
} from "@/lib/indexeddb/apiKeys";
import { encrypt, decrypt } from "@/lib/crypto/encryption";
import { getAvailableProviders, getDefaultModel } from "@/lib/ai-providers/factory";

interface ProviderConfig {
  name: string;
  displayName: string;
  icon: string;
  models: string[];
  defaultModel: string;
  keyPlaceholder: string;
  docsUrl: string;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    name: "openai",
    displayName: "OpenAI",
    icon: "🤖",
    models: ["gpt-5.2-codex", "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    defaultModel: "gpt-5.2-codex",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  google: {
    name: "google",
    displayName: "Google Gemini",
    icon: "✨",
    models: ["gemini-3-flash-preview", "gemini-3-pro-preview", "gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
    defaultModel: "gemini-3-flash-preview",
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  deepseek: {
    name: "deepseek",
    displayName: "DeepSeek",
    icon: "🧠",
    models: ["deepseek-chat", "deepseek-coder"],
    defaultModel: "deepseek-coder",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  openrouter: {
    name: "openrouter",
    displayName: "OpenRouter",
    icon: "🔀",
    models: [
      // Top 10 ranked models as of 2026-02
      "moonshotai/kimi-k2.5",
      "google/gemini-3-flash-preview",
      "anthropic/claude-sonnet-4.5",
      "deepseek/deepseek-chat",
      "minimax/minimax-m2.1",
      "google/gemini-2.5-flash",
      "arcee-ai/trinity-large-preview",
      "x-ai/grok-4.1-fast",
      "anthropic/claude-opus-4.5",
      "google/gemini-2.5-flash-lite",
    ],
    defaultModel: "google/gemini-3-flash-preview",
    keyPlaceholder: "sk-or-v1-...",
    docsUrl: "https://openrouter.ai/keys",
  },
};

const USER_KEY = "buildflow-user-encryption-key";

export function ApiKeysSettings() {
  const [providers, setProviders] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    const availableProviders = getAvailableProviders();
    const newProviders: Record<string, any> = {};

    for (const providerName of availableProviders) {
      const hasKey = await hasApiKey(providerName);
      const apiKeyData = hasKey ? await getApiKey(providerName) : null;

      newProviders[providerName] = {
        apiKey: "",
        storedKey: apiKeyData?.encryptedKey || null,
        isValid: apiKeyData?.isValid || false,
        hasStored: hasKey,
      };
    }

    setProviders(newProviders);
  };

  const handleSaveKey = async (providerName: string, apiKey: string) => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    setLoading((prev) => ({ ...prev, [providerName]: true }));

    try {
      // Encrypt the API key
      const encryptedKey = encrypt(apiKey, USER_KEY);

      // Save to IndexedDB
      await setApiKey(providerName, encryptedKey, false);

      // Update state
      setProviders((prev) => ({
        ...prev,
        [providerName]: {
          ...prev[providerName],
          apiKey: "",
          storedKey: encryptedKey,
          hasStored: true,
          isValid: false,
        },
      }));

      toast.success(`${PROVIDER_CONFIGS[providerName].displayName} API key saved successfully`);
    } catch (error) {
      console.error("Failed to save API key:", error);
      toast.error("Failed to save API key");
    } finally {
      setLoading((prev) => ({ ...prev, [providerName]: false }));
    }
  };

  const handleDeleteKey = async (providerName: string) => {
    if (!confirm(`Delete ${PROVIDER_CONFIGS[providerName].displayName} API key?`)) {
      return;
    }

    setLoading((prev) => ({ ...prev, [providerName]: true }));

    try {
      await deleteApiKey(providerName);

      setProviders((prev) => ({
        ...prev,
        [providerName]: {
          apiKey: "",
          storedKey: null,
          isValid: false,
          hasStored: false,
        },
      }));

      toast.success(`${PROVIDER_CONFIGS[providerName].displayName} API key deleted`);
    } catch (error) {
      console.error("Failed to delete API key:", error);
      toast.error("Failed to delete API key");
    } finally {
      setLoading((prev) => ({ ...prev, [providerName]: false }));
    }
  };

  const handleValidateKey = async (providerName: string) => {
    const providerData = providers[providerName];
    if (!providerData?.storedKey) {
      toast.error("No API key stored");
      return;
    }

    setValidating((prev) => ({ ...prev, [providerName]: true }));

    try {
      // Decrypt the API key
      const decryptedKey = decrypt(providerData.storedKey, USER_KEY);

      // Call validation API
      const response = await fetch("/api/ai/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerName,
          apiKey: decryptedKey,
          model: getDefaultModel(providerName as any),
        }),
      });

      const result = await response.json();

      if (result.valid) {
        // Update validation status in IndexedDB
        await setApiKey(providerName, providerData.storedKey, true);

        setProviders((prev) => ({
          ...prev,
          [providerName]: {
            ...prev[providerName],
            isValid: true,
          },
        }));

        toast.success(`${PROVIDER_CONFIGS[providerName].displayName} API key is valid`);
      } else {
        toast.error(result.error || "API key validation failed");
      }
    } catch (error) {
      console.error("Failed to validate API key:", error);
      toast.error("Failed to validate API key");
    } finally {
      setValidating((prev) => ({ ...prev, [providerName]: false }));
    }
  };

  const toggleShowKey = (providerName: string) => {
    setShowKeys((prev) => ({ ...prev, [providerName]: !prev[providerName] }));
  };

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-800">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Key className="size-5" />
          API Keys Configuration
        </h2>
        <p className="text-sm text-neutral-400 mt-1">
          Add your API keys to use AI providers directly. Keys are encrypted and stored locally.
        </p>
      </div>

      <div className="divide-y divide-neutral-800">
        {getAvailableProviders().map((providerName) => {
          const config = PROVIDER_CONFIGS[providerName];
          const providerData = providers[providerName] || {};
          const isLoading = loading[providerName];
          const isValidating = validating[providerName];
          const showKey = showKeys[providerName];

          return (
            <div key={providerName} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <span className="text-2xl">{config.icon}</span>
                    {config.displayName}
                  </h3>
                  <p className="text-sm text-neutral-400 mt-1">
                    Models: {config.models.join(", ")}
                  </p>
                </div>
                {providerData.hasStored && (
                  <div className="flex items-center gap-2">
                    {providerData.isValid ? (
                      <div className="flex items-center gap-1.5 text-green-500 text-sm">
                        <CheckCircle className="size-4" />
                        Verified
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-yellow-500 text-sm">
                        <XCircle className="size-4" />
                        Not verified
                      </div>
                    )}
                  </div>
                )}
              </div>

              {providerData.hasStored ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-neutral-400 bg-neutral-800/50 px-4 py-2.5 rounded-lg">
                    <Key className="size-4" />
                    <span>API key is stored and encrypted</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleValidateKey(providerName)}
                      disabled={isValidating}
                    >
                      {isValidating ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Validating...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="size-4" />
                          Validate Key
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteKey(providerName)}
                      disabled={isLoading}
                    >
                      Delete Key
                    </Button>
                    <a
                      href={config.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto"
                    >
                      <Button size="sm" variant="ghost">
                        Get API Key →
                      </Button>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showKey ? "text" : "password"}
                        placeholder={config.keyPlaceholder}
                        value={providerData.apiKey || ""}
                        onChange={(e) =>
                          setProviders((prev) => ({
                            ...prev,
                            [providerName]: {
                              ...prev[providerName],
                              apiKey: e.target.value,
                            },
                          }))
                        }
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(providerName)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                      >
                        {showKey ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    <Button
                      onClick={() =>
                        handleSaveKey(providerName, providerData.apiKey)
                      }
                      disabled={isLoading || !providerData.apiKey}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Key"
                      )}
                    </Button>
                  </div>
                  <a
                    href={config.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="ghost" className="w-full">
                      Get API Key from {config.displayName} →
                    </Button>
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
