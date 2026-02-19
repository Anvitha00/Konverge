import { API_BASE, handleResponse } from './base';

export interface PendingRating {
    ratingId: number;
    projectId: number | null;
    projectTitle: string | null;
    ratee: {
        id: number;
        name: string;
        email: string;
    };
    createdAt: string;
}

export interface SubmitRatingPayload {
    score: number;
    feedback?: string;
    raterId: number;
}

export async function getPendingRatings(userId: number | string) {
    const res = await fetch(`${API_BASE}/ratings/pending?user_id=${userId}`);
    const data = await handleResponse<{ ratings: any[] }>(res);
    return data.ratings.map((rating) => ({
        ratingId: rating.rating_id,
        projectId: rating.project_id,
        projectTitle: rating.project_title ?? null,
        ratee: {
            id: rating.ratee_id,
            name: rating.ratee_name,
            email: rating.ratee_email,
        },
        createdAt: rating.created_at,
    })) as PendingRating[];
}

export async function submitRating(ratingId: number, payload: SubmitRatingPayload) {
    const res = await fetch(`${API_BASE}/ratings/${ratingId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            score: payload.score,
            feedback: payload.feedback,
            rater_id: payload.raterId,
        }),
    });
    return handleResponse<{ rating: any }>(res);
}
