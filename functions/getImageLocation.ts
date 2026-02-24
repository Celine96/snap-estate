import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * 이미지 파일에서 EXIF GPS 데이터 추출
 * - EXIF GPS 데이터가 있으면 정확한 좌표 반환
 * - 없으면 AI로 위치 추정 (fallback)
 * @param {string} imageUrl - 이미지 URL
 */

// EXIF IFD에서 GPS 관련 태그 파싱
function parseExifGPS(bytes: Uint8Array): { latitude: number; longitude: number } | null {
  // JPEG 시그니처 확인 (FF D8)
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;

  // APP1 마커 찾기 (FF E1)
  let offset = 2;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xFF) break;
    const marker = bytes[offset + 1];
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];

    if (marker === 0xE1) {
      // EXIF 헤더 확인: "Exif\0\0"
      const exifStr = String.fromCharCode(...bytes.slice(offset + 4, offset + 10));
      if (exifStr !== 'Exif\0\0') {
        offset += 2 + segmentLength;
        continue;
      }

      const tiffStart = offset + 10;
      const isLittleEndian = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;

      const readU16 = (pos: number) => {
        const p = tiffStart + pos;
        return isLittleEndian
          ? bytes[p] | (bytes[p + 1] << 8)
          : (bytes[p] << 8) | bytes[p + 1];
      };

      const readU32 = (pos: number) => {
        const p = tiffStart + pos;
        return isLittleEndian
          ? bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24)
          : (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
      };

      const readRational = (pos: number) => {
        const numerator = readU32(pos);
        const denominator = readU32(pos + 4);
        return denominator !== 0 ? numerator / denominator : 0;
      };

      // IFD0 시작
      const ifd0Offset = readU32(4);
      const ifd0Count = readU16(ifd0Offset);

      // GPS IFD 오프셋 찾기 (태그 0x8825)
      let gpsIfdOffset: number | null = null;
      for (let i = 0; i < ifd0Count; i++) {
        const entryOffset = ifd0Offset + 2 + i * 12;
        const tag = readU16(entryOffset);
        if (tag === 0x8825) {
          gpsIfdOffset = readU32(entryOffset + 8);
          break;
        }
      }

      if (gpsIfdOffset === null) return null;

      // GPS IFD 파싱
      const gpsCount = readU16(gpsIfdOffset);
      let latRef = '', lonRef = '';
      let latValues: number[] | null = null;
      let lonValues: number[] | null = null;

      for (let i = 0; i < gpsCount; i++) {
        const entryOffset = gpsIfdOffset + 2 + i * 12;
        const tag = readU16(entryOffset);
        const valueOffset = readU32(entryOffset + 8);

        switch (tag) {
          case 0x0001: // GPSLatitudeRef (N/S)
            latRef = String.fromCharCode(bytes[tiffStart + entryOffset + 8]);
            break;
          case 0x0002: // GPSLatitude (3 rationals)
            latValues = [
              readRational(valueOffset),
              readRational(valueOffset + 8),
              readRational(valueOffset + 16),
            ];
            break;
          case 0x0003: // GPSLongitudeRef (E/W)
            lonRef = String.fromCharCode(bytes[tiffStart + entryOffset + 8]);
            break;
          case 0x0004: // GPSLongitude (3 rationals)
            lonValues = [
              readRational(valueOffset),
              readRational(valueOffset + 8),
              readRational(valueOffset + 16),
            ];
            break;
        }
      }

      if (latValues && lonValues) {
        let latitude = latValues[0] + latValues[1] / 60 + latValues[2] / 3600;
        let longitude = lonValues[0] + lonValues[1] / 60 + lonValues[2] / 3600;
        if (latRef === 'S') latitude = -latitude;
        if (lonRef === 'W') longitude = -longitude;

        if (latitude !== 0 && longitude !== 0 && !isNaN(latitude) && !isNaN(longitude)) {
          return { latitude, longitude };
        }
      }

      return null;
    }

    offset += 2 + segmentLength;
  }

  return null;
}

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

    // EXIF GPS 데이터 파싱
    const gpsData = parseExifGPS(bytes);

    if (gpsData) {
      return Response.json({
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        source: 'EXIF GPS',
        confidence: '높음'
      });
    }

    // EXIF에서 GPS를 못 찾았다면 AI로 위치 추정
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

    return Response.json({
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      source: locationData.source || 'AI 추정',
      confidence: locationData.confidence || '보통'
    });

  } catch (error) {
    console.error('위치 추출 오류:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
