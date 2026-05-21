import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";

// Load environment variables
dotenv.config();

// Direct imports of our business logic helpers
import { buildDistrictGeoJSON } from "./src/lib/customer-density/build-district-geojson.ts";
import { loadCustomerPoints } from "./src/lib/customer-density/load-customer-points.ts";
import { updateHanoiDistrictsCache, getHanoiDistrictsGeoJSON, convertDVHCVNToGeoJSON, convertDVHCVNWardsToGeoJSON } from "./src/lib/customer-density/hanoi-districts-cache.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Load and cache authentic Hanoi district and ward boundaries from DVHCVN on server startup
  console.log("Loading authentic Hanoi district boundaries from dvhcvn...");
  fetch("https://raw.githubusercontent.com/daohoangson/dvhcvn/master/data/gis/01.json")
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      const geojson = convertDVHCVNToGeoJSON(data);
      updateHanoiDistrictsCache(geojson, "old");
      console.log(`Successfully loaded and cached ${geojson.features.length} real Hanoi district boundaries from dvhcvn!`);

      // Calculate and cache Ward/Commune level GeoJSON map (Detailed Phường/Xã)
      if (Array.isArray(data.level2s)) {
        console.log("Loading Hanoi subdistricts/wards detailed boundaries from dvhcvn files in parallel...");
        const level2s = data.level2s;
        
        // Fetch ward details for each district in parallel
        const fetchPromises = level2s.map(async (dist: any) => {
          try {
            const distRes = await fetch(`https://raw.githubusercontent.com/daohoangson/dvhcvn/master/data/gis/01/${dist.level2_id}.json`);
            if (!distRes.ok) return [];
            const distData = await distRes.json();
            return Array.isArray(distData.level3s) ? distData.level3s : [];
          } catch (err) {
            console.warn(`Failed to fetch subdistricts for district ${dist.level2_id}:`, err);
            return [];
          }
        });

        const results = await Promise.all(fetchPromises);
        const allWards = results.flat();
        
        if (allWards.length > 0) {
          const wardsGeoJSON = convertDVHCVNWardsToGeoJSON(allWards);
          updateHanoiDistrictsCache(wardsGeoJSON, "new");
          console.log(`Successfully loaded and cached ${wardsGeoJSON.features.length} authentic Hanoi ward/commune boundaries from dvhcvn!`);
        }
      }
    })
    .catch((err) => {
      console.warn("Could not load real boundaries from dvhcvn, falling back to procedural generators. Error:", err.message);
    });

  // JSON request body parser
  app.use(express.json());

  // 1. API: Summary statistics & rankings
  app.get("/api/customer-density/summary", (req, res) => {
    try {
      const mode = (req.query.mode === "new" ? "new" : "old") as "old" | "new";
      const { summary, rankings } = buildDistrictGeoJSON(mode);
      res.json({
        success: true,
        summary,
        rankings
      });
    } catch (error: any) {
      console.error("API Error (/api/customer-density/summary):", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 2. API: District GeoJSON Choropleth mapping
  app.get("/api/customer-density/geojson", (req, res) => {
    try {
      const mode = (req.query.mode === "new" ? "new" : "old") as "old" | "new";
      const { geojson } = buildDistrictGeoJSON(mode);
      res.json(geojson);
    } catch (error: any) {
      console.error("API Error (/api/customer-density/geojson):", error);
      res.status(550).json({ success: false, error: error.message });
    }
  });

  // 3. API: Exact Customer coordinates (with district and boundary/view limitations)
  app.get("/api/customer-density/points", (req, res) => {
    try {
      const { districtId, minLng, maxLng, minLat, maxLat, mode: queryMode } = req.query;
      const mode = (queryMode === "new" ? "new" : "old") as "old" | "new";
      let points = loadCustomerPoints(mode);

      // Filter by district if requested
      if (districtId) {
        points = points.filter((pt) => pt.districtId === districtId);
      }

      // Filter by bounding box if requested (e.g. MapLibre viewport queries)
      if (minLng && maxLng && minLat && maxLat) {
        const xMin = parseFloat(minLng as string);
        const xMax = parseFloat(maxLng as string);
        const yMin = parseFloat(minLat as string);
        const yMax = parseFloat(maxLat as string);
        points = points.filter(
          (pt) => pt.lng >= xMin && pt.lng <= xMax && pt.lat >= yMin && pt.lat <= yMax
        );
      }

      res.json({
        success: true,
        count: points.length,
        points
      });
    } catch (error: any) {
      console.error("API Error (/api/customer-density/points):", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 4. API: Secure boundary refresh from GeoVina API (Server-Side only)
  app.post("/api/customer-density/boundaries/refresh", async (req, res) => {
    console.log("Boundary refresh endpoint hit.");
    const apiKey = process.env.GEOVINA_API_KEY || "gvn_38c4738795dafb6dbd47ea2a067cedc570c20924";

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: "Missing GeoVina API Key. Please define GEOVINA_API_KEY in the Secrets / Environment panel."
      });
    }

    let geojsonData: any = null;
    let usedFallback = false;
    let fallbackReason = "";

    try {
      const headers: Record<string, string> = {
        "X-Api-Key": apiKey,
        "Accept": "application/json"
      };

      console.log("Contacting GeoVina old-districts catalog...");
      // Try to load from geovina.io.vn
      const districtsRes = await fetch("https://geovina.io.vn/old-districts?province_id=01", { headers });
      
      if (!districtsRes.ok) {
        throw new Error(`GeoVina catalog responded with status ${districtsRes.status}`);
      }

      const districtsData = await districtsRes.json();
      const districts = districtsData.data || districtsData;

      if (!Array.isArray(districts) || districts.length === 0) {
        throw new Error("Invalid or empty district list returned by GeoVina API.");
      }

      console.log(`Successfully fetched ${districts.length} districts from GeoVina. Downloading boundary geometries...`);

      // GeoVina boundaries cannot load all at once. Limit to batches of 3 IDs per call.
      const districtIds = districts.map((d: any) => d.id || d.districtId).filter(Boolean);
      const allFetchedFeatures: any[] = [];

      for (let i = 0; i < districtIds.length; i += 3) {
        const batch = districtIds.slice(i, i + 3);
        const batchUrl = `https://geovina.io.vn/boundaries?type=district&district_ids=${batch.join(",")}`;
        console.log(`Fetching batch ${i / 3 + 1}: ${batchUrl}`);

        const boundaryRes = await fetch(batchUrl, { headers });
        if (!boundaryRes.ok) {
          console.warn(`Failed to fetch boundary batch: ${batch.join(",")}`);
          continue;
        }

        const boundaryData = await boundaryRes.json();
        const features = boundaryData.features || (boundaryData.data && boundaryData.data.features) || [];
        if (Array.isArray(features)) {
          allFetchedFeatures.push(...features);
        }
      }

      if (allFetchedFeatures.length === 0) {
        throw new Error("Failed to fetch any boundary geometries from GeoVina.");
      }

      // Reformat / Normalize GeoVina boundary features to our format
      const normalizedFeatures = allFetchedFeatures.map((f: any) => {
        const props = f.properties || {};
        const dId = props.id || props.districtId || props.district_id || f.id;
        const dName = props.name || props.districtName || props.district_name || `Quân/Huyện ${dId}`;
        
        return {
          type: "Feature",
          id: dId,
          properties: {
            districtId: dId,
            districtName: dName.startsWith("Quận") || dName.startsWith("Huyện") || dName.startsWith("Thị xã") ? dName : `Quận/Huyện ${dName}`,
            centerLng: props.centerLng || props.centroid_lng || 105.85,
            centerLat: props.centerLat || props.centroid_lat || 21.02,
          },
          geometry: f.geometry
        };
      });

      geojsonData = {
        type: "FeatureCollection",
        features: normalizedFeatures
      };
    } catch (err: any) {
      console.warn("GeoVina live synchronization failed, running high-durability local compilation fallback:", err.message);
      usedFallback = true;
      fallbackReason = err.message;
      
      // Obtain handcrafted high-resolution boundaries (old mode)
      geojsonData = getHanoiDistrictsGeoJSON("old");
    }

    try {
      updateHanoiDistrictsCache(geojsonData);

      res.json({
        success: true,
        message: usedFallback
          ? `Đã khôi phục ranh giới nội địa Hà Nội chuẩn từ bộ nhớ dự phòng (Lý do: GeoVina API offline - ${fallbackReason}).`
          : `Đồng bộ ranh giới thành công từ cổng thông tin địa lý GeoVina (${geojsonData.features.length} khu vực).`,
        featureCount: geojsonData.features.length,
        fallback: usedFallback
      });
    } catch (cacheErr: any) {
      console.error("Cache update exception:", cacheErr);
      res.status(500).json({
        success: false,
        error: `Lỗi cập nhật bộ nhớ đệm: ${cacheErr.message}`
      });
    }
  });

  // 5. Integrate Vite Dev Server Middleware or Production Static Serve
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT MODE with Vite Middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION MODE");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started. Running on http://localhost:${PORT}`);
  });
}

startServer();
