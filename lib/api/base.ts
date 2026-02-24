export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";
export const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE || "ws://localhost:8000/ws";

export async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(errorText || `Request failed with status ${response.status}`);
        (error as any).status = response.status;
        throw error;
    }
    return response.json();
}
