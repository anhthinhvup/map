import { isPointInPolygon, generateDistrictPolygon } from "../lib/customer-density/geoproc.ts";
import { getColorBucket, buildDistrictGeoJSON } from "../lib/customer-density/build-district-geojson.ts";
import { loadCustomerPoints, setCustomerPoints } from "../lib/customer-density/load-customer-points.ts";
import { CustomerPoint } from "../lib/customer-density/types.ts";

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ TEST PASSED: ${name}`);
  } catch (err: any) {
    console.error(`❌ TEST FAILED: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log("=== STARTING CUSTOMER DENSITY TEST SUITE ===");

// 1. Test Point-In-Polygon containment logic
runTest("Geospatial Point-in-Polygon ray-casting containment", () => {
  // A simple rectangle from (0,0) to (10,10)
  const polygon: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0] // closed loop
  ];

  const insidePoint: [number, number] = [5, 5];
  const outsidePoint: [number, number] = [12, 12];
  const borderPoint: [number, number] = [10, 5];

  if (!isPointInPolygon(insidePoint, polygon)) {
    throw new Error("Point (5,5) should be inside polygon.");
  }

  if (isPointInPolygon(outsidePoint, polygon)) {
    throw new Error("Point (12,12) should be outside polygon.");
  }
});

// 2. Test dynamic dodecagon generation
runTest("Geospatial Dodecagon boundary generator", () => {
  const coords = generateDistrictPolygon(105.8, 21.0, 5.0, "D001");
  
  // Dodecagon of 12 vertices, closed loop makes it 13 coordinates
  if (coords.length !== 13) {
    throw new Error(`Expected 13 boundary points, got ${coords.length}`);
  }

  // Ensure first and last coordinate close the loop exactly
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw new Error("Dodecagon polygon loop is not closed.");
  }
});

// 3. Test Choropleth Classification Intervals
runTest("Choropleth Color Bucket classification thresholds", () => {
  if (getColorBucket(0) !== 0) throw new Error("0 customers should map to Bucket 0");
  if (getColorBucket(3) !== 1) throw new Error("3 customers should map to Bucket 1");
  if (getColorBucket(8) !== 2) throw new Error("8 customers should map to Bucket 2");
  if (getColorBucket(15) !== 3) throw new Error("15 customers should map to Bucket 3");
  if (getColorBucket(25) !== 4) throw new Error("25 customers should map to Bucket 4");
});

// 4. Test Customer Deduplication precedence mechanics
runTest("Customer deduplication precedence and stability rules", () => {
  const mockRawData: CustomerPoint[] = [
    {
      pointId: "PT-01",
      customerContactId: "CC-A",
      customerCode: "CODE-1",
      customerName: "Client Unique A",
      addressText: "Ha Noi",
      lat: 21.02,
      lng: 105.85,
      source: "customer_contacts"
    },
    // Duplicate 1: same contact id, different code (should be filtered out)
    {
      pointId: "PT-02",
      customerContactId: "CC-A",
      customerCode: "CODE-2",
      customerName: "Client Duplicate A1",
      addressText: "Ha Noi",
      lat: 21.03,
      lng: 105.86,
      source: "customer_contacts"
    },
    // Duplicate 2: same code, different contact id (should be filtered out)
    {
      pointId: "PT-03",
      customerContactId: "CC-B",
      customerCode: "CODE-1",
      customerName: "Client Duplicate A2",
      addressText: "Ha Noi",
      lat: 21.04,
      lng: 105.87,
      source: "customer_contacts"
    },
    {
      pointId: "PT-04",
      customerContactId: "CC-C",
      customerCode: "CODE-3",
      customerName: "Client Unique B",
      addressText: "Ha Noi",
      lat: 21.01,
      lng: 105.82,
      source: "customer_contacts"
    }
  ];

  setCustomerPoints(mockRawData);
  const dedupedResult = loadCustomerPoints();

  // PT-01 is loaded.
  // PT-02 shares contact id (CC-A) with PT-01, gets filtered out.
  // PT-03 shares customer code (CODE-1) with PT-01, gets filtered out.
  // PT-04 is unique, loaded.
  // Total output count expected: 2
  if (dedupedResult.length !== 2) {
    throw new Error(`Expected deduped list of length 2, got ${dedupedResult.length}`);
  }

  const pids = dedupedResult.map((p) => p.pointId);
  if (!pids.includes("PT-01") || !pids.includes("PT-04")) {
    throw new Error(`Deduplication fetched wrong unique records: ${JSON.stringify(pids)}`);
  }
});

// 5. Test Enrichment of District properties GeoJSON and Summary schemas
runTest("District aggregation & Hanoi total summaries calculation", () => {
  const { geojson, summary, rankings } = buildDistrictGeoJSON();

  // Verify Summary Schema keys
  if (typeof summary.totalCustomers !== "number") throw new Error("summary.totalCustomers should be a number");
  if (typeof summary.totalDistrictsWithCustomers !== "number") throw new Error("summary.totalDistrictsWithCustomers should be a number");
  if (!summary.topDistrictName) throw new Error("summary.topDistrictName should be a non-empty string");

  // Verify GeoJSON Features properties format
  if (geojson.type !== "FeatureCollection") throw new Error("Expected FeatureCollection GeoJSON output");
  const firstFeature = geojson.features[0];
  if (!firstFeature.properties.districtId || firstFeature.properties.customerCount === undefined) {
    throw new Error("Feature properties lack district ID or aggregated customer count");
  }

  // Verify rankings sorted descending
  for (let i = 0; i < rankings.length - 1; i++) {
    if (rankings[i].customerCount < rankings[i + 1].customerCount) {
      throw new Error("Rankings list is not sorted in descending customer count format");
    }
  }
});

console.log("=== ALL TESTS COMPLETED SUCCESSFULLY ===");
