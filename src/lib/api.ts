import type {
  AddFromTemplateInput,
  Food,
  FoodInput,
  LogEntry,
  LogEntryInput,
  TemplateInput,
  TemplateWithItems,
  User,
} from "@shared/types";

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
  getLogEntries: (
    userId: string,
    filters?: {
      date?: string;
      startDate?: string;
      endDate?: string;
    },
  ) => {
    const searchParams = new URLSearchParams();

    if (filters?.date) {
      searchParams.set("date", filters.date);
    }

    if (filters?.startDate) {
      searchParams.set("startDate", filters.startDate);
    }

    if (filters?.endDate) {
      searchParams.set("endDate", filters.endDate);
    }

    const query = searchParams.toString();

    return request<LogEntry[]>(`/api/users/${userId}/log-entries${query ? `?${query}` : ""}`);
  },
  createLogEntry: (userId: string, input: LogEntryInput) =>
    request<LogEntry>(`/api/users/${userId}/log-entries`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateLogEntry: (id: string, input: LogEntryInput) =>
    request<LogEntry>(`/api/log-entries/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteLogEntry: (id: string) =>
    request<void>(`/api/log-entries/${id}`, {
      method: "DELETE",
    }),
  getTemplates: (userId: string) => request<TemplateWithItems[]>(`/api/users/${userId}/templates`),
  createTemplate: (userId: string, input: TemplateInput) =>
    request<TemplateWithItems>(`/api/users/${userId}/templates`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateTemplate: (id: string, input: TemplateInput) =>
    request<TemplateWithItems>(`/api/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteTemplate: (id: string) =>
    request<void>(`/api/templates/${id}`, {
      method: "DELETE",
    }),
  addEntriesFromTemplate: (userId: string, input: AddFromTemplateInput) =>
    request<LogEntry[]>(`/api/users/${userId}/log-entries/from-template`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
