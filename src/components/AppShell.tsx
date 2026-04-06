import { Link, NavLink } from "react-router-dom";
import { useState, type ReactNode } from "react";
import type { User } from "@shared/types";
import { AddUserDialog } from "./AddUserDialog";

const navigationItems = [
  { to: "/today", label: "Today" },
  { to: "/log", label: "Log" },
  { to: "/templates", label: "Templates" },
  { to: "/foods", label: "Foods" },
  { to: "/history", label: "History" },
];

interface AppShellProps {
  children: ReactNode;
  currentUser: User | null;
  users: User[];
  currentUserId: string;
  onChangeUser: (userId: string) => void;
  onAddUser: (name: string) => Promise<unknown>;
}

export function AppShell({
  children,
  currentUser,
  users,
  currentUserId,
  onChangeUser,
  onAddUser,
}: AppShellProps) {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__eyebrow">Food Tracker</span>
          <strong>Nutrition Log</strong>
        </div>

        <nav className="sidebar__nav">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => (isActive ? "nav-link nav-link--active" : "nav-link")}
              to={item.to}
              end={item.to === "/today"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-shell__main">
        <header className="topbar">
          <div>
            <div className="topbar__title">Food Tracker</div>
            <div className="topbar__subtitle">
              {currentUser ? `Editing shared data as ${currentUser.name}` : "Select a user"}
            </div>
          </div>

          <div className="topbar__actions">
            <label className="user-picker">
              <span>User</span>
              <select value={currentUserId} onChange={(event) => onChangeUser(event.target.value)}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>

            <button className="button button--secondary" type="button" onClick={() => setIsAddUserOpen(true)}>
              Add User
            </button>

            <Link className="button button--primary" to="/today?addEntry=1">
              Quick Add
            </Link>
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>

      {isAddUserOpen ? (
        <AddUserDialog
          onClose={() => setIsAddUserOpen(false)}
          onSubmit={async (name) => {
            await onAddUser(name);
            setIsAddUserOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
