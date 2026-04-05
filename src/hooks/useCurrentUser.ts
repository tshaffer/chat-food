import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { User } from "@shared/types";

const storageKey = "food-tracker.current-user-id";

export function useCurrentUser() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setIsLoading(true);
      setError("");

      try {
        const nextUsers = await api.getUsers();
        if (cancelled) {
          return;
        }

        setUsers(nextUsers);

        const storedUserId = window.localStorage.getItem(storageKey);
        const selectedUser = nextUsers.find((user) => user.id === storedUserId) ?? nextUsers[0] ?? null;
        setCurrentUserId(selectedUser?.id ?? "");
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (currentUserId) {
      window.localStorage.setItem(storageKey, currentUserId);
    }
  }, [currentUserId]);

  const currentUser = users.find((user) => user.id === currentUserId) ?? null;

  return {
    users,
    currentUser,
    currentUserId,
    setCurrentUserId,
    isLoading,
    error,
  };
}
