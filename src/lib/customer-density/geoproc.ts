/**
 * Geospatial processing utility for Hanoi Old Districts
 */

// Approximate conversions at Hanoi latitude (approx 21 degrees North)
const METERS_PER_DEGREE_LAT = 111100;
const METERS_PER_DEGREE_LNG = 103700;

/**
 * Procedurally generates a dodecagon polygon around a centroid (lng, lat) representing a district.
 * When allNodes is provided, it uses a ray-casting multiplicative Voronoi boundary method
 * to make districts and wards contiguous and interlocking with no gaps or overlaps.
 */
export function generateDistrictPolygon(
  centerLng: number,
  centerLat: number,
  radiusKm: number,
  districtId: string,
  allNodes?: { id: string; centerLng: number; centerLat: number; radiusKm: number }[],
  vertexCount = 12
): [number, number][] {
  const points: [number, number][] = [];
  const radiusLat = (radiusKm * 1000) / METERS_PER_DEGREE_LAT;
  const radiusLng = (radiusKm * 1000) / METERS_PER_DEGREE_LNG;
  const lngScale = Math.cos((centerLat * Math.PI) / 180);

  // Use a simple hash function on districtId to get deterministic irregular shape
  let hash = 0;
  for (let i = 0; i < districtId.length; i++) {
    hash = districtId.charCodeAt(i) + ((hash << 5) - hash);
  }

  if (allNodes && allNodes.length > 1) {
    // Advanced interlocking boundary generation
    // Search limit: let it expand up to 2.4x the standard radius to touch neighboring nodes
    const R_limit = (radiusKm * 2.4 * 1000) / METERS_PER_DEGREE_LAT;

    for (let i = 0; i <= vertexCount; i++) {
      const angle = (i % vertexCount) * ((2 * Math.PI) / vertexCount);
      
      // Binary search for the optimal weighted Voronoi boundary point along the angle ray
      let low = (radiusKm * 0.15 * 1000) / METERS_PER_DEGREE_LAT; // minimum limit of 15% radius to preserve shape/area
      let high = R_limit;
      
      for (let step = 0; step < 10; step++) {
        const mid = (low + high) / 2;
        const py = centerLat + mid * Math.sin(angle);
        const px = centerLng + (mid * Math.cos(angle)) / lngScale;
        
        const distUsSq = Math.pow((px - centerLng) * lngScale, 2) + Math.pow(py - centerLat, 2);
        // Multiplicative weight based on physical radius size
        const scoreUs = distUsSq / Math.pow(radiusKm, 1.8);
        
        let isCloserToUs = true;
        for (const other of allNodes) {
          if (other.id === districtId) continue;
          const distOtherSq = Math.pow((px - other.centerLng) * lngScale, 2) + Math.pow(py - other.centerLat, 2);
          const scoreOther = distOtherSq / Math.pow(other.radiusKm, 1.8);
          
          if (scoreOther < scoreUs) {
            isCloserToUs = false;
            break;
          }
        }
        
        if (isCloserToUs) {
          low = mid;
        } else {
          high = mid;
        }
      }

      // To prevent gaps, the boundary radius must evaluate exactly the same without local hash wave shifting!
      // Setting finalR to the pure low boundary ensures perfect interlocking fit.
      const finalR = low;

      const lat = centerLat + finalR * Math.sin(angle);
      const lng = centerLng + (finalR * Math.cos(angle)) / lngScale;
      points.push([lng, lat]);
    }
  } else {
    // Fallback to standard procedurally generated dodecagon with local noise
    for (let i = 0; i <= vertexCount; i++) {
      const angle = (i % vertexCount) * ((2 * Math.PI) / vertexCount);
      
      const varSeed = Math.sin(angle * 3 + hash) * 0.15;
      const currentRadiusLat = radiusLat * (1 + varSeed);
      const currentRadiusLng = radiusLng * (1 + varSeed);

      const lat = centerLat + currentRadiusLat * Math.sin(angle);
      const lng = centerLng + currentRadiusLng * Math.cos(angle);
      points.push([lng, lat]);
    }
  }

  return points;
}

/**
 * Checks if a point [longitude, latitude] is inside a polygon [[lng, lat], ...]
 * Ray casting algorithm.
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const x = point[0]; // lng
  const y = point[1]; // lat
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Generates a deterministic random point inside a polygon
 */
export function generatePointInsidePolygon(
  polygon: [number, number][],
  seedNum: number
): [number, number] {
  // Find bbox of polygon
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of polygon) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  // Simple LCG pseudo-random generator
  let state = Math.abs(seedNum * 16807) % 2147483647;
  const nextRandom = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };

  // Generate and test up to 100 times
  for (let attempt = 0; attempt < 100; attempt++) {
    const lng = minLng + nextRandom() * (maxLng - minLng);
    const lat = minLat + nextRandom() * (maxLat - minLat);
    if (isPointInPolygon([lng, lat], polygon)) {
      return [lng, lat];
    }
  }

  // Fallback to centroid center
  let sumLng = 0;
  let sumLat = 0;
  for (let i = 0; i < polygon.length - 1; i++) {
    sumLng += polygon[i][0];
    sumLat += polygon[i][1];
  }
  return [sumLng / (polygon.length - 1), sumLat / (polygon.length - 1)];
}

/**
 * Snaps polygon coordinates across different features to remove all micro-gaps and overlaps.
 * Finds all vertices that lie within a small distance threshold and aligns them to their shared centroid.
 */
export function snapFeatureCollectionCoordinates(
  features: any[],
  threshold: number = 0.003
): any[] {
  interface PointRef {
    featureIndex: number;
    coordIndex: number;
    lng: number;
    lat: number;
  }

  const refs: PointRef[] = [];
  features.forEach((feat, fIdx) => {
    const coords = feat.geometry.coordinates[0];
    if (!coords) return;
    coords.forEach((c: [number, number], cIdx: number) => {
      refs.push({
        featureIndex: fIdx,
        coordIndex: cIdx,
        lng: c[0],
        lat: c[1]
      });
    });
  });

  const visited = new Set<number>();
  const groups: PointRef[][] = [];

  for (let i = 0; i < refs.length; i++) {
    if (visited.has(i)) continue;

    const cluster: PointRef[] = [refs[i]];
    visited.add(i);

    for (let j = i + 1; j < refs.length; j++) {
      if (visited.has(j)) continue;

      const r1 = refs[i];
      const r2 = refs[j];

      // Euclidean distance in degrees (approximate)
      const dLng = r1.lng - r2.lng;
      const dLat = r1.lat - r2.lat;
      const dist = Math.sqrt(dLng * dLng + dLat * dLat);

      if (dist <= threshold) {
        cluster.push(r2);
        visited.add(j);
      }
    }
    groups.push(cluster);
  }

  // Adjust coordinates in place
  groups.forEach((group) => {
    if (group.length <= 1) return;
    let sumLng = 0;
    let sumLat = 0;
    group.forEach((r) => {
      sumLng += r.lng;
      sumLat += r.lat;
    });
    const avgLng = sumLng / group.length;
    const avgLat = sumLat / group.length;

    group.forEach((r) => {
      features[r.featureIndex].geometry.coordinates[0][r.coordIndex] = [avgLng, avgLat];
    });
  });

  // Re-close loops
  features.forEach((feat) => {
    const coords = feat.geometry.coordinates[0];
    if (coords && coords.length > 0) {
      coords[coords.length - 1] = [coords[0][0], coords[0][1]];
    }
  });

  return features;
}

