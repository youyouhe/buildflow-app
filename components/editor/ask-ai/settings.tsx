"use client";
import classNames from "classnames";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PROVIDERS, MODELS, ModelMetadata } from "@/lib/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState, useEffect } from "react";
import { useUpdateEffect } from "react-use";
import Image from "next/image";
import {
  BrainIcon,
  CheckCheck,
  ChevronDown,
  Sparkles,
  Zap,
  DollarSign,
  Search,
  Filter,
  Clock,
  Gauge,
  Star,
  StarOff,
  Save,
  Trash2,
  WifiOff,
  Wifi,
  AlertCircle,
} from "lucide-react";
import { useAi } from "@/hooks/useAi";
import Loading from "@/components/loading";
import { 
  toggleFavoriteModel, 
  getFavoriteModels,
  addModelPreset,
  getModelPresets,
  removeModelPreset,
  deduplicatePresets,
} from "@/lib/indexeddb/settings";
import { useProviderHealth } from "@/hooks/useProviderHealth";

export function Settings({
  open,
  onClose,
  error,
  isFollowUp = false,
}: {
  open: boolean;
  error?: string;
  isFollowUp?: boolean;
  onClose: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {
    model,
    provider,
    setProvider,
    setModel,
    selectedModel,
    globalAiLoading,
  } = useAi();
  const [isMounted, setIsMounted] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [speedFilter, setSpeedFilter] = useState<string>("all");
  const [qualityFilter, setQualityFilter] = useState<string>("all");
  const [favoriteModels, setFavoriteModels] = useState<string[]>([]);
  const [modelPresets, setModelPresets] = useState<any[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    loadFavorites();
    loadPresets();
  }, []);

  const loadFavorites = async () => {
    const favorites = await getFavoriteModels();
    setFavoriteModels(favorites);
  };

  const loadPresets = async () => {
    const presets = await getModelPresets();
    setModelPresets(presets);
  };

  const handleToggleFavorite = async (modelValue: string) => {
    await toggleFavoriteModel(modelValue);
    await loadFavorites();
  };

  const handleSavePreset = async () => {
    if (!model || !provider) return;
    const selectedModel = MODELS.find(m => m.value === model);
    if (!selectedModel) return;
    
    const presetName = prompt('Enter a name for this preset:', `${selectedModel.label} - ${provider}`);
    if (presetName) {
      try {
        await addModelPreset({
          name: presetName,
          model,
          provider: provider as string,
        });
        await loadPresets();
      } catch (error: any) {
        alert(error.message || 'Failed to save preset');
      }
    }
  };

  const handleDeletePreset = async (presetId: string) => {
    await removeModelPreset(presetId);
    await loadPresets();
  };

  const handleDeduplicatePresets = async () => {
    try {
      const removed = await deduplicatePresets();
      if (removed > 0) {
        alert(`Removed ${removed} duplicate preset${removed > 1 ? 's' : ''}`);
        await loadPresets();
      } else {
        alert('No duplicates found');
      }
    } catch (error) {
      alert('Failed to remove duplicates');
    }
  };

  const handleLoadPreset = (preset: any) => {
    setModel(preset.model);
    setProvider(preset.provider);
    
    const modelInfo = MODELS.find(m => m.value === preset.model);
    toast.success(`Loaded preset: ${preset.name}`, {
      description: `${modelInfo?.label || preset.model} via ${preset.provider}`,
    });
    
    // Close the popover after loading preset
    onClose(false);
  };

  // Check if current model+provider combination is already saved as a preset
  const currentPresetExists = useMemo(() => {
    if (!model || !provider || provider === "auto") return false;
    return modelPresets.some(p => p.model === model && p.provider === provider);
  }, [model, provider, modelPresets]);

  // const modelAvailableProviders = useMemo(() => {
  //   const availableProviders = MODELS.find(
  //     (m: { value: string }) => m.value === model
  //   )?.providers;
  //   if (!availableProviders) return Object.keys(PROVIDERS);
  //   return Object.keys(PROVIDERS).filter((id) =>
  //     availableProviders.includes(id)
  //   );
  // }, [model]);

  useUpdateEffect(() => {
    if (
      !["auto", "fastest", "cheapest"].includes(provider as string) &&
      !providers.includes(provider as string)
    ) {
      setProvider("auto");
    }
  }, [model, provider]);

  const formattedModels = useMemo(() => {
    // First, filter models based on search and filters
    let filteredModels = MODELS.filter((model) => {
      // Search filter
      const matchesSearch = searchQuery === "" || 
        model.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.value.toLowerCase().includes(searchQuery.toLowerCase());

      // Speed filter
      const matchesSpeed = speedFilter === "all" || model.speed === speedFilter;

      // Quality filter
      const matchesQuality = qualityFilter === "all" || model.quality === qualityFilter;

      // Favorites filter
      const matchesFavorites = !showFavoritesOnly || favoriteModels.includes(model.value);

      return matchesSearch && matchesSpeed && matchesQuality && matchesFavorites;
    });

    // Then, group by company
    const lists: (ModelMetadata | { isCategory: true; name: string; logo?: string })[] = [];
    const keys = new Set<string>();
    
    filteredModels.forEach((model) => {
      if (!keys.has(model.companyName)) {
        lists.push({
          isCategory: true,
          name: model.companyName,
          logo: model.logo,
        });
        keys.add(model.companyName);
      }
      lists.push(model);
    });
    return lists;
  }, [searchQuery, speedFilter, qualityFilter, showFavoritesOnly, favoriteModels]);

  const [providers, setProviders] = useState<string[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Provider health check
  const { healthStatus, loading: healthLoading } = useProviderHealth(
    Object.keys(PROVIDERS).filter(id => id !== "auto")
  );

  // Filter available providers based on selected model
  const availableProviders = useMemo(() => {
    if (!model || providers.length === 0) {
      return Object.keys(PROVIDERS).filter(id => id !== "auto");
    }
    return Object.keys(PROVIDERS)
      .filter(id => id !== "auto")
      .filter(id => providers.includes(id));
  }, [model, providers]);

  useEffect(() => {
    const loadProviders = async () => {
      setLoadingProviders(true);
      if (!model) {
        setProviders([]);
        return;
      }
      try {
        // Get providers for the selected model
        const selectedModel = MODELS.find(m => m.value === model);
        const modelProviders = selectedModel?.providers || [];
        setProviders(modelProviders);
      } catch (error) {
        console.error("Failed to load providers:", error);
        setProviders([]);
      } finally {
        setLoadingProviders(false);
      }
    };

    loadProviders();
  }, [model]);

  const handleImageError = (providerId: string) => {
    setFailedImages((prev) => new Set([...prev, providerId]));
  };

  // Helper to format token counts
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  };

  // Helper to get speed icon and color
  const getSpeedInfo = (speed?: string) => {
    switch (speed) {
      case "fast":
        return { icon: Zap, color: "text-green-500", label: "Fast" };
      case "medium":
        return { icon: Gauge, color: "text-yellow-500", label: "Medium" };
      case "slow":
        return { icon: Clock, color: "text-orange-500", label: "Slow" };
      default:
        return null;
    }
  };

  // Helper to format cost
  const formatCost = (cost?: number) => {
    if (!cost || cost === 0) return "Free";
    if (cost < 1) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(2)}`;
  };

  // Helper to get health status indicator
  const getHealthIndicator = (providerId: string) => {
    const health = healthStatus[providerId];
    if (!health) return null;

    if (health.healthy) {
      return (
        <span title={`Operational (${health.latency}ms)`}>
          <Wifi className="size-3 text-green-500" />
        </span>
      );
    } else {
      return (
        <span title="Service unavailable">
          <WifiOff className="size-3 text-red-500" />
        </span>
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={onClose}>
      <PopoverTrigger asChild>
        <Button
          variant={open ? "default" : "outline"}
          className="!rounded-md"
          disabled={globalAiLoading || loadingProviders}
          size="xs"
        >
          {/* <Brain className="size-3.5" /> */}
          {selectedModel?.logo && (
            <Image
              src={selectedModel?.logo}
              alt={selectedModel.label}
              className={`size-3.5 ${open ? "" : "filter invert"}`}
              width={20}
              height={20}
            />
          )}
          <span className="truncate max-w-[120px]">
            {isMounted
              ? selectedModel?.label?.split(" ").join("-").toLowerCase()
              : "..."}
          </span>
          <ChevronDown className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="!rounded-2xl p-0 !w-[480px] overflow-hidden !bg-neutral-900"
        align="center"
      >
        <header className="flex items-center justify-center text-sm px-4 py-3 border-b gap-2 bg-neutral-950 border-neutral-800 font-semibold text-neutral-200">
          Customize Settings
        </header>
        <main className="px-4 pt-5 pb-6 space-y-5">
          {error !== "" && (
            <p className="text-red-500 text-sm font-medium mb-2 flex items-center justify-between bg-red-500/10 p-2 rounded-md">
              {error}
            </p>
          )}

          {/* Model Presets */}
          {modelPresets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-neutral-300 text-sm">Quick Presets</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">{modelPresets.length} saved</span>
                  <button
                    onClick={handleDeduplicatePresets}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    title="Remove duplicate presets"
                  >
                    Clean Duplicates
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {modelPresets.map((preset) => {
                  const modelExists = MODELS.find(m => m.value === preset.model);
                  const isInvalid = !modelExists;
                  const isActive = preset.model === model && preset.provider === provider;
                  
                  return (
                    <div
                      key={preset.id}
                      className={`flex items-center gap-2 rounded-lg p-2 border transition-all ${
                        isActive 
                          ? 'bg-blue-500/10 border-blue-500/50' 
                          : isInvalid 
                            ? 'bg-neutral-800 border-red-500/50' 
                            : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
                      }`}
                      title={`Model: ${preset.model}\nProvider: ${preset.provider}${isInvalid ? '\n⚠️ Model not found' : ''}${isActive ? '\n✓ Currently selected' : ''}`}
                    >
                      <button
                        onClick={() => handleLoadPreset(preset)}
                        className="flex-1 text-left"
                      >
                        <div className={`text-sm truncate transition-colors ${
                          isActive ? 'text-blue-400' : 'hover:text-blue-400'
                        }`}>
                          {preset.name} {isActive && '✓'}
                        </div>
                        <div className="text-xs text-neutral-500 truncate">
                          {preset.provider} • {isInvalid ? '⚠️ Invalid' : modelExists?.label}
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        className="text-neutral-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-neutral-500" />
                <Input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-neutral-800 border-neutral-700"
                />
              </div>
              <Button
                variant={showFavoritesOnly ? "default" : "secondary"}
                size="sm"
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className="shrink-0"
              >
                <Star className={`size-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">Speed</label>
                <Select value={speedFilter} onValueChange={setSpeedFilter}>
                  <SelectTrigger className="h-9 bg-neutral-800 border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Speeds</SelectItem>
                    <SelectItem value="fast">Fast</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="slow">Slow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">Quality</label>
                <Select value={qualityFilter} onValueChange={setQualityFilter}>
                  <SelectTrigger className="h-9 bg-neutral-800 border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Quality</SelectItem>
                    <SelectItem value="highest">Highest</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <label className="block">
            <p className="text-neutral-300 text-sm mb-2.5">Choose a model</p>
            <Select defaultValue={model} onValueChange={setModel}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                <SelectGroup>
                  {formattedModels.map((item: any) => {
                    if ("isCategory" in item) {
                      return (
                        <SelectLabel
                          key={item.name}
                          className="flex items-center gap-1"
                        >
                          {item.name}
                        </SelectLabel>
                      );
                    }
                    const {
                      value,
                      label,
                      isNew = false,
                      isThinker = false,
                      contextWindow,
                      speed,
                      quality,
                      costPer1MTokensInput,
                      description,
                    } = item;
                    const speedInfo = getSpeedInfo(speed);
                    const isFavorite = favoriteModels.includes(value);
                    
                    return (
                      <SelectItem
                        key={value}
                        value={value}
                        className="py-3"
                        disabled={isThinker && isFollowUp}
                      >
                        <div className="flex items-start justify-between w-full gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{label}</span>
                              {isNew && (
                                <span className="text-xs bg-gradient-to-br from-sky-400 to-sky-600 text-white rounded-full px-1.5 py-0.5">
                                  New
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleToggleFavorite(value);
                                }}
                                className="ml-auto text-neutral-500 hover:text-yellow-400 transition-colors"
                              >
                                <Star className={`size-3.5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                              </button>
                            </div>
                            {description && (
                              <p className="text-xs text-neutral-400 line-clamp-1">
                                {description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              {contextWindow && (
                                <span className="text-xs text-neutral-500 flex items-center gap-1">
                                  <BrainIcon className="size-3" />
                                  {formatTokens(contextWindow)}
                                </span>
                              )}
                              {speedInfo && (
                                <span className={`text-xs flex items-center gap-1 ${speedInfo.color}`}>
                                  <speedInfo.icon className="size-3" />
                                  {speedInfo.label}
                                </span>
                              )}
                              {costPer1MTokensInput !== undefined && (
                                <span className="text-xs text-neutral-500 flex items-center gap-1">
                                  <DollarSign className="size-3" />
                                  {formatCost(costPer1MTokensInput)}/1M
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          {/* {isFollowUp && (
            <div className="bg-amber-500/10 border-amber-500/10 p-3 text-xs text-amber-500 border rounded-lg">
              Note: You can&apos;t use a Thinker model for follow-up requests.
              We automatically switch to the default model for you.
            </div>
          )} */}
          <div className="space-y-3">
            <label className="block">
              <div className="flex items-center justify-between mb-2">
                <p className="text-neutral-300 text-sm">Choose a Provider</p>
                {model && providers.length > 0 && (
                  <span className="text-xs text-neutral-500">
                    {availableProviders.length} available
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  key="auto"
                  variant={"auto" === provider ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setProvider("auto")}
                  className="justify-start"
                >
                  <Sparkles className="size-4 mr-2" />
                  <span className="flex-1 text-left">Auto</span>
                  {"auto" === provider && (
                    <CheckCheck className="size-4 text-blue-500" />
                  )}
                </Button>
                {availableProviders.map((id: string) => (
                  <Button
                    key={id}
                    variant={id === provider ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setProvider(id)}
                    className="justify-start"
                  >
                    {failedImages.has(id) ? (
                      <BrainIcon className="size-4 mr-2" />
                    ) : (
                      <Image
                        src={`/providers/${id}.svg`}
                        alt={id}
                        className="size-4 mr-2"
                        width={16}
                        height={16}
                        onError={() => handleImageError(id)}
                      />
                    )}
                    <span className="flex-1 text-left">{PROVIDERS?.[id as keyof typeof PROVIDERS]?.name || id}</span>
                    {getHealthIndicator(id)}
                    {id === provider && (
                      <CheckCheck className="size-4 text-blue-500 ml-1" />
                    )}
                  </Button>
                ))}
              </div>
            </label>
            
            {/* Save Current Selection as Preset */}
            {model && provider && provider !== "auto" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSavePreset}
                className="w-full justify-start text-neutral-300"
                disabled={currentPresetExists}
              >
                <Save className="size-4 mr-2" />
                {currentPresetExists ? "Already Saved as Preset" : "Save as Preset"}
              </Button>
            )}
          </div>
        </main>
      </PopoverContent>
    </Popover>
  );
}
