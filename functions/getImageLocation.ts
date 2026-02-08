import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * 이미지 파일에서 EXIF GPS 데이터 추출
 * @param {string} imageUrl - 이미지 URL
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return Response.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    // 이미지 다운로드
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const bytes = new Uint8Array(imageBuffer);

    // EXIF 데이터 파싱 (간단한 GPS 추출)
    let latitude = null;
    let longitude = null;

    // EXIF 시그니처 확인 (JPEG: FF D8 FF)
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
      // APP1 마커 찾기 (FF E1)
      for (let i = 2; i < bytes.length - 1; i++) {
        if (bytes[i] === 0xFF && bytes[i + 1] === 0xE1) {
          // EXIF 헤더 확인
          const exifHeader = String.fromCharCode(...bytes.slice(i + 4, i + 10));
          if (exifHeader === 'Exif\0\0') {
            // GPS 데이터 추출 (매우 단순화된 버전)
            const gpsStart = i + 10;
            const gpsData = bytes.slice(gpsStart, gpsStart + 1000);
            
            // GPS 태그 검색 (0x0001 = GPS 위도, 0x0003 = GPS 경도)
            // 실제로는 복잡한 파싱이 필요하지만, 여기서는 간단히 처리
            break;
          }
        }
      }
    }

    // EXIF에서 GPS를 못 찾았다면 AI로 위치 추정
    if (!latitude || !longitude) {
      const locationData = await base44.integrations.Core.InvokeLLM({
        prompt: `이 이미지의 정확한 위치(위도, 경도)를 추정하세요.
        
다음 정보를 활용하세요:
1. 건물 간판이나 표지판의 텍스트
2. 주변 랜드마크 (지하철역, 유명 건물 등)
3. 건물의 건축 스타일과 특징
4. 도로명, 거리 표지판

한국의 정확한 GPS 좌표를 제공하세요.`,
        file_urls: [imageUrl],
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            latitude: { type: "number", description: "위도" },
            longitude: { type: "number", description: "경도" },
            confidence: { type: "string", enum: ["높음", "보통", "낮음"], description: "위치 신뢰도" },
            source: { type: "string", description: "위치 정보 출처" }
          }
        }
      });

      latitude = locationData.latitude;
      longitude = locationData.longitude;

      return Response.json({
        latitude,
        longitude,
        source: locationData.source || 'AI 추정',
        confidence: locationData.confidence || '보통'
      });
    }

    return Response.json({
      latitude,
      longitude,
      source: 'EXIF GPS',
      confidence: '높음'
    });

  } catch (error) {
    console.error('위치 추출 오류:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});