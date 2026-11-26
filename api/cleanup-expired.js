import { metric } from "@vercel/functions";
import { handleSchedule } from "@vercel/schedules";

const FIREBASE_DB_URL = "https://heartlink-eg-default-rtdb.firebaseio.com";
const ID_RE = /^[a-zA-Z0-9_-]{8,32}$/;

async function purgeExpiredQuizzes() {
  const nowMs = Date.now();
  const queryUrl = `${FIREBASE_DB_URL}/findly_expiry.json?orderBy=%22$value%22&endAt=${nowMs}`;
  const res = await fetch(queryUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Firebase expiry query failed (${res.status})`);
  }

  const data = await res.json();
  if (!data || typeof data !== "object") {
    return 0;
  }

  const expiredIds = Object.keys(data).filter(
    (id) => ID_RE.test(id) && typeof data[id] === "number" && data[id] <= nowMs
  );

  if (!expiredIds.length) {
    return 0;
  }

  let deleted = 0;
  const CHUNK_SIZE = 40;
  for (let i = 0; i < expiredIds.length; i += CHUNK_SIZE) {
    const chunk = expiredIds.slice(i, i + CHUNK_SIZE);
    const patch = {};
    for (const id of chunk) {
      patch[`findly_quizzes/${id}`] = null;
      patch[`findly_expiry/${id}`] = null;
      patch[`findly_owners/${id}`] = null;
      patch[`findly_proof/${id}`] = null;
    }

    const delRes = await fetch(`${FIREBASE_DB_URL}/.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });

    if (!delRes.ok) {
      const errText = await delRes.text().catch(() => "");
      throw new Error(`Firebase purge PATCH failed (${delRes.status}): ${errText}`);
    }
    deleted += chunk.length;
  }

  return deleted;
}

export const POST = handleSchedule(async (metadata) => {
  const startedAt = performance.now();
  try {
    const deleted = await purgeExpiredQuizzes();
    metric("findly.cleanup.runs", 1, { outcome: "success" });
    metric("findly.cleanup.deleted", deleted, { outcome: "success" });
    console.log(
      `[cleanup-expired] run=${metadata.executionId} deleted=${deleted} scheduledAt=${metadata.scheduledAt.toISOString()}`
    );
  } catch (error) {
    metric("findly.cleanup.runs", 1, { outcome: "error" });
    console.error("[cleanup-expired] error:", error);
    throw error;
  } finally {
    metric("findly.cleanup.duration_ms", performance.now() - startedAt);
  }
});
