import React from "react";

export const CHOROPLETH_PALETTE = {
  0: { color: "#f9fafb", border: "#e5e7eb", label: "Không có khách", desc: "Không có khách" },
  1: { color: "#eff6ff", border: "#bfdbfe", label: "Thấp (1 - 4)", desc: "1 - 4 khách độc nhất" },
  2: { color: "#bfdbfe", border: "#60a5fa", label: "Trung bình (5 - 11)", desc: "5 - 11 khách độc nhất" },
  3: { color: "#60a5fa", border: "#2563eb", label: "Cao (12 - 20)", desc: "12 - 20 khách độc nhất" },
  4: { color: "#2563eb", border: "#1d4ed8", label: "Rất cao (21+)", desc: "Khu vực tập trung đông khách" }
};

export default function CustomerDensityLegend() {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4 font-mono shadow-xs" id="density-legend-panel">
      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3.5 border-b border-zinc-100 pb-2">mật độ phân bổ (sectors)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {(Object.entries(CHOROPLETH_PALETTE) as unknown as [number, typeof CHOROPLETH_PALETTE[0]][]).map(([bucket, info]) => (
          <div key={bucket} className="flex items-center gap-2.5">
            <div
              className="w-3.5 h-3.5 border shrink-0"
              style={{
                backgroundColor: info.color,
                borderColor: info.border,
              }}
            />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-zinc-800 leading-tight uppercase truncate">{info.label}</span>
              <span className="text-[9px] text-zinc-400 truncate leading-tight mt-0.5">{info.desc}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-zinc-100 text-[9px] text-zinc-400 font-mono">
        <p className="leading-normal">
          * DỮ LIỆU ĐỘC NHẤT (UNIQUE): Mỗi khách hàng được loại bỏ dữ liệu trùng lặp trên địa bàn dựa trên hệ định danh CRM của Vuagiat.
        </p>
      </div>
    </div>
  );
}
