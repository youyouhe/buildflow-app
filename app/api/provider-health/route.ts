import { NextResponse } from 'next/server';

/**
 * Simple health check for AI providers
 * This endpoint checks basic connectivity to provider APIs
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');

  if (!provider) {
    return NextResponse.json(
      { error: 'Provider parameter is required' },
      { status: 400 }
    );
  }

  try {
    let isHealthy = true;
    let latency = 0;
    const startTime = Date.now();

    // Check provider-specific health endpoints
    switch (provider) {
      case 'openai':
        try {
          const response = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY || 'dummy'}`,
            },
            signal: AbortSignal.timeout(5000),
          });
          isHealthy = response.ok || response.status === 401; // 401 means API is up but auth failed
          latency = Date.now() - startTime;
        } catch (error) {
          isHealthy = false;
        }
        break;

      case 'google':
        try {
          const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          });
          isHealthy = response.ok || response.status === 400;
          latency = Date.now() - startTime;
        } catch (error) {
          isHealthy = false;
        }
        break;

      case 'deepseek':
        try {
          const response = await fetch('https://api.deepseek.com/v1/models', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY || 'dummy'}`,
            },
            signal: AbortSignal.timeout(5000),
          });
          isHealthy = response.ok || response.status === 401;
          latency = Date.now() - startTime;
        } catch (error) {
          isHealthy = false;
        }
        break;

      case 'openrouter':
        try {
          const response = await fetch('https://openrouter.ai/api/v1/models', {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          });
          isHealthy = response.ok;
          latency = Date.now() - startTime;
        } catch (error) {
          isHealthy = false;
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Unknown provider' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      provider,
      healthy: isHealthy,
      latency,
      timestamp: Date.now(),
      status: isHealthy ? 'operational' : 'down',
    });

  } catch (error) {
    console.error('Provider health check error:', error);
    return NextResponse.json(
      { 
        provider,
        healthy: false,
        error: 'Health check failed',
        timestamp: Date.now(),
        status: 'error',
      },
      { status: 500 }
    );
  }
}
