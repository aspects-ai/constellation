import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/cyberpunk-map.css";

// San Francisco coordinates
const SF_CENTER: [number, number] = [37.7749, -122.4194];

// Famous SF districts with cyberpunk names
interface District {
  name: string;
  cyberpunkName: string;
  coords: [number, number];
  description: string;
}

const DISTRICTS: District[] = [
  {
    name: "Financial District",
    cyberpunkName: "Corporate Nexus",
    coords: [37.7946, -122.3999],
    description: "High-security corporate towers pierce the digital fog",
  },
  {
    name: "Chinatown",
    cyberpunkName: "Neon Quarter",
    coords: [37.7941, -122.4078],
    description: "Ancient traditions meet holographic advertisements",
  },
  {
    name: "Mission District",
    cyberpunkName: "Resistance Zone",
    coords: [37.7599, -122.4148],
    description: "Underground networks and street art collide",
  },
  {
    name: "Castro",
    cyberpunkName: "Rainbow Circuit",
    coords: [37.7609, -122.435],
    description: "Digital pride flags illuminate the neural pathways",
  },
  {
    name: "Haight-Ashbury",
    cyberpunkName: "Psychedelic Subnet",
    coords: [37.7692, -122.4481],
    description: "Where vintage meets virtual reality",
  },
  {
    name: "SOMA",
    cyberpunkName: "Tech Wasteland",
    coords: [37.7749, -122.4194],
    description: "Silicon dreams and broken algorithms",
  },
];

// Custom cyberpunk marker icon
const createCyberpunkIcon = (color: string) => {
  return L.divIcon({
    className: "cyberpunk-marker",
    html: `
      <div class="marker-glow" style="--glow-color: ${color}">
        <div class="marker-core"></div>
        <div class="marker-pulse"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Map effect component for custom styling
const MapEffects: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    // Add custom CSS filter to the map container
    const mapContainer = map.getContainer();
    mapContainer.style.filter =
      "hue-rotate(240deg) saturate(1.5) brightness(0.3)";

    return () => {
      mapContainer.style.filter = "";
    };
  }, [map]);

  return null;
};

const CyberpunkSFMap: React.FC = () => {
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(
    null,
  );

  const handleDistrictClick = (district: District) => {
    setSelectedDistrict(district);
  };

  return (
    <div className="cyberpunk-map-container">
      <div className="hud-overlay">
        <div className="scan-line"></div>
        <div className="grid-overlay"></div>

        {/* District Info Panel */}
        <div className={`district-panel ${selectedDistrict ? "active" : ""}`}>
          {selectedDistrict && (
            <>
              <div className="panel-header">
                <span className="district-name">
                  {selectedDistrict.cyberpunkName}
                </span>
                <span className="original-name">({selectedDistrict.name})</span>
              </div>
              <div className="panel-content">
                <p className="district-description">
                  {selectedDistrict.description}
                </p>
                <div className="status-indicators">
                  <div className="status-item">
                    <span className="label">Awesomeness Level:</span>
                    <span className="value high">HIGH</span>
                  </div>
                  <div className="status-item">
                    <span className="label">Neural Activity:</span>
                    <span className="value medium">MODERATE</span>
                  </div>
                  <div className="status-item">
                    <span className="label">Data Flow:</span>
                    <span className="value active">ACTIVE</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <MapContainer
        center={SF_CENTER}
        zoom={13}
        className="cyberpunk-map"
        zoomControl={false}
        attributionControl={false}
      >
        <MapEffects />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="cyberpunk-tiles"
        />

        {DISTRICTS.map((district, index) => (
          <Marker
            key={district.name}
            position={district.coords}
            icon={createCyberpunkIcon(index % 2 === 0 ? "#8B5CF6" : "#3B82F6")}
            eventHandlers={{
              click: () => handleDistrictClick(district),
            }}
          >
            <Popup className="cyberpunk-popup">
              <div className="popup-content">
                <h3 className="popup-title">{district.cyberpunkName}</h3>
                <p className="popup-subtitle">{district.name}</p>
                <p className="popup-description">{district.description}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default CyberpunkSFMap;
