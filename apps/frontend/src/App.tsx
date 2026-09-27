import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { session } from "./lib/api";
import { live } from "./lib/ws";
import { Auth } from "./pages/Auth/Auth";
import { Dash } from "./pages/Dash/Dash";
import { OrgLayout } from "./pages/Org/OrgLayout";
import { Boards } from "./pages/Org/Boards";
import { Members } from "./pages/Org/Members";
import { Invites } from "./pages/Org/Invites";
import { Board } from "./pages/Board/Board";

function Guarded() {
  const location = useLocation();

  useEffect(() => {
    if (session.token) live.start();
    return () => {
      if (!session.token) live.stop();
    };
  }, []);

  if (!session.token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />

        <Route element={<Guarded />}>
          <Route path="/dashboard" element={<Dash />} />

          <Route path="/org/:orgId" element={<OrgLayout />}>
            <Route index element={<Boards />} />
            <Route path="members" element={<Members />} />
            <Route path="invites" element={<Invites />} />
            <Route path="board/:boardId" element={<Board />} />
          </Route>
        </Route>

        <Route
          path="*"
          element={<Navigate to={session.token ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
