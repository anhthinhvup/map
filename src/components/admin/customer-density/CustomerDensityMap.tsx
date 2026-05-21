import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CustomerPoint } from "../../../lib/customer-density/types.ts";
import { Info, Map, Eye, EyeOff, Maximize2 } from "lucide-react";

interface Props {
  geojson: any;
  points: CustomerPoint[];
  selectedDistrictId: string | null;
  onSelectDistrict: (districtId: string | null) => void;
  hoveredDistrict: any;
  setHoveredDistrict: (district: any) => void;
  mode?: "old" | "new";
}

export default function CustomerDensityMap({
  geojson,
  points,
  selectedDistrictId,
  onSelectDistrict,
  hoveredDistrict,
  setHoveredDistrict,
  mode = "old"
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  
  const [currentZoom, setCurrentZoom] = useState<number>(10.2);
  const [showPointsManual, setShowPointsManual] = useState<boolean>(true);
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);
  const [layerError, setLayerError] = useState<string | null>(null);

  // Injects maplibre CSS manually to guarantee loading in isolated client frames 
  useEffect(() => {
    if (!document.getElementById("maplibre-cdn-css")) {
      const link = document.createElement("link");
      link.id = "maplibre-cdn-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
      document.head.appendChild(link);
    }
  }, []);

  // 1. Initialize Map on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      console.log("Initializing MapLibre instance...");
      // Hanoi Centroid center: Lng: 105.8118, Lat: 21.01
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            "osm-tiles": {
              type: "raster",
              tiles: [
                "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
              ],
              tileSize: 256,
              attribution: "© OpenStreetMap / CARTO"
            }
          },
          layers: [
            {
              id: "osm-layer",
              type: "raster",
              source: "osm-tiles",
              minzoom: 0,
              maxzoom: 20
            }
          ]
        },
        center: [105.8118, 21.01],
        zoom: currentZoom,
        maxZoom: 18,
        minZoom: 8
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      map.on("zoom", () => {
        setCurrentZoom(parseFloat(map.getZoom().toFixed(1)));
      });

      mapRef.current = map;

      return () => {
        console.log("Cleaning up map instance...");
        map.remove();
        mapRef.current = null;
      };
    } catch (err: any) {
      console.error("Map installation crashed", err);
      setLayerError(`Không thể khởi tạo dịch vụ Bản đồ: ${err.message}`);
    }
  }, []);

  // 2. Setup Sources and Layers when GeoJSON data or Map is ready
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;

    const setupLayers = () => {
      // Clean up previous sources if any
      if (map.getLayer("customer-points")) map.removeLayer("customer-points");
      if (map.getLayer("hanoi-districts-line-selected")) map.removeLayer("hanoi-districts-line-selected");
      if (map.getLayer("hanoi-districts-line")) map.removeLayer("hanoi-districts-line");
      if (map.getLayer("hanoi-districts-fill")) map.removeLayer("hanoi-districts-fill");
      if (map.getSource("hanoi-districts-source")) map.removeSource("hanoi-districts-source");
      if (map.getSource("customer-points-source")) map.removeSource("customer-points-source");

      // A. Districts Source & Layers
      map.addSource("hanoi-districts-source", {
        type: "geojson",
        data: geojson
      });

      // Choropleth Fill Layer
      map.addLayer({
        id: "hanoi-districts-fill",
        type: "fill",
        source: "hanoi-districts-source",
        paint: {
          "fill-color": mode === "new" ? [
            "match",
            ["get", "colorBucket"],
            0, "#f9fafb", // very low / empty (clean off-white)
            1, "#ecfdf5", // low
            2, "#a7f3d0", // medium
            3, "#34d399", // high
            4, "#059669", // very high
            "#f9fafb"     // fallback
          ] : [
            "match",
            ["get", "colorBucket"],
            0, "#f9fafb", // very low / empty (clean off-white)
            1, "#eff6ff", // low
            2, "#bfdbfe", // medium
            3, "#60a5fa", // high
            4, "#2563eb", // very high
            "#f9fafb"     // fallback
          ],
          "fill-opacity": mode === "new" ? [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.28,
            0.12
          ] : [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.30,
            0.15
          ]
        }
      });

      // Shared Border line
      map.addLayer({
        id: "hanoi-districts-line",
        type: "line",
        source: "hanoi-districts-source",
        paint: {
          "line-color": mode === "new" ? "#059669" : "#2563eb",
          "line-width": 1.0,
          "line-opacity": 0.35
        }
      });

      // Selected Border line (Highlight selected district)
      map.addLayer({
        id: "hanoi-districts-line-selected",
        type: "line",
        source: "hanoi-districts-source",
        paint: {
          "line-color": "#ef4444",
          "line-width": 2.5,
          "line-opacity": [
            "case",
            ["==", ["get", "districtId"], selectedDistrictId || "NONE"],
            1.0,
            0.0
          ]
        }
      });

      // B. Points Source & Layer
      const pointsGeoJSON = {
        type: "FeatureCollection",
        features: points.map((p) => ({
          type: "Feature",
          properties: {
            pointId: p.pointId,
            customerName: p.customerName,
            customerCode: p.customerCode,
            addressText: p.addressText,
            lat: p.lat,
            lng: p.lng,
            sourceType: p.source,
            districtId: p.districtId || ""
          },
          geometry: {
            type: "Point",
            coordinates: [p.lng, p.lat]
          }
        }))
      };

      map.addSource("customer-points-source", {
        type: "geojson",
        data: pointsGeoJSON
      });

      // Exact coordinate circles
      map.addLayer({
        id: "customer-points",
        type: "circle",
        source: "customer-points-source",
        minzoom: 11.5, // exact points only visible beyond 11.5 zoom or inside clicked district
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11, 4,
            15, 8
          ],
          "circle-color": "#ef4444",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": showPointsManual ? 1.0 : 0.0,
          "circle-stroke-opacity": showPointsManual ? 1.0 : 0.0
        }
      });

      // C. Interactive Event Listeners (Hover & Selection)
      let hoveredFeatureId: string | null = null;
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "custom-popup-box"
      });

      // Hover district action
      map.on("mousemove", "hanoi-districts-fill", (e) => {
        if (!e.features || e.features.length === 0) return;
        
        map.getCanvas().style.cursor = "pointer";
        const feat = e.features[0];
        const dId = feat.properties?.districtId;
        const dName = feat.properties?.districtName;
        const count = feat.properties?.customerCount;
        const share = feat.properties?.shareOfHanoi;

        if (hoveredFeatureId !== dId) {
          if (hoveredFeatureId) {
            map.setFeatureState(
              { source: "hanoi-districts-source", id: hoveredFeatureId },
              { hover: false }
            );
          }
          hoveredFeatureId = dId;
          map.setFeatureState(
            { source: "hanoi-districts-source", id: dId },
            { hover: true }
          );

          setHoveredDistrict({
            districtId: dId,
            districtName: dName,
            customerCount: count,
            shareOfHanoi: share
          });
        }
      });

      map.on("mouseleave", "hanoi-districts-fill", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
        if (hoveredFeatureId) {
          map.setFeatureState(
            { source: "hanoi-districts-source", id: hoveredFeatureId },
            { hover: false }
          );
          hoveredFeatureId = null;
        }
        setHoveredDistrict(null);
      });

      // CLICK district to FitBounds & Select
      map.on("click", "hanoi-districts-fill", (e) => {
        if (!e.features || e.features.length === 0) return;
        const feat = e.features[0];
        const dId = feat.properties?.districtId;
        const centerLng = feat.properties?.centerLng;
        const centerLat = feat.properties?.centerLat;

        if (dId) {
          onSelectDistrict(dId === selectedDistrictId ? null : dId);
          map.easeTo({
            center: [centerLng, centerLat],
            zoom: Math.max(map.getZoom(), 11.5),
            duration: 1000
          });
        }
      });

      // Hover Point Action (circle coordinates)
      map.on("mouseenter", "customer-points", (e) => {
        if (!e.features || e.features.length === 0) return;
        
        map.getCanvas().style.cursor = "pointer";
        const props = e.features[0].properties;
        const coordinates = (e.features[0].geometry as any).coordinates.slice();
        
        const html = `
          <div class="p-2.5 max-w-[240px] text-gray-800 text-xs text-left leading-relaxed">
            <h4 class="font-bold text-gray-900 border-b pb-1 mb-1.5 flex items-center justify-between">
              <span>👤 ${props.customerName}</span>
              <span class="text-[9px] px-1.5 py-0.2 bg-red-100 text-red-700 rounded-full font-semibold font-mono">
                ${props.customerCode || "CODE_NA"}
              </span>
            </h4>
            <p className="mb-1"><strong>Nguồn:</strong> <span class="font-mono text-gray-500">${props.sourceType}</span></p>
            <p className="mb-1"><strong>Tọa độ:</strong> <span class="font-mono text-gray-500">${props.lat.toFixed(5)}, ${props.lng.toFixed(5)}</span></p>
            <p className="leading-normal mt-1"><strong>Địa chỉ:</strong> <span class="text-gray-600">${props.addressText}</span></p>
          </div>
        `;

        popup.setLngLat(coordinates).setHTML(html).addTo(map);
      });

      map.on("mouseleave", "customer-points", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      // Click customer point action to display card in overlay HUD
      map.on("click", "customer-points", (e) => {
        if (!e.features || e.features.length === 0) return;
        const props = e.features[0].properties;
        setSelectedPoint(props);
      });
    };

    if (map.isStyleLoaded()) {
      setupLayers();
    } else {
      map.once("style.load", setupLayers);
    }

  }, [geojson, points, selectedDistrictId, showPointsManual, mode]);

  // Adjust highlight line specifically when selectedDistrictId shifts programmatically
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("hanoi-districts-line-selected")) return;
    
    map.setPaintProperty("hanoi-districts-line-selected", "line-opacity", [
      "case",
      ["==", ["get", "districtId"], selectedDistrictId || "NONE"],
      1.0,
      0.0
    ]);

    // If a district is chosen, let's filter the visual points map layer if desired, 
    // or keep all. Let's filter points to highlight only that region's points
    if (map.getLayer("customer-points")) {
      if (selectedDistrictId) {
        map.setFilter("customer-points", ["==", ["get", "districtId"], selectedDistrictId]);
        // Also lower minimum zoom so user can easily look at exact points in this district
        map.setPaintProperty("customer-points", "circle-radius", [
          "interpolate",
          ["linear"],
          ["zoom"],
          8, 6,
          15, 10
        ]);
      } else {
        map.setFilter("customer-points", null);
        map.setPaintProperty("customer-points", "circle-radius", [
          "interpolate",
          ["linear"],
          ["zoom"],
          11, 4,
          15, 8
        ]);
      }
    }

    // Auto fit boundary bounds of selected district
    if (selectedDistrictId && geojson) {
      const matchFeature = geojson.features.find((f: any) => f.properties.districtId === selectedDistrictId);
      if (matchFeature) {
        const center = [matchFeature.properties.centerLng, matchFeature.properties.centerLat] as [number, number];
        map.easeTo({
          center,
          zoom: 12.0,
          duration: 900
        });
      }
    }
  }, [selectedDistrictId]);

  const fitHanoiBounds = () => {
    if (mapRef.current) {
      mapRef.current.easeTo({
        center: [105.8118, 21.01],
        zoom: 10.2,
        duration: 800
      });
      onSelectDistrict(null);
    }
  };

  return (
    <div className="relative w-full h-[600px] border border-zinc-200 rounded-lg overflow-hidden bg-zinc-50" id="maplibre-container-card">
      
      {mode === "new" && (
        <div className="absolute top-4 left-16 bg-white/95 border border-zinc-200 p-3 rounded shadow-lg font-mono text-[10px] text-zinc-800 z-10 w-[180px] flex flex-col space-y-1.5" id="new-mode-floating-legend">
          <p className="font-bold text-emerald-950 border-b border-zinc-200 pb-1 mb-1 tracking-wider uppercase">BẢN ĐỒ PHƯỜNG/XÃ CHI TIẾT</p>
          <p className="text-[9px] text-zinc-500 leading-tight">Mật độ khách hàng tại 126 đơn vị Phường, Xã sáp nhập và quy hoạch mới nhất Hà Nội:</p>
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 shrink-0 rounded-sm bg-[#059669]" />
              <span className="font-semibold text-zinc-700">Rất Cao (&gt;20 khách)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 shrink-0 rounded-sm bg-[#34d399]" />
              <span className="font-semibold text-zinc-700">Cao (12 - 20)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 shrink-0 rounded-sm bg-[#a7f3d0]" />
              <span className="font-semibold text-zinc-700">Trung bình (5 - 11)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 shrink-0 rounded-sm bg-[#ecfdf5] border border-[#a7f3d0]" />
              <span className="font-semibold text-zinc-700">Thấp (1 - 4)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 shrink-0 rounded-sm bg-[#f9fafb] border border-zinc-200" />
              <span className="font-semibold text-zinc-700">Không có khách</span>
            </div>
          </div>
        </div>
      )}
      {layerError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white z-50">
          <Info className="h-10 w-10 text-red-500 mb-3 animate-pulse" />
          <p className="text-sm font-semibold text-gray-800">{layerError}</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">Vui lòng thử tải lại trang hoặc reset server nếu lỗi tiếp diễn.</p>
        </div>
      ) : (
        <div ref={mapContainerRef} className="w-full h-full" id="maplibre-dom" />
      )}

      {/* Floating HUD controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10" id="map-huds">
        <button
          onClick={fitHanoiBounds}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 text-[10px] font-bold font-mono text-zinc-800 uppercase rounded border border-zinc-300 hover:bg-zinc-50 active:translate-y-px shadow-sm transition-all"
        >
          <Maximize2 className="h-3 w-3" />
          <span>Reset Hanoi fit</span>
        </button>

        <button
          onClick={() => setShowPointsManual(!showPointsManual)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 text-[10px] font-bold font-mono text-zinc-800 uppercase rounded border border-zinc-300 hover:bg-zinc-50 active:translate-y-px shadow-sm transition-all"
        >
          {showPointsManual ? (
            <>
              <EyeOff className="h-3 w-3 text-red-500" />
              <span>Hide true points</span>
            </>
          ) : (
            <>
              <Eye className="h-3 w-3 text-emerald-600" />
              <span>Show true points</span>
            </>
          )}
        </button>


      </div>

      {/* Dynamic zoom and points visual alert bar */}
      <div className="absolute bottom-4 left-4 bg-zinc-900/95 border border-zinc-700 px-3 py-2 rounded text-[9px] font-mono text-zinc-250/90 shadow-lg flex flex-wrap items-center gap-2 z-10">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="uppercase tracking-wider">Hệ bản đồ: <strong className="text-white">{mode === "old" ? "30 Quận/Huyện/Thị xã chuẩn" : "126 Phường/Xã chi tiết"}</strong></span>
        <span className="text-zinc-700">|</span>
        <span>ZOOM: <strong className="text-white">{currentZoom}</strong></span>
        <span className="text-zinc-700">|</span>
        {currentZoom < 11.5 && !selectedDistrictId ? (
          <span className="text-amber-400 font-semibold uppercase tracking-tight">(ZOOM IN ≥11.5 OR SELECT SECTOR FOR TRUE PINPOINT)</span>
        ) : (
          <span className="text-emerald-400 font-semibold uppercase tracking-tight">(TRUE PINPOINTS ACTIVE)</span>
        )}
      </div>

      {/* Quick HUD Hover Indicator */}
      {hoveredDistrict && (
        <div className="absolute top-4 right-16 bg-white/95 rounded border border-zinc-300 shadow-lg p-3 max-w-[200px] font-mono text-[11px] transition-opacity duration-250 z-10 animate-fade-in">
          <div className="font-bold text-zinc-900 border-b border-zinc-200 pb-1 mb-1.5">
            📍 {hoveredDistrict.districtName}
          </div>
          <div className="flex flex-col gap-1 text-zinc-650">
            <div className="flex justify-between">
              <span>Mật độ:</span>
              <strong className="text-zinc-900">{hoveredDistrict.customerCount}</strong>
            </div>
            <div className="flex justify-between">
              <span>Tỷ lệ:</span>
              <strong className="text-zinc-900">{hoveredDistrict.shareOfHanoi}%</strong>
            </div>
          </div>
        </div>
      )}

      {/* Interactive selection point inspector card */}
      {selectedPoint && (
        <div className="absolute bottom-16 right-4 bg-zinc-900 text-white rounded border border-zinc-750 shadow-2xl p-4 max-w-[280px] font-mono text-[11px] animate-slide-up z-10">
          <div className="flex items-start justify-between border-b border-zinc-750 pb-2 mb-2">
            <div>
              <h4 className="font-bold text-white text-xs truncate max-w-[190px]">{selectedPoint.customerName}</h4>
              <p className="text-[9px] text-zinc-400 font-mono mt-0.5">CODE: {selectedPoint.customerCode || "CODE_NA"}</p>
            </div>
            <button
              onClick={() => setSelectedPoint(null)}
              className="text-zinc-400 hover:text-white text-xs font-semibold px-1"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-1.5 text-zinc-300 leading-normal">
            <p><strong>Nguồn:</strong> <span className="font-normal text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">{selectedPoint.sourceType}</span></p>
            <p><strong>Bản đồ cũ:</strong> <span className="font-medium text-zinc-200">{selectedPoint.addressText.split(",").slice(-2)[0]?.trim() || "Chưa gán"}</span></p>
            <p><strong>Tọa độ:</strong> <span className="font-mono text-zinc-400">{parseFloat(selectedPoint.lat).toFixed(5)}, {parseFloat(selectedPoint.lng).toFixed(5)}</span></p>
            <p className="border-t border-zinc-750 pt-1.5 mt-1 text-zinc-400 text-[10px] leading-relaxed"><strong>Địa chỉ:</strong> {selectedPoint.addressText}</p>
          </div>
        </div>
      )}
    </div>
  );
}
