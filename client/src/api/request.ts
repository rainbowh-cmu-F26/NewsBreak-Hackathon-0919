export async function postJson(path: string, body: unknown): Promise<unknown> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}${path}`, {
      method: 'POST', signal: AbortSignal.timeout(25_000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('The server could not complete the request. Please try again.');
    return await response.json();
  } catch (error) {
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
      throw new Error('The server did not respond within 25 seconds. Check that the API server is running, then try again.');
    }
    throw error;
  }
}
