import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import CreateLeaguePage from "./pages/CreateLeaguePage";
import HomePage from "./pages/HomePage";
import FixturesHistoryPage from "./pages/FixturesHistoryPage";
import JoinLeaguePage from "./pages/JoinLeaguePage";
import LeaguePage from "./pages/LeaguePage";
import LivePage from "./pages/LivePage";
import LoginPage from "./pages/LoginPage";
import PickPage from "./pages/PickPage";
import ProfilePage from "./pages/ProfilePage";
import PublicLeaguesPage from "./pages/PublicLeaguesPage";
import RegisterPage from "./pages/RegisterPage";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/fixtures-history" element={<FixturesHistoryPage />} />
                <Route path="/pick" element={<PickPage />} />
                <Route path="/league/:id" element={<LeaguePage />} />
                <Route path="/live" element={<LivePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/leagues/public" element={<PublicLeaguesPage />} />
                <Route path="/create-league" element={<CreateLeaguePage />} />
                <Route path="/join" element={<JoinLeaguePage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
