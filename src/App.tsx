/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import CustomerDensityMapPage from "./components/admin/customer-density/CustomerDensityMapPage.tsx";
import { Shield, Map, LogOut, Grid, TrendingUp, HelpCircle } from "lucide-react";

export default function App() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans text-zinc-900 flex flex-col" id="admin-workspace-layout">
      
      {/* Top Professional Header Bar */}
      <header className="h-16 border-b border-zinc-200 bg-white flex items-center justify-between px-6 shrink-0 z-50 sticky top-0 shadow-xs" id="nav-header">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white font-mono font-bold text-sm tracking-tighter">VG</div>
          <div>
            <h1 className="text-sm sm:text-base font-bold leading-none tracking-tight text-zinc-900">Bản đồ mật độ khách hàng Hà Nội</h1>
            <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-wider">Vuagiat Admin Portal / Customer-Density / v1.0.4</p>
          </div>
        </div>

        {/* User profiles & badging */}
        <div className="flex items-center gap-3">
          <span className="hidden md:inline-block px-2.5 py-1 bg-amber-50 text-amber-800 text-[10px] font-bold uppercase rounded border border-amber-200 font-mono tracking-wider">
            Phân tích Quận/Huyện cũ
          </span>
          <div className="hidden sm:block h-6 w-px bg-zinc-200 mx-1"></div>
          <div className="flex items-center gap-2.5">
            <div className="w-7.5 h-7.5 rounded bg-zinc-900 text-white font-bold text-xs flex items-center justify-center font-mono">
              AD
            </div>
            <div className="text-[10px] text-left hidden sm:block leading-tight font-mono">
              <p className="font-bold text-zinc-800">Quản trị viên</p>
              <p className="text-zinc-400">phamthinhanti001@gmail.com</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col" id="workspace-main-area">
        {/* Navigation/Module header snippet */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 pb-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 uppercase font-mono">Mật độ phân bổ khách hàng</h2>
            <p className="text-xs text-zinc-500 font-semibold mt-1">Phân tích ranh giới hành tầng - Quản trị và Kế hoạch hóa chiến lược marketing</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 bg-zinc-100/80 px-3 py-1.5 rounded border border-zinc-200 font-mono">
            <Shield className="h-3.5 w-3.5 text-zinc-700" />
            <span>PRIVILEGES:</span>
            <strong className="text-zinc-800">ADMIN_READ_PRIVILEGES_HN (Role: 1)</strong>
          </div>
        </div>

        {/* Mount Customer Density Page */}
        <CustomerDensityMapPage />
      </main>

      {/* Corporate Admin Status Footer */}
      <footer className="bg-zinc-900 text-zinc-500 border-t border-zinc-800 py-3.5 px-6 mt-12 text-[10px] shrink-0 font-mono flex flex-col md:flex-row items-center justify-between gap-4" id="footer-panel">
        <div className="flex flex-wrap gap-x-6 gap-y-1 justify-center md:justify-start">
          <span>SOURCE: Customer Records Table (Dedupe by pointId)</span>
          <span>BOUNDARY SOURCE: GeoVina (Last Refresh Maplibre Layers)</span>
        </div>
        <div className="flex items-center gap-5 justify-center">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span> SYSTEM READY
          </span>
          <span className="text-zinc-600 hidden sm:inline">|</span>
          <span className="text-zinc-400">MAPLIBRE-GL CANVAS MODE</span>
        </div>
      </footer>
    </div>
  );
}
