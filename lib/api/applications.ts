export async function applyToProject(projectId: number) {
    const token = localStorage.getItem("token");
    if (!token) {
        throw new Error("Authentication required");
    }

    const response = await fetch(`/api/projects/${projectId}/apply`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to apply to project");
    }

    return response.json();
}
