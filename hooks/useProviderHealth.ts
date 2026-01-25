import { useState, useEffect } from 'react';

export interface ProviderHealth {
  provider: string;
  healthy: boolean;
  latency: number;
  timestamp: number;
  status: 'operational' | 'down' | 'checking' | 'error';
}

export function useProviderHealth(providers: string[]) {
  const [healthStatus, setHealthStatus] = useState<Record<string, ProviderHealth>>({});
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    if (providers.length === 0) return;
    
    setLoading(true);
    const results: Record<string, ProviderHealth> = {};

    // Check all providers in parallel
    await Promise.all(
      providers.map(async (provider) => {
        try {
          const response = await fetch(`/api/provider-health?provider=${provider}`);
          const data = await response.json();
          results[provider] = data;
        } catch (error) {
          results[provider] = {
            provider,
            healthy: false,
            latency: 0,
            timestamp: Date.now(),
            status: 'error',
          };
        }
      })
    );

    setHealthStatus(results);
    setLoading(false);
  };

  useEffect(() => {
    checkHealth();
    
    // Refresh every 60 seconds
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, [providers.join(',')]);

  return {
    healthStatus,
    loading,
    refresh: checkHealth,
  };
}
