import { GeoJSONFeatureCollection } from "./hanoi-districts-cache.ts";
import { getHanoiDistrictsGeoJSON } from "./hanoi-districts-cache.ts";
import { loadCustomerPoints } from "./load-customer-points.ts";
import { HanoiSummary, DistrictSummary } from "./types.ts";

/**
 * Calculates readable, stable, high-contrast color buckets for Hanio districts or subdistricts.
 * 5 levels: Very Low (0), Low (1), Medium (2), High (3), Very High (4)
 */
export function getColorBucket(customerCount: number, mode: "old" | "new" = "old"): number {
  if (customerCount === 0) return 0;
  if (mode === "new") {
    // Subdistricts have much smaller customer counts per area, so we scale buckets accordingly
    if (customerCount === 1) return 1;
    if (customerCount === 2) return 2;
    if (customerCount <= 5) return 3;
    return 4;
  }
  if (customerCount <= 4) return 1;
  if (customerCount <= 11) return 2;
  if (customerCount <= 20) return 3;
  return 4;
}

/**
 * Computes administrative metrics and outputs the enriched GeoJSON FeatureCollection map layer.
 */
export function buildDistrictGeoJSON(mode: "old" | "new" = "old"): {
  geojson: GeoJSONFeatureCollection;
  summary: HanoiSummary;
  rankings: DistrictSummary[];
} {
  const baseGeoJSON = getHanoiDistrictsGeoJSON(mode);
  const dedupedPoints = loadCustomerPoints(mode);

  // 1. Calculate counts per district
  const countsByDistrict: Record<string, number> = {};
  
  // Initialize all with 0
  baseGeoJSON.features.forEach((feat) => {
    countsByDistrict[feat.properties.districtId] = 0;
  });

  let hanoiCustomersCount = 0;
  let outsideCustomersCount = 0;

  dedupedPoints.forEach((point) => {
    if (point.districtId) {
      countsByDistrict[point.districtId] = (countsByDistrict[point.districtId] || 0) + 1;
      hanoiCustomersCount++;
    } else {
      outsideCustomersCount++;
    }
  });

  const totalHanoiDistricts = baseGeoJSON.features.length;

  // 2. Build the output GeoJSON with properties
  let totalDistrictsWithCustomers = 0;
  let topDistrictName = "N/A";
  let topDistrictCount = -1;

  const rankings: DistrictSummary[] = [];

  const enrichedFeatures = baseGeoJSON.features.map((feat) => {
    const dId = feat.properties.districtId;
    const count = countsByDistrict[dId] || 0;
    const share = hanoiCustomersCount > 0 ? (count / hanoiCustomersCount) * 100 : 0;
    const bucket = getColorBucket(count, mode);

    if (count > 0) {
      totalDistrictsWithCustomers++;
    }

    if (count > topDistrictCount) {
      topDistrictCount = count;
      topDistrictName = feat.properties.districtName;
    }

    const summaryItem: DistrictSummary = {
      districtId: dId,
      districtName: feat.properties.districtName,
      customerCount: count,
      shareOfHanoi: parseFloat(share.toFixed(2)),
      colorBucket: bucket
    };
    rankings.push(summaryItem);

    return {
      ...feat,
      properties: {
        ...feat.properties,
        customerCount: count,
        shareOfHanoi: parseFloat(share.toFixed(2)),
        colorBucket: bucket
      }
    };
  });

  // Sort rankings by count descending
  rankings.sort((a, b) => b.customerCount - a.customerCount);

  const emptyDistrictsCount = totalHanoiDistricts - totalDistrictsWithCustomers;

  const summary: HanoiSummary = {
    totalCustomers: hanoiCustomersCount,
    totalDistrictsCount: totalHanoiDistricts,
    totalDistrictsWithCustomers,
    topDistrictName: topDistrictCount > 0 ? topDistrictName : "Không có",
    topDistrictCount: topDistrictCount > 0 ? topDistrictCount : 0,
    emptyDistrictsCount,
    outsideCustomersCount
  };

  const enrichedGeoJSON: GeoJSONFeatureCollection = {
    type: "FeatureCollection",
    features: enrichedFeatures,
  };

  return {
    geojson: enrichedGeoJSON,
    summary,
    rankings
  };
}
