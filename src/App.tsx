import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useCurrentUser } from "./hooks/useCurrentUser";
import { FoodsPage } from "./pages/FoodsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LogPage } from "./pages/LogPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { TodayPage } from "./pages/TodayPage";

export default function App() {
  const { users, currentUser, currentUserId, setCurrentUserId, createUser, isLoading, error } = useCurrentUser();

  if (isLoading) {
    return <div className="app-loading">Loading Food Tracker...</div>;
  }

  if (error) {
    return <div className="app-loading">Unable to load users: {error}</div>;
  }

  return (
    <AppShell
      users={users}
      currentUser={currentUser}
      currentUserId={currentUserId}
      onChangeUser={setCurrentUserId}
      onAddUser={createUser}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage currentUser={currentUser} />} />
        <Route path="/log" element={<LogPage currentUser={currentUser} />} />
        <Route path="/templates" element={<TemplatesPage currentUser={currentUser} />} />
        <Route path="/foods" element={<FoodsPage />} />
        <Route path="/history" element={<HistoryPage currentUser={currentUser} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
