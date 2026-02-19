import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const analyses = await base44.asServiceRole.entities.BuildingAnalysis.list('-created_date', 200);
    console.log(`[backfill] 전체 분석 기록: ${analyses.length}건`);

    const results = [];

    for (const item of analyses) {
      const address = item.address;
      if (!address) {
        results.push({ id: item.id, status: 'skip - no address' });
        continue;
      }

      try {
        // searchCommercialPrice 함수 로직 인라인
        const searchRes = await base44.asServiceRole.functions.invoke('searchCommercialPrice', {
          address,
          buildingType: item.building_type,
          estimatedYear: item.estimated_year,
          estimatedArea: item.estimated_area_pyeong ? parseFloat(item.estimated_area_pyeong) : undefined
        });

        const data = searchRes?.data;
        if (data?.success && data.data?.length > 0) {
          const top = data.data[0];
          if (top.매칭점수 >= 80) {
            await base44.asServiceRole.entities.BuildingAnalysis.update(item.id, {
              real_price_data: top,
              price_type: '최근 실거래가'
            });
            results.push({
              id: item.id,
              building: item.building_name,
              address,
              status: 'updated',
              matched: top.지번,
              score: top.매칭점수,
              price: top.거래금액
            });
          } else {
            results.push({
              id: item.id,
              building: item.building_name,
              address,
              status: 'no_match',
              top_score: top.매칭점수,
              top_jibun: top.지번
            });
          }
        } else {
          results.push({ id: item.id, building: item.building_name, address, status: 'no_data' });
        }
      } catch (e) {
        results.push({ id: item.id, address, status: `error: ${e.message}` });
      }
    }

    const updated = results.filter(r => r.status === 'updated').length;
    const noMatch = results.filter(r => r.status === 'no_match').length;
    const noData = results.filter(r => r.status === 'no_data').length;

    return Response.json({
      summary: { total: analyses.length, updated, noMatch, noData },
      details: results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});