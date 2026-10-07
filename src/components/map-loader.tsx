"use client";
import dynamic from "next/dynamic";
export const CityMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <span className="skeleton sk-block" />
      Loading Bengaluru map…
    </div>
  ),
});
