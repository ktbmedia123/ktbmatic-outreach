// Informuje aplikację, które usługi są skonfigurowane po stronie serwera (bez ujawniania kluczy).
export default async () =>
  Response.json({ ai: Boolean(process.env.GEMINI_API_KEY), enrich: true }, { headers: { 'Cache-Control': 'no-store' } });
