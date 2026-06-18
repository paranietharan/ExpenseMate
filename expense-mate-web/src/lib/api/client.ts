class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "An error occurred";
    try {
      const errorText = await response.text();
      message = errorText || response.statusText;
    } catch {
      message = response.statusText;
    }
    throw new ApiError(message, response.status);
  }

  // Handle empty bodies (e.g. 204 No Content, or DELETE requests)
  if (response.status === 204) {
    return {} as T;
  }

  try {
    return await response.json() as T;
  } catch {
    // If it's not JSON but was OK, return text or empty object
    return {} as T;
  }
}

export const api = {
  async get<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });
    return handleResponse<T>(res);
  },

  async post<T, U = any>(url: string, body?: U): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async put<T, U = any>(url: string, body?: U): Promise<T> {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async delete<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        "Accept": "application/json",
      },
    });
    return handleResponse<T>(res);
  },
};
