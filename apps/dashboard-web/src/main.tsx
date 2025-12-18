import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";


function Overview() {
  return <div className="p-6">linBoard Overview (v0.1)</div>;
}
function Rooms() {
  return <div className="p-6">Rooms (stub)</div>;
}
function Panels() {
  return <div className="p-6">Panels (stub)</div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/panels/*" element={<Panels />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

