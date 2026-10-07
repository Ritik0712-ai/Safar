"use client";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Circle,
  useMap,
  useMapEvents,
  Tooltip,
} from "react-leaflet";
import { useEffect, useState, useRef } from "react";
import { LocateFixed } from "lucide-react";
import { area } from "@/lib/domain";
import type { Place, Location } from "@/contracts";
import "leaflet/dist/leaflet.css";
function Controls({
  points,
  onPick,
}: {
  points: Place[];
  onPick?: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const fitted = useRef("");
  useMapEvents({ click: (e) => onPick?.(e.latlng.lat, e.latlng.lng) });
  useEffect(() => {
    const key = points.map((p) => `${p.lat},${p.lng}`).join("|");
    if (fitted.current === key) return;
    fitted.current = key;
    if (points.length)
      map.fitBounds(
        points.map((p) => [p.lat, p.lng]),
        { padding: [55, 55], maxZoom: 15, animate: false },
      );
  }, [map, points]);
  return (
    <button
      className="map-recenter icon-button"
      aria-label="Recenter map"
      onClick={() =>
        points.length
          ? map.fitBounds(
              points.map((p) => [p.lat, p.lng]),
              { padding: [55, 55], maxZoom: 15, animate: false },
            )
          : map.setView([area.center.lat, area.center.lng], 12)
      }
    >
      <LocateFixed size={20} />
    </button>
  );
}
export default function CityMap({
  pickup,
  destination,
  geometry,
  location,
  onPick,
  publicMap = false,
}: {
  pickup?: Place | null;
  destination?: Place | null;
  geometry?: number[][] | null;
  location?: Location | null;
  onPick?: (lat: number, lng: number) => void;
  publicMap?: boolean;
}) {
  const [error, setError] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  const key = process.env.NEXT_PUBLIC_GEOAPIFY_TILE_KEY;
  const [points, setPoints] = useState<Place[]>([]);
  useEffect(() => {
    setPoints([pickup, destination].filter(Boolean) as Place[]);
  }, [pickup, destination]);
  return (
    <div className={`city-map ${onPick ? "pick-mode" : ""}`}>
      <MapContainer
        center={[area.center.lat, area.center.lng]}
        zoom={publicMap ? 12 : 13}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url={
            key
              ? `https://maps.geoapify.com/v1/tile/positron/{z}/{x}/{y}.png?apiKey=${key}`
              : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          attribution={
            key
              ? 'Powered by <a href="https://www.geoapify.com/">Geoapify</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }
          eventHandlers={{ tileerror: () => setError(true) }}
        />
        {publicMap && (
          <Circle
            center={[area.center.lat, area.center.lng]}
            radius={3200}
            pathOptions={{
              color: "#006b5b",
              weight: 1,
              fillColor: "#006b5b",
              fillOpacity: 0.07,
              dashArray: "4 8",
            }}
          />
        )}
        {pickup && (
          <CircleMarker
            center={[pickup.lat, pickup.lng]}
            radius={9}
            pathOptions={{
              color: "#fff",
              weight: 3,
              fillColor: "#006b5b",
              fillOpacity: 1,
            }}
          >
            <Tooltip>Pickup: {pickup.label}</Tooltip>
          </CircleMarker>
        )}
        {destination && (
          <CircleMarker
            center={[destination.lat, destination.lng]}
            radius={9}
            pathOptions={{
              color: "#142129",
              weight: 3,
              fillColor: "#fff",
              fillOpacity: 1,
            }}
          >
            <Tooltip>Destination: {destination.label}</Tooltip>
          </CircleMarker>
        )}
        {geometry && (
          <>
            <Polyline
              positions={geometry.map((p) => [p[1], p[0]])}
              pathOptions={{ color: "#fff", weight: 9 }}
            />
            <Polyline
              positions={geometry.map((p) => [p[1], p[0]])}
              pathOptions={{ color: "#006b5b", weight: 5 }}
            />
          </>
        )}
        {location && (
          <CircleMarker
            center={[location.lat, location.lng]}
            radius={8}
            pathOptions={{
              color: "#fff",
              weight: 3,
              fillColor:
                clock - location.timestamp > 15000 ? "#52616b" : "#174ea6",
              fillOpacity: 1,
            }}
          >
            <Tooltip>Driver location</Tooltip>
          </CircleMarker>
        )}
        <Controls points={points} onPick={onPick} />
      </MapContainer>
      {error && (
        <div className="map-error">
          Map tiles could not load. Your selected locations are still available.
        </div>
      )}
      {onPick && (
        <div className="map-pick-label">Click the map to choose a location</div>
      )}
    </div>
  );
}
