import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Custom cyberpunk pin icons
const createCyberpunkIcon = (type: string) => {
  const iconSvg = {
    corporate: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0L25 15H18V35H7V15H0L12.5 0Z" fill="#8b5cf6" stroke="#a855f7" stroke-width="2"/>
      <circle cx="12.5" cy="12" r="6" fill="#1e1b4b" stroke="#6366f1" stroke-width="1"/>
      <path d="M9 9L16 9M9 12L16 12M9 15L16 15" stroke="#60a5fa" stroke-width="1"/>
      <circle cx="12.5" cy="35" r="6" fill="#000" stroke="#a855f7" stroke-width="2"/>
    </svg>`,
    underground: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0L25 15H18V35H7V15H0L12.5 0Z" fill="#10b981" stroke="#059669" stroke-width="2"/>
      <polygon points="8,8 17,8 15,16 10,16" fill="#064e3b" stroke="#6ee7b7" stroke-width="1"/>
      <circle cx="12.5" cy="35" r="6" fill="#000" stroke="#10b981" stroke-width="2"/>
      <path d="M9 32L16 32M9 35L16 35M9 38L16 38" stroke="#6ee7b7" stroke-width="1"/>
    </svg>`,
    entertainment: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0L25 15H18V35H7V15H0L12.5 0Z" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
      <polygon points="9,9 16,9 15,15 10,15" fill="#451a03" stroke="#fbbf24" stroke-width="1"/>
      <circle cx="11" cy="11" r="1" fill="#fbbf24"/>
      <circle cx="14" cy="11" r="1" fill="#fbbf24"/>
      <circle cx="12.5" cy="35" r="6" fill="#000" stroke="#f59e0b" stroke-width="2"/>
    </svg>`,
    tech: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0L25 15H18V35H7V15H0L12.5 0Z" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
      <rect x="9" y="8" width="7" height="8" fill="#7f1d1d" stroke="#fca5a5" stroke-width="1"/>
      <circle cx="10.5" cy="10" r="0.5" fill="#fca5a5"/>
      <circle cx="14.5" cy="10" r="0.5" fill="#fca5a5"/>
      <path d="M10 13L15 13" stroke="#fca5a5" stroke-width="1"/>
      <circle cx="12.5" cy="35" r="6" fill="#000" stroke="#ef4444" stroke-width="2"/>
    </svg>`
  };
  
  return L.divIcon({
    html: iconSvg[type as keyof typeof iconSvg] || iconSvg.tech,
    className: 'cyberpunk-marker',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
  });
};

// Custom map style component
function MapStyle() {
  const map = useMap();
  
  useEffect(() => {
    // Apply dark neon cyberpunk styling
    const mapContainer = map.getContainer();
    mapContainer.style.filter = 'invert(1) grayscale(1) contrast(2) brightness(0.15)';
    mapContainer.style.transition = 'filter 0.5s ease';
    mapContainer.style.background = '#000';
  }, [map]);
  
  return null;
}

// Top cyberpunk destinations organized by SF districts
const cyberpunkDestinations = [
  // SOMA District
  {
    id: 1,
    name: "DataCorp Nexus",
    position: [37.7849, -122.4094] as [number, number],
    description: "Silicon Valley's darkest corporate tower housing illegal AI experiments",
    type: "corporate",
    district: "SOMA",
    threat_level: "EXTREME"
  },
  
  // Mission District  
  {
    id: 2,
    name: "The Underground",
    position: [37.7599, -122.4148] as [number, number],
    description: "Hidden hacker collective beneath the Mission's neon-lit streets",
    type: "underground",
    district: "Mission",
    threat_level: "HIGH"
  },
  
  // Financial District
  {
    id: 3,
    name: "Quantum Bank Vault",
    position: [37.7946, -122.4042] as [number, number],
    description: "Mega-corp financial fortress with quantum-encrypted data streams",
    type: "corporate",
    district: "Financial",
    threat_level: "MAXIMUM"
  },
  
  // Chinatown
  {
    id: 4,
    name: "Neon Dragon Market",
    position: [37.7941, -122.4078] as [number, number],
    description: "Black market cybernetic enhancement bazaar hidden in ancient alleys",
    type: "tech",
    district: "Chinatown",
    threat_level: "MODERATE"
  },
  
  // Castro District
  {
    id: 5,
    name: "Spectrum VR Lounge",
    position: [37.7609, -122.4350] as [number, number],
    description: "Underground virtual reality club with illegal neural interface tech",
    type: "entertainment",
    district: "Castro",
    threat_level: "HIGH"
  },
  
  // Haight-Ashbury
  {
    id: 6,
    name: "Memory Palace",
    position: [37.7692, -122.4481] as [number, number],
    description: "Psychedelic data storage facility where memories are bought and sold",
    type: "underground",
    district: "Haight",
    threat_level: "HIGH"
  }
];

export default function App() {
  const [activeLocation, setActiveLocation] = useState<number | null>(null);
  const [scanlinePosition, setScanlinePosition] = useState(0);
  
  // Animated scanline effect
  useEffect(() => {
    const interval = setInterval(() => {
      setScanlinePosition(prev => (prev >= 100 ? 0 : prev + 0.5));
    }, 50);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="cyberpunk-map">
      <style>{`
        body {
          margin: 0;
          padding: 0;
          background: #000;
          font-family: 'Courier New', monospace;
          overflow: hidden;
        }
        
        .cyberpunk-map {
          height: 100vh;
          width: 100vw;
          position: relative;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0f2e 50%, #0f1419 100%);
          overflow: hidden;
        }
        
        .map-container {
          height: 100%;
          width: 100%;
          position: relative;
          border: 2px solid #4c1d95;
          box-shadow: 
            0 0 20px rgba(79, 70, 229, 0.3),
            inset 0 0 20px rgba(168, 85, 247, 0.1);
        }
        
        .cyber-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 1000;
          background: 
            linear-gradient(90deg, transparent 49%, rgba(79, 70, 229, 0.15) 50%, transparent 51%),
            linear-gradient(0deg, transparent 49%, rgba(168, 85, 247, 0.08) 50%, transparent 51%);
          background-size: 30px 30px;
          animation: grid-pulse 3s ease-in-out infinite;
          mix-blend-mode: screen;
        }
        
        .scanline {
          position: absolute;
          top: ${scanlinePosition}%;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #a855f7, transparent);
          box-shadow: 0 0 10px #a855f7;
          pointer-events: none;
          z-index: 1001;
        }
        
        .hud-overlay {
          position: absolute;
          top: 20px;
          left: 20px;
          z-index: 1000;
          color: #60a5fa;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          text-shadow: 0 0 5px #60a5fa;
          background: rgba(0, 0, 0, 0.7);
          padding: 15px;
          border: 1px solid #4c1d95;
          border-radius: 4px;
          backdrop-filter: blur(10px);
        }
        
        .status-bar {
          position: absolute;
          bottom: 20px;
          left: 20px;
          right: 20px;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.8);
          border: 1px solid #4c1d95;
          border-radius: 4px;
          padding: 10px 15px;
          color: #60a5fa;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          text-shadow: 0 0 3px #60a5fa;
          backdrop-filter: blur(10px);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .location-counter {
          color: #a855f7;
          font-weight: bold;
        }
        
        .cyberpunk-marker {
          animation: pulse-glow 2s ease-in-out infinite;
          z-index: 1000 !important;
        }
        

        .leaflet-container {
          background: #000 !important;
        }
        

        .leaflet-popup-content-wrapper {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid #4c1d95 !important;
          border-radius: 4px !important;
          color: #60a5fa !important;
          font-family: 'Courier New', monospace !important;
          box-shadow: 0 0 15px rgba(79, 70, 229, 0.5) !important;
        }
        
        .leaflet-popup-content {
          color: #60a5fa !important;
          font-family: 'Courier New', monospace !important;
          font-size: 12px !important;
        }
        
        .leaflet-popup-tip {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid #4c1d95 !important;
        }
        
        .threat-high {
          color: #f59e0b !important;
          text-shadow: 0 0 5px #f59e0b;
        }
        
        .threat-extreme {
          color: #ef4444 !important;
          text-shadow: 0 0 5px #ef4444;
        }
        
        .threat-maximum {
          color: #dc2626 !important;
          text-shadow: 0 0 8px #dc2626;
          animation: blink 1s infinite;
        }
        
        @keyframes grid-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        
        @keyframes pulse-glow {
          0%, 100% { 
            filter: drop-shadow(0 0 12px #a855f7) drop-shadow(0 0 6px #60a5fa);
            transform: scale(1);
          }
          50% { 
            filter: drop-shadow(0 0 20px #a855f7) drop-shadow(0 0 10px #60a5fa);
            transform: scale(1.08);
          }
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.5; }
        }
        
        .cyber-title {
          color: #a855f7;
          font-weight: bold;
          text-shadow: 0 0 10px #a855f7;
          letter-spacing: 2px;
        }
        
        .cyber-subtitle {
          color: #4c1d95;
          font-size: 10px;
          margin-top: 5px;
        }
        
        .coordinates {
          color: #60a5fa;
          opacity: 0.7;
        }
        
        .district-tag {
          color: #8b5cf6;
          font-weight: bold;
          text-shadow: 0 0 3px #8b5cf6;
        }
      `}</style>
      
      {/* HUD Overlay */}
      <div className="hud-overlay">
        <div className="cyber-title">NEURAL MAP v3.0</div>
        <div className="cyber-subtitle">SF DISTRICT ANALYSIS</div>
        <div style={{ marginTop: '10px', fontSize: '10px' }}>
          STATUS: <span style={{ color: '#10b981' }}>ONLINE</span><br/>
          GRID: <span style={{ color: '#a855f7' }}>SYNCHRONIZED</span><br/>
          SCAN: <span style={{ color: '#60a5fa' }}>ACTIVE</span><br/>
          MODE: <span style={{ color: '#f59e0b' }}>DISTRICT TARGET</span>
        </div>
      </div>
      
      {/* Cyber Overlay Effects */}
      <div className="cyber-overlay"></div>
      <div className="scanline"></div>
      
      {/* Map Container */}
      <div className="map-container">
        <MapContainer
          center={[37.7749, -122.4194]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <MapStyle />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution=''
          />
          
          {cyberpunkDestinations.map((location) => (
            <Marker
              key={location.id}
              position={location.position}
              icon={createCyberpunkIcon(location.type)}
              eventHandlers={{
                click: () => setActiveLocation(location.id),
              }}
            >
              <Popup>
                <div style={{ padding: '8px' }}>
                  <div className="cyber-title" style={{ fontSize: '14px' }}>
                    {location.name}
                  </div>
                  <div className="district-tag" style={{ fontSize: '10px', marginTop: '3px' }}>
                    {location.district.toUpperCase()} DISTRICT
                  </div>
                  <div style={{ color: '#a855f7', fontSize: '11px', marginTop: '5px' }}>
                    TYPE: {location.type.toUpperCase()}
                  </div>
                  <div style={{ color: '#60a5fa', fontSize: '10px', marginTop: '3px' }}>
                    {location.description}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '10px' }}>
                    <span style={{ color: '#fbbf24' }}>THREAT LEVEL:</span> 
                    <span className={`threat-${location.threat_level.toLowerCase()}`}>
                      {location.threat_level}
                    </span>
                  </div>
                  <div className="coordinates" style={{ marginTop: '8px' }}>
                    LAT: {location.position[0].toFixed(4)}<br/>
                    LON: {location.position[1].toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      
      {/* Status Bar */}
      <div className="status-bar">
        <div>
          NEURAL LINK: <span style={{ color: '#10b981' }}>ESTABLISHED</span> |
          ENCRYPTION: <span style={{ color: '#a855f7' }}>AES-256</span> |
          DISTRICTS: <span style={{ color: '#8b5cf6' }}>6</span>
        </div>
        <div>
          TARGETS: <span className="location-counter">{cyberpunkDestinations.length}</span> |
          ACTIVE: <span style={{ color: activeLocation ? '#10b981' : '#60a5fa' }}>
            {activeLocation || 'NONE'}
          </span>
        </div>
      </div>
    </div>
  );
}