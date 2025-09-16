import React from "react";
import CyberpunkSFMap from "./components/CyberpunkSFMap";
import "./styles/global.css";

const App: React.FC = () => {
  return (
    <div className="app">
      <div className="app-header">
        <h1 className="cyberpunk-title">San Francisco 2077</h1>
        <p className="subtitle">Neural Interface Map System</p>
      </div>
      <CyberpunkSFMap />
    </div>
  );
};

export default App;
