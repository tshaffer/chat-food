import type { Food, FoodInput, User } from "@shared/types";

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  getUsers: () => request<User[]>("/api/users"),
  createUser: (input: { name: string }) =>
    request<User>("/api/users", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getFoods: () => request<Food[]>("/api/foods"),
  createFood: (input: FoodInput) =>
    request<Food>("/api/foods", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateFood: (id: string, input: FoodInput) =>
    request<Food>(`/api/foods/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteFood: (id: string) =>
    request<void>(`/api/foods/${id}`, {
      method: "DELETE",
    }),
};
