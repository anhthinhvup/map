import React, { useEffect, useState, useMemo } from "react";
import { HanoiSummary, DistrictSummary, CustomerPoint } from "../../../lib/customer-density/types.ts";
import CustomerDensityMap from "./CustomerDensityMap.tsx";
import CustomerDensityRanking from "./CustomerDensityRanking.tsx";
import CustomerDensityLegend from "./CustomerDensityLegend.tsx";
import { Users, Layout, MapPin, RefreshCw, AlertTriangle, CheckCircle, Shield, Compass } from "lucide-react";

export default function CustomerDensityMapPage() {
  const [adminMode, setAdminMode] = useState<"old" | "new">("old");
  const [summary, setSummary] = useState<HanoiSummary | null>(null);
  const [rankings, setRankings] = useState<DistrictSummary[]>([]);
  const [geojson, setGeoJSON] = useState<any | null>(null);
  const [points, setPoints] = useState<CustomerPoint[]>([]);

  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<any | null>(null);

  // Sync operations from upstream GeoVina
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Load datasets initially on mount and when adminMode shifts
  useEffect(() => {
    setSelectedDistrictId(null);
    loadDashboardData();
  }, [adminMode]);

  const loadDashboardData = async () => {
    setLoading(true);
    setErrors(null);
    try {
      console.log(`Fetching customer-density summary (mode: ${adminMode})...`);
      const summaryRes = await fetch(`/api/customer-density/summary?mode=${adminMode}`);
      if (!summaryRes.ok) throw new Error("Không thể tải bảng thống kê mật độ.");
      const summaryData = await summaryRes.json();
      
      setSummary(summaryData.summary);
      setRankings(summaryData.rankings);

      console.log(`Fetching customer-density GeoJSON boundaries (mode: ${adminMode})...`);
      const geojsonRes = await fetch(`/api/customer-density/geojson?mode=${adminMode}`);
      if (!geojsonRes.ok) throw new Error("Không thể tải ranh giới địa chính Hà Nội.");
      const geojsonData = await geojsonRes.json();
      setGeoJSON(geojsonData);

      console.log(`Fetching deep exact coordinates point layer (mode: ${adminMode})...`);
      const pointsRes = await fetch(`/api/customer-density/points?mode=${adminMode}`);
      if (!pointsRes.ok) throw new Error("Không thể tải cơ sở dữ liệu tọa độ khách.");
      const pointsData = await pointsRes.json();
      setPoints(pointsData.points);

    } catch (err: any) {
      console.error("Dashboard mount fetch failed:", err);
      setErrors(err.message || "Xảy ra lỗi hệ thống khi tải cơ sở dữ liệu ranh giới.");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncBoundaries = async () => {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/customer-density/boundaries/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error(`Phản hồi không hợp lệ (${res.status}): Máy chủ trả về định dạng HTML/lỗi thay vì JSON.`);
      }
      if (!res.ok) {
        throw new Error(data.error || "Gặp sự cố khi đồng bộ ranh giới qua GeoVina.");
      }
      setSyncStatus(`Đồng bộ thành công: ${data.message}`);
      // Refresh local dashboard representation
      await loadDashboardData();
    } catch (err: any) {
      console.error("Boundary sync failed:", err);
      setSyncStatus(`LỖI ĐỒNG BỘ: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Compute selected district stats or subset list
  const selectedDistrictDetails = useMemo(() => {
    if (!selectedDistrictId || rankings.length === 0) return null;
    return rankings.find((r) => r.districtId === selectedDistrictId) || null;
  }, [selectedDistrictId, rankings]);

  const selectedDistrictPoints = useMemo(() => {
    if (!selectedDistrictId) return [];
    return points.filter((p) => p.districtId === selectedDistrictId);
  }, [selectedDistrictId, points]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]" id="dashboard-loading-skeleton">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
        <p className="text-sm font-semibold text-gray-700 animate-pulse">Đang biên dịch bản đồ mật độ mật khách hàng Hà Nội...</p>
        <p className="text-xs text-gray-400 mt-1">Đang xử lý phân tích dữ liệu ranh giới 30 quận, huyện và 579 phường, xã Hà Nội</p>
      </div>
    );
  }

  if (errors) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-2xl border border-red-100 p-6 shadow-sm" id="dashboard-error-banner">
        <div className="flex items-start gap-4">
          <AlertTriangle className="h-10 w-10 text-red-500 shrink-0" />
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Lỗi tải dữ liệu cơ cấu</h3>
            <p className="text-sm text-gray-600 mt-1.5">{errors}</p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={loadDashboardData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 active:scale-95 transition-all"
              >
                Tải lại trang
              </button>
              <button
                onClick={handleSyncBoundaries}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 active:scale-95 transition-all"
              >
                Thử cấu hình lại GeoVina
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6" id="customer-density-module">

      {/* Centered Premium Administrative Toggle Capsule */}
      <div className="flex justify-center mb-6" id="admin-mode-toggle-capsule">
        <div className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1.5 rounded-full shadow-lg">
          <button
            onClick={() => setAdminMode("old")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              adminMode === "old"
                ? "bg-zinc-800 text-white shadow-inner border border-zinc-700/50"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Quận, Huyện, Thị xã (Bản đồ chuẩn) 🗺️
          </button>
          <button
            onClick={() => setAdminMode("new")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              adminMode === "new"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/30 border border-emerald-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Bản đồ Chi tiết Phường/Xã (579 đơn vị thật) 🧭
          </button>
        </div>
      </div>
      
      {/* Scope Labeling Warning and Boundary Synching tool */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-amber-50/40 border border-amber-200/80 rounded-lg p-4 font-mono text-xs">
        <div className="flex gap-3 items-start">
          <Compass className="h-4.5 w-4.5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-[10px] font-bold text-amber-900 uppercase tracking-widest">THUYẾT MINH BẢN ĐỒ ĐỊA GIỚI HÀ NỘI</h4>
            <p className="text-amber-800 leading-relaxed mt-1">
              Bản đồ thể hiện <strong>30 Quận, Huyện, Thị xã chính thức</strong> của Thủ đô Hà Nội 
              (đồng dạng ranh giới cấu trúc địa lý tiêu chuẩn giống các kênh thông tấn lớn như Hanoimoi). Đồng thời tích hợp chế độ <strong>Phập rã chi tiết 579 xã, phường, thị trấn</strong> lấy trực tiếp từ hệ quản trị DVHCVN GIS chính thống giúp tối ưu bài toán mật độ khách hàng cục bộ mượt mà và cực kỳ trực quan.
            </p>
          </div>
        </div>

        {/* Refresh tool triggering */}
        <div className="flex flex-col items-stretch md:items-end gap-1.5 shrink-0">
          <button
            onClick={handleSyncBoundaries}
            disabled={syncing}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border rounded transition-all ${
              syncing
                ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                : "bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-50 active:translate-y-px"
            }`}
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "ĐANG ĐỒNG BỘ..." : "RESET GEOCACHE GEOCLI"}</span>
          </button>
          
          {syncStatus && (
            <div className={`text-[9px] px-2 py-0.5 rounded max-w-[280px] break-words text-right font-semibold font-mono uppercase ${
              syncStatus.startsWith("Đồng bộ") 
                ? "text-emerald-700 bg-emerald-50 border border-emerald-200" 
                : "text-red-700 bg-red-50 border border-red-200"
            }`}>
              {syncStatus}
            </div>
          )}
        </div>
      </div>

      {/* KPI stripe */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-zinc-200 bg-zinc-50 rounded-lg overflow-hidden shadow-xs" id="kpi-stripe-grid">
          {/* KPI 1 */}
          <div className="p-4 border-b sm:border-b-0 sm:border-r border-zinc-250 flex flex-col justify-center bg-white">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest font-mono">Tổng khách Hà Nội</span>
            <span className="text-2xl font-mono font-bold text-zinc-950 mt-1">
              {summary.totalCustomers.toLocaleString("vi-VN")}
            </span>
            <span className="text-[10px] text-emerald-600 font-mono uppercase tracking-wider mt-1 flex items-center gap-1">
              <span>● UNIQUE CONTACTS</span>
            </span>
          </div>

          {/* KPI 2 */}
          <div className="p-4 border-b sm:border-b-0 sm:border-r border-zinc-250 flex flex-col justify-center bg-white">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest font-mono">Quận/Huyện bao phủ</span>
            <span className="text-2xl font-mono font-bold text-zinc-950 mt-1">
              {summary.totalDistrictsWithCustomers} <span className="text-sm font-normal text-zinc-400">/ {summary.totalDistrictsCount}</span>
            </span>
            <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider mt-1">Active coverage reach</span>
          </div>

          {/* KPI 3 */}
          <div className="p-4 border-b lg:border-b-0 lg:border-r border-zinc-250 flex flex-col justify-center bg-white">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest font-mono">Quận mật độ cao nhất</span>
            <span className="text-lg font-bold text-zinc-950 truncate mt-1">
              {summary.topDistrictName}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono mt-1">({summary.topDistrictCount} unique customers)</span>
          </div>

          {/* KPI 4 */}
          <div className="p-4 flex flex-col justify-center bg-zinc-100">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest font-mono">Chưa gán / Ngoài HN</span>
            <span className="text-2xl font-mono font-bold text-zinc-400 mt-1">
              {summary.outsideCustomersCount.toLocaleString("vi-VN")}
            </span>
            <span className="text-[10px] text-zinc-500 mt-1 font-mono">Unassigned coordinates</span>
          </div>
        </div>
      )}

      {/* Main split work surface */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start" id="main-work-surface">
        
        {/* Map area (Leaning heavily to 3 cols on premium viewport) */}
        <div className="lg:col-span-3 space-y-4">
          <CustomerDensityMap
            geojson={geojson}
            points={points}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={setSelectedDistrictId}
            hoveredDistrict={hoveredDistrict}
            setHoveredDistrict={setHoveredDistrict}
            mode={adminMode}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="md:col-span-2">
              <CustomerDensityLegend />
            </div>

            {/* Quick Inspection panel showing details on clicked item */}
            <div className="bg-white rounded-lg border border-zinc-200 p-4 font-mono shadow-xs" id="inspection-brief">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 border-b border-zinc-100 pb-2">Chi tiết Bộ lọc chọn</h3>
              {selectedDistrictDetails ? (
                <div className="space-y-3">
                  <div className="p-3 bg-zinc-900 text-white rounded border border-zinc-750">
                    <p className="font-bold text-sm tracking-tight">{selectedDistrictDetails.districtName}</p>
                    <p className="text-[9px] text-zinc-400 mt-1 font-mono uppercase tracking-wider">DISTRICT_ID: {selectedDistrictId}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs text-zinc-650">
                    <div className="flex justify-between border-b border-zinc-100 pb-1">
                      <span>Mật độ:</span>
                      <strong className="text-zinc-950 font-bold">{selectedDistrictDetails.customerCount} liên hệ</strong>
                    </div>
                    <div className="flex justify-between border-b border-zinc-100 pb-1">
                      <span>Tỷ trọng toàn HN:</span>
                      <strong className="text-zinc-950 font-bold">{selectedDistrictDetails.shareOfHanoi}%</strong>
                    </div>
                    <div className="flex justify-between pb-1">
                      <span>Điểm hiển thị:</span>
                      <strong className="text-red-500 font-bold">{selectedDistrictPoints.length} true-coords</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedDistrictId(null)}
                    className="w-full py-1.5 border border-zinc-300 hover:bg-zinc-50 text-center rounded text-[10px] font-bold text-zinc-700 active:translate-y-0.5 transition-all mt-1 uppercase tracking-wider block"
                  >
                    Bỏ lọc khu vực
                  </button>
                </div>
              ) : (
                <div className="h-[120px] flex flex-col items-center justify-center text-center p-4">
                  <MapPin className="h-5 w-5 text-zinc-300 mb-2 animate-bounce" />
                  <p className="text-[11px] text-zinc-400 leading-relaxed">Click một quận trên danh sách hoặc bản đồ để lọc và xem dữ liệu tọa độ thật</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar panels (Sorted list and summary panel) */}
        <div id="density-sidebar-area">
          <CustomerDensityRanking
            rankings={rankings}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={setSelectedDistrictId}
            mode={adminMode}
            onSwitchMode={setAdminMode}
          />
        </div>
      </div>
    </div>
  );
}
