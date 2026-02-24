import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { id } = await req.json();

    if (!id) return Response.json({ error: '분석 ID가 필요합니다.' }, { status: 400 });

    const results = await base44.asServiceRole.entities.BuildingAnalysis.filter({ id });
    if (!results || results.length === 0) {
      return Response.json({ error: '분석 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({ data: results[0] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});