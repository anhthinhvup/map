import React, { useState, useMemo } from "react";
import { DistrictSummary } from "../../../lib/customer-density/types.ts";
import { Search, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { HANOI_OLD_DISTRICTS_META, HANOI_NEW_WARDS_META } from "../../../lib/customer-density/hanoi-districts-cache.ts";

interface Props {
  rankings: DistrictSummary[];
  selectedDistrictId: string | null;
  onSelectDistrict: (districtId: string | null) => void;
  mode?: "old" | "new";
  onSwitchMode?: (mode: "old" | "new") => void;
}

/**
 * Removes diacritics / tones from Vietnamese letters for search optimization.
 * This guarantees diacritic-insensitive (unaccented string match) capabilities.
 */
function removeVietnameseTones(str: string): string {
  if (!str) return "";
  let result = str;
  result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  result = result.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  result = result.replace(/đ/g, "d");
  result = result.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  result = result.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  result = result.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  result = result.replace(/Ò|Ó|Ọ|Bả|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  result = result.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  result = result.replace(/Ỳ|Ý|Y|Ỷ|Ỹ/g, "Y");
  result = result.replace(/Đ/g, "D");
  // Normalize combining diacritical marks
  result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return result;
}

export default function CustomerDensityRanking({
  rankings,
  selectedDistrictId,
  onSelectDistrict,
  mode = "old",
  onSwitchMode
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Filter rankings based on search (diacritic-insensitive)
  const filteredRankings = useMemo(() => {
    const rawSearch = searchTerm.trim().toLowerCase();
    if (!rawSearch) return rankings;

    const searchNoTone = removeVietnameseTones(rawSearch);

    let result = rankings.filter((item) => {
      const nameLower = item.districtName.toLowerCase();
      const nameNoTone = removeVietnameseTones(nameLower);
      return nameLower.includes(rawSearch) || nameNoTone.includes(searchNoTone);
    });

    result.sort((a, b) => {
      if (sortOrder === "desc") {
        return b.customerCount - a.customerCount;
      } else {
        return a.customerCount - b.customerCount;
      }
    });

    return result;
  }, [rankings, searchTerm, sortOrder]);

  // Check if search yields matches in the ALTERNATE mode
  const alternateModeMatches = useMemo(() => {
    const rawSearch = searchTerm.trim().toLowerCase();
    if (!rawSearch) return [];

    const searchNoTone = removeVietnameseTones(rawSearch);
    const alternateList = mode === "old" ? HANOI_NEW_WARDS_META : HANOI_OLD_DISTRICTS_META;

    return alternateList.filter((item) => {
      const nameLower = item.name.toLowerCase();
      const nameNoTone = removeVietnameseTones(nameLower);
      return nameLower.includes(rawSearch) || nameNoTone.includes(searchNoTone);
    });
  }, [searchTerm, mode]);

  const maxCustomerCount = useMemo(() => {
    if (rankings.length === 0) return 0;
    return Math.max(...rankings.map((r) => r.customerCount));
  }, [rankings]);

  return (
    <div className="bg-white rounded-lg border border-zinc-200 flex flex-col h-full overflow-hidden shadow-xs" id="ranking-panel">
      {/* Header and Controls */}
      <div className="p-4 border-b border-zinc-200 bg-zinc-50">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-650 font-mono flex items-center justify-between mb-3">
          <span>{mode === "old" ? "Xếp hạng Quận, Huyện, Thị xã" : "Xếp hạng Phường, Xã chi tiết"}</span>
          <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-200/65 px-2 py-0.5 rounded">
            {rankings.length} SECTORS
          </span>
        </h3>
        
        <div className="flex gap-2">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder={mode === "old" ? "Tìm kiếm quận, huyện, thị xã..." : "Tìm kiếm phường, xã..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-zinc-300 rounded font-mono focus:outline-hidden focus:ring-1 focus:ring-zinc-500 bg-white text-zinc-900"
            />
          </div>

          {/* Sort button */}
          <button
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            className="px-2.5 py-1.5 border border-zinc-300 rounded text-xs bg-white text-zinc-600 hover:text-zinc-800 hover:bg-zinc-50 flex items-center gap-1 shrink-0 font-mono"
            title={sortOrder === "desc" ? "Sắp xếp tăng dần" : "Sắp xếp giảm dần"}
          >
            {sortOrder === "desc" ? (
              <>
                <span className="text-[11px] font-bold uppercase">DESC</span>
                <ChevronDown className="h-3 w-3" />
              </>
            ) : (
              <>
                <span className="text-[11px] font-bold uppercase">ASC</span>
                <ChevronUp className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Rankings List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-150 min-h-[400px] max-h-[600px] custom-scrollbar">
        {filteredRankings.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500 font-mono flex flex-col items-center justify-center gap-3">
            <p>Không có kết quả phù hợp.</p>
            {alternateModeMatches.length > 0 && onSwitchMode && (
              <div className="bg-emerald-50 border border-emerald-250 p-4 rounded-lg text-emerald-950 font-sans mt-2 text-left w-full shadow-xs">
                <p className="text-[11px] leading-relaxed mb-3 font-medium">
                  {mode === "old" ? (
                    <span>
                      💡 Có <strong>{alternateModeMatches.length} đơn vị Phường/Xã</strong> khớp với từ khóa tìm kiếm của bạn ở bản đồ chi tiết (ví dụ: <strong className="underline">{alternateModeMatches[0].name}</strong>).
                    </span>
                  ) : (
                    <span>
                      💡 Có <strong>{alternateModeMatches.length} Quận/Huyện</strong> khớp với từ khóa tìm kiếm của bạn ở bản đồ chuẩn (ví dụ: <strong className="underline">{alternateModeMatches[0].name}</strong>).
                    </span>
                  )}
                </p>
                <button
                  onClick={() => onSwitchMode(mode === "old" ? "new" : "old")}
                  className="bg-emerald-600 active:scale-95 text-white font-bold text-[10px] uppercase px-3 py-2 rounded hover:bg-emerald-700 tracking-wider transition-all w-full flex items-center justify-center gap-1 font-mono"
                >
                  <Search className="h-3.5 w-3.5" />
                  XEM BẢN ĐỒ CHI TIẾT PHƯỜNG/XÃ
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredRankings.map((item, index) => {
            const isSelected = selectedDistrictId === item.districtId;
            const pct = maxCustomerCount > 0 ? (item.customerCount / maxCustomerCount) * 100 : 0;
            
            return (
              <button
                key={item.districtId}
                onClick={() => onSelectDistrict(isSelected ? null : item.districtId)}
                className={`w-full text-left p-3.5 transition-colors font-mono ${
                  isSelected 
                    ? "bg-zinc-50 hover:bg-zinc-100 border-l-2 border-zinc-900" 
                    : "hover:bg-zinc-50/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[10px] font-bold text-zinc-400 w-5 text-right">
                      {(sortOrder === "desc" ? index + 1 : rankings.length - index).toString().padStart(2, '0')}
                    </span>
                    <span className={`text-[11px] font-bold break-words max-w-[130px] font-sans ${
                      isSelected ? "text-zinc-950 font-extrabold" : "text-zinc-800"
                    }`}>
                      {item.districtName}
                    </span>
                    {item.customerCount > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 shrink-0" />
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-zinc-900 font-mono">{item.customerCount.toLocaleString()}</span>
                    <span className="text-[9px] text-zinc-400 font-medium ml-1">KHACH</span>
                  </div>
                </div>

                <div className="pl-6.5">
                  {/* Progress bar */}
                  <div className="w-full bg-zinc-100 h-1 rounded-sm overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-sm transition-all duration-300 ${
                        isSelected ? "bg-zinc-900" : "bg-zinc-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-zinc-400">
                    <span>SHARE: {item.shareOfHanoi}%</span>
                    <span className="font-semibold uppercase text-zinc-500 font-mono">
                      LVL: {item.customerCount === 0 
                        ? "VERY LOW" 
                        : mode === "new"
                          ? item.customerCount === 1 ? "LOW" : item.customerCount === 2 ? "MID" : item.customerCount <= 5 ? "HIGH" : "PEAK"
                          : item.customerCount <= 4 ? "LOW" : item.customerCount <= 11 ? "MID" : item.customerCount <= 20 ? "HIGH" : "PEAK"}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {selectedDistrictId && (
        <div className="p-3 bg-zinc-100 border-t border-zinc-200 text-[10px] text-zinc-700 flex items-center justify-between shrink-0 font-mono">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
            <MapPin className="h-3 w-3 text-zinc-900" />
            Lọc: ACTIVE SECTOR
          </span>
          <button 
            onClick={() => onSelectDistrict(null)}
            className="text-[9px] font-bold uppercase tracking-widest underline text-zinc-900 hover:text-zinc-650"
          >
            REMOVE FILTER
          </button>
        </div>
      )}
    </div>
  );
}
