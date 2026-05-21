import { CustomerPoint } from "./types.ts";
import { getHanoiDistrictsGeoJSON } from "./hanoi-districts-cache.ts";
import { isPointInPolygon, generatePointInsidePolygon } from "./geoproc.ts";

/**
 * In-memory store for customer points.
 * Generated deterministically once so that the data is stable across API calls.
 */
let inMemoryRawPoints: CustomerPoint[] = [];
let inMemoryCustomerPointsOld: CustomerPoint[] = [];
let inMemoryCustomerPointsNew: CustomerPoint[] = [];

/**
 * Generates a realistic set of customers distributed across Hanoi's old districts.
 * To demonstrate real business operations, some districts will be dense, others sparse, and some empty.
 */
function generateMockCustomers(): CustomerPoint[] {
  const points: CustomerPoint[] = [];
  const districtsGeoJSON = getHanoiDistrictsGeoJSON();
  
  // A table of weights for the districts to generate uneven, realistic density distributions indexed by real official administrative codes.
  const weights: Record<string, number> = {
    "001": 18, // Ba Đình - high
    "002": 25, // Hoàn Kiếm - very high density
    "003": 12, // Tây Hồ - medium
    "004": 10, // Long Biên - medium
    "005": 22, // Cầu Giấy - high
    "006": 32, // Đống Đa - very high
    "007": 28, // Hai Bà Trưng - very high
    "008": 15, // Hoàng Mai - medium
    "009": 19, // Thanh Xuân - high
    "016": 2,  // Sóc Sơn - very low
    "017": 4,  // Đông Anh - low
    "018": 5,  // Gia Lâm - low
    "019": 13, // Nam Từ Liêm - high
    "020": 8,  // Thanh Trì - low
    "021": 11, // Bắc Từ Liêm - medium
    "250": 2,  // Mê Linh - very low
    "268": 11, // Hà Đông - medium
    "269": 3,  // Sơn Tây - very low
    "274": 4,  // Hoài Đức - low
    "276": 2,  // Thạch Thất - very low
    // Other districts will be left with 0 customers to test empty-state UI handling
  };

  const vietnameseLastNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô"];
  const vietnameseMiddleNames = ["Văn", "Thị", "Hồng", "Minh", "Quốc", "Hữu", "Anh", "Đức", "Thành", "Ngọc", "Duy"];
  const vietnameseFirstNames = ["Nam", "Trang", "Hùng", "Lan", "Hải", "Tuấn", "Vy", "Hòa", "Huy", "Linh", "Dương", "Phong", "Sơn", "Tâm"];
  const streets = ["Hàng Ngang", "Hàng Đào", "Phố Huế", "Hàng Bông", "Lê Duẩn", "Giải Phóng", "Cầu Giấy", "Nguyễn Trãi", "Xuân Thủy", "Phạm Văn Đồng", "Nguyễn Chí Thanh", "Kim Mã", "Đường Láng", "Bưởi", "Lạc Long Quân", "Âu Cơ"];

  let pointSeed = 999;

  // 1. Generate Hanoi internal customers
  districtsGeoJSON.features.forEach((feature) => {
    const dId = feature.properties.districtId;
    const dName = feature.properties.districtName;
    const count = weights[dId] || 0;
    const polygon = feature.geometry.coordinates[0];

    for (let i = 0; i < count; i++) {
      pointSeed++;
      // Get a deterministic location inside the district polygon
      const [lng, lat] = generatePointInsidePolygon(polygon, pointSeed);
      
      const cnIdx = pointSeed % vietnameseLastNames.length;
      const mnIdx = (pointSeed + 3) % vietnameseMiddleNames.length;
      const fnIdx = (pointSeed + 7) % vietnameseFirstNames.length;
      const stIdx = pointSeed % streets.length;
      
      const customerName = `${vietnameseLastNames[cnIdx]} ${vietnameseMiddleNames[mnIdx]} ${vietnameseFirstNames[fnIdx]}`;
      const addressText = `Số ${((pointSeed % 88) + 1)}, ${streets[stIdx]}, ${dName}, Hà Nội`;
      
      const contactId = `CC-${10000 + pointSeed}`;
      // Introduce duplicates (e.g., occasional shared accounts or double snapshots) to test deduplication
      const isDuplicate = i > 0 && i % 6 === 0;
      const customerCode = isDuplicate 
        ? `CUST-${8000 + i}` // Shared customer code
        : `CUST-${10000 + pointSeed}`;

      points.push({
        pointId: `PT-${pointSeed}`,
        customerContactId: isDuplicate ? `CC-${10000 + pointSeed - 1}` : contactId,
        customerCode,
        customerName,
        addressText,
        lat,
        lng,
        source: pointSeed % 3 === 0 ? "order_customer_snapshots" : "customer_contacts"
      });
    }
  });

  // 2. Generate "Outside/Unassigned" customers (e.g., coordinates placed in neighboring provinces like Vĩnh Phúc, Hưng Yên or Bac Ninh)
  const outsideLocs = [
    { name: "Khách hàng Vĩnh Phúc", lat: 21.3117, lng: 105.5947 }, // Vĩnh Phúc
    { name: "Khách hàng Bắc Ninh", lat: 21.1833, lng: 106.0500 }, // Bắc Ninh
    { name: "Khách hàng Hưng Yên", lat: 20.8444, lng: 106.0125 }, // Hưng Yên
    { name: "Khách hàng Hà Nam", lat: 20.5401, lng: 105.9221 }   // Hà Nam
  ];

  outsideLocs.forEach((loc, idx) => {
    pointSeed++;
    points.push({
      pointId: `PT-OUT-${idx}`,
      customerContactId: `CC-OUT-${idx}`,
      customerCode: `CUST-OUT-${idx}`,
      customerName: loc.name,
      addressText: `Địa chỉ ngoài Hà Nội (${loc.name})`,
      lat: loc.lat,
      lng: loc.lng,
      source: "customer_contacts"
    });
  });

  return points;
}

/**
 * Deduplicates, assigns districts, and return customer points.
 * 
 * WHY IS DEDUPLICATION RELEVANT:
 * In corporate billing and dispatch software, customers can place multiple orders under slightly different 
 * formats or address snapshots. To calculate unique client density, we must deduplicate.
 * 
 * DEDUPLICATION PRECEDENCE RULES:
 * 1. customerContactId: Matches stable profiles logged in our master contact database.
 * 2. customerCode: Secondary identifier representing the primary corporate billing entity code.
 * 3. pointId: Ultimate fallback if profiles are not linked.
 */
export function loadCustomerPoints(mode: "old" | "new" = "old"): CustomerPoint[] {
  if (mode === "old") {
    if (inMemoryCustomerPointsOld.length > 0) {
      return inMemoryCustomerPointsOld;
    }
  } else {
    if (inMemoryCustomerPointsNew.length > 0) {
      return inMemoryCustomerPointsNew;
    }
  }

  const rawPoints = inMemoryRawPoints.length > 0 ? inMemoryRawPoints : generateMockCustomers();
  const districts = getHanoiDistrictsGeoJSON(mode).features;

  // Categorize points by district first
  const mappedPoints = rawPoints.map((point) => {
    // Find matching district index
    const matchingDistrict = districts.find((dist) => {
      const polygon = dist.geometry.coordinates[0];
      return isPointInPolygon([point.lng, point.lat], polygon);
    });

    return {
      ...point,
      districtId: matchingDistrict ? matchingDistrict.properties.districtId : null
    };
  });

  // Implement the required deduplication logic
  const seenContactIds = new Set<string>();
  const seenCustomerCodes = new Set<string>();
  const seenPointIds = new Set<string>();

  const dedupedPoints: CustomerPoint[] = [];

  mappedPoints.forEach((pt) => {
    // 1. Check customerContactId uniqueness
    if (pt.customerContactId) {
      if (seenContactIds.has(pt.customerContactId)) {
        return; // Ignore duplicate contact
      }
    }

    // 2. Check customerCode uniqueness
    if (pt.customerCode) {
      if (seenCustomerCodes.has(pt.customerCode)) {
        return; // Ignore duplicate customer code
      }
    }

    // 3. Check pointId uniqueness
    if (seenPointIds.has(pt.pointId)) {
      return; // Ignore duplicate point ID
    }

    // Mark as seen
    if (pt.customerContactId) seenContactIds.add(pt.customerContactId);
    if (pt.customerCode) seenCustomerCodes.add(pt.customerCode);
    seenPointIds.add(pt.pointId);

    dedupedPoints.push(pt);
  });

  if (mode === "old") {
    inMemoryCustomerPointsOld = dedupedPoints;
    return inMemoryCustomerPointsOld;
  } else {
    inMemoryCustomerPointsNew = dedupedPoints;
    return inMemoryCustomerPointsNew;
  }
}

/**
 * Force manual update/insertion of customer points
 */
export function setCustomerPoints(points: CustomerPoint[]): void {
  inMemoryRawPoints = points;
  inMemoryCustomerPointsOld = [];
  inMemoryCustomerPointsNew = [];
}
