import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Dash } from "./pages/Dash/Dash";
import { Org } from "./pages/Org/Org";
import { Board } from "./pages/Board/Board";
import { Auth } from "./pages/Auth/Auth";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />

        <Route path="/dashboard" element={<Dash />} />

        <Route path="/org/:orgId" element={<Org />} />

        <Route path="/org/:orgId/board/:boardId" element={<Board />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
