import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  // CORS headers for public access
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    const { id } = await req.json();

    if (!id) {
      return Response.json({ error: '분석 ID가 필요합니다.' }, { status: 400, headers: corsHeaders });
    }

    // Use service role so no login is required to view shared links
    const record = await base44.asServiceRole.entities.BuildingAnalysis.get(id);
    if (!record) {
      return Response.json({ error: '분석 정보를 찾을 수 없습니다.' }, { status: 404, headers: corsHeaders });
    }

    return Response.json({ data: record }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});