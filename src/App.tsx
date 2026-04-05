import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useCurrentUser } from "./hooks/useCurrentUser";
import { FoodsPage } from "./pages/FoodsPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { TodayPage } from "./pages/TodayPage";

export default function App() {
  const { users, currentUser, currentUserId, setCurrentUserId, isLoading, error } = useCurrentUser();

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
    >
      <Routes>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage currentUser={currentUser} />} />
        <Route
          path="/log"
          element={
            <PlaceholderPage
              title="Log"
              description="A filterable per-user log table will land in Phase 3."
            />
          }
        />
        <Route
          path="/templates"
          element={
            <PlaceholderPage
              title="Templates"
              description="Template management and logging from templates will land in Phase 3."
            />
          }
        />
        <Route path="/foods" element={<FoodsPage />} />
        <Route
          path="/history"
          element={
            <PlaceholderPage
              title="History"
              description="Daily totals and day-by-day detail views will land in Phase 3."
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
