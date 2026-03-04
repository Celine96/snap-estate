import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * 데이터 품질 모니터링 (관리자 전용)
 * BuildingAnalysis 최근 500건 분석:
 * - 실거래가 매칭률, 데이터 소스 비율
 * - 위치 정확도, 매칭 신뢰도 분포
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const analyses = await base44.asServiceRole.entities.BuildingAnalysis.list('-created_date', 500);

    const total = analyses.length;
    let withRealPrice = 0;
    let dbMatch = 0;
    let govApiMatch = 0;
    let aiEstimate = 0;
    let locationAccurate = 0;
    let locationNearby = 0;
    let locationIncorrect = 0;
    let locationUnrated = 0;

    const confidence = { high: 0, medium: 0, low: 0, none: 0 };

    for (const item of analyses) {
      // 실거래가 매칭 소스
      if (item.price_type === '최근 실거래가') {
        withRealPrice++;
        dbMatch++;
      } else if (item.price_type === '국토교통부 실거래가') {
        withRealPrice++;
        govApiMatch++;
      } else {
        aiEstimate++;
      }

      // 위치 정확도
      if (item.location_accuracy === 'accurate') locationAccurate++;
      else if (item.location_accuracy === 'nearby') locationNearby++;
      else if (item.location_accuracy === 'incorrect') locationIncorrect++;
      else locationUnrated++;

      // 매칭 신뢰도
      const conf = item.real_price_data?.매칭신뢰도;
      if (conf === 'high') confidence.high++;
      else if (conf === 'medium') confidence.medium++;
      else if (conf === 'low') confidence.low++;
      else confidence.none++;
    }

    const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

    return Response.json({
      summary: {
        total,
        실거래가_매칭률: `${pct(withRealPrice)}%`,
        실거래가_매칭수: withRealPrice,
      },
      price_source: {
        DB_매칭: { count: dbMatch, pct: `${pct(dbMatch)}%` },
        국토부_API: { count: govApiMatch, pct: `${pct(govApiMatch)}%` },
        AI_추정: { count: aiEstimate, pct: `${pct(aiEstimate)}%` },
      },
      location_accuracy: {
        정확: { count: locationAccurate, pct: `${pct(locationAccurate)}%` },
        근처: { count: locationNearby, pct: `${pct(locationNearby)}%` },
        부정확: { count: locationIncorrect, pct: `${pct(locationIncorrect)}%` },
        미평가: { count: locationUnrated, pct: `${pct(locationUnrated)}%` },
      },
      match_confidence: {
        high: { count: confidence.high, pct: `${pct(confidence.high)}%` },
        medium: { count: confidence.medium, pct: `${pct(confidence.medium)}%` },
        low: { count: confidence.low, pct: `${pct(confidence.low)}%` },
        none: { count: confidence.none, pct: `${pct(confidence.none)}%` },
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
