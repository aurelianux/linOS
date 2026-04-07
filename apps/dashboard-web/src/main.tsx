import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HaProvider } from "./lib/ha/provider";
import { AppShell } from "./components/layout/AppShell";
import { PageErrorBoundary } from "./components/common/PageErrorBoundary";
import { SmarthomePage } from "./pages/SmarthomePage";
import { TimerPage } from "./pages/TimerPage";
import { AdminPage } from "./pages/AdminPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HaProvider>
      <BrowserRouter>
        <AppShell>
          <PageErrorBoundary>
            <Routes>
              <Route path="/" element={<SmarthomePage />} />
              <Route path="/timer" element={<TimerPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PageErrorBoundary>
        </AppShell>
      </BrowserRouter>
    </HaProvider>
  </React.StrictMode>
);
