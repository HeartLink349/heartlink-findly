/*
 * Firebase Realtime Database storage adapter for HeartLink Findly (heartlink-eg).
 * - Persists quizzes and friend responses in Firebase RTDB under /findly_quizzes/{id}
 * - Enforces strict 24-hour TTL (86,400,000 ms) synced to Firebase server time
 * - Permanently deletes expired quizzes & wipes creator local data after 24 hours
 * - Authorizes creator-only deletion of quiz or individual friend responses via private owner token
 */
(function () {
  const FIREBASE_DB_URL = "https://heartlink-eg-default-rtdb.firebaseio.com";
  const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours exact

  const QUIZZES_KEY = "dont-block-me-quizzes-v1";
  const ACTIVE_QUIZ_KEY = "dont-block-me-active-quiz-v1";
  const OWNER_TOKENS_KEY = "dont-block-me-owner-tokens-v1";
  const PLAYER_SUBMISSIONS_KEY = "dont-block-me-player-submissions-v1";
  const COUNTRY_KEY = "dont-block-me-country-v1";

  function randomToken(len = 32) {
    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    if (window.crypto && crypto.getRandomValues) {
      const bytes = new Uint8Array(len);
      crypto.getRandomValues(bytes);
      let out = "";
      for (let i = 0; i < len; i += 1) out += alphabet[bytes[i] % alphabet.length];
      return out;
    }
    let out = "";
    while (out.length < len) out += Math.random().toString(36).slice(2);
    return out.slice(0, len);
  }

  function validId(id) {
    return typeof id === "string" && /^[a-zA-Z0-9_-]{8,32}$/.test(id);
  }

  function normalizeResponses(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (raw && typeof raw === "object") return Object.values(raw).filter(Boolean);
    return [];
  }

  function normalizeQuestions(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (raw && typeof raw === "object") {
      return Object.keys(raw)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => raw[k])
        .filter(Boolean);
    }
    return [];
  }

  function normalizeQuiz(raw) {
    if (!raw || typeof raw !== "object" || !raw.id) return null;
    const createdAtMs = typeof raw.createdAtMs === "number"
      ? raw.createdAtMs
      : (Date.parse(raw.createdAt) || Date.now());
    const expiresAt = typeof raw.expiresAt === "number"
      ? raw.expiresAt
      : createdAtMs + TTL_MS;
    return {
      id: String(raw.id),
      ownerName: String(raw.ownerName || ""),
      gender: raw.gender === "male" ? "male" : "female",
      language: raw.language === "en" ? "en" : "ar",
      country: String(raw.country || "EG"),
      questions: normalizeQuestions(raw.questions).map((q) => ({
        id: String(q.id || ""),
        question: String(q.question || ""),
        options: Array.isArray(q.options) ? q.options.map(String) : Object.values(q.options || {}).map(String),
        correctAnswer: Number(q.correctAnswer ?? 0)
      })),
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date(createdAtMs).toISOString(),
      createdAtMs,
      expiresAt,
      responses: normalizeResponses(raw.responses).map((r) => ({
        id: String(r.id || ""),
        name: String(r.name || ""),
        guesses: Array.isArray(r.guesses) ? r.guesses.map(Number) : Object.values(r.guesses || {}).map(Number),
        score: Number(r.score ?? 0),
        createdAt: String(r.createdAt || "")
      }))
    };
  }

  class FirebaseQuizStore {
    constructor() {
      this.serverOffsetMs = 0;
      this.serverTimeSynced = false;
      this.lastSweepAt = 0;
    }

    serverNow() {
      return Date.now() + this.serverOffsetMs;
    }

    captureServerDate(res) {
      try {
        const hdr = res?.headers?.get("date");
        if (hdr) {
          const parsed = Date.parse(hdr);
          if (!Number.isNaN(parsed)) {
            this.serverOffsetMs = parsed - Date.now();
            this.serverTimeSynced = true;
          }
        }
      } catch {}
    }

    async syncServerTime() {
      if (this.serverTimeSynced) return;
      try {
        const res = await fetch(`${FIREBASE_DB_URL}/findly_expiry.json?shallow=true`, {
          method: "GET",
          cache: "no-store"
        });
        this.captureServerDate(res);
      } catch {}
    }

    isExpired(quiz) {
      if (!quiz) return true;
      const exp = typeof quiz.expiresAt === "number"
        ? quiz.expiresAt
        : ((typeof quiz.createdAtMs === "number" ? quiz.createdAtMs : Date.parse(quiz.createdAt)) + TTL_MS);
      return Number.isFinite(exp) && this.serverNow() >= exp;
    }

    async fbFetch(path, options = {}) {
      const res = await fetch(`${FIREBASE_DB_URL}${path}`, {
        cache: "no-store",
        ...options,
        headers: {
          ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {})
        }
      });
      this.captureServerDate(res);
      return res;
    }

    readOwnerTokens() {
      try {
        const parsed = JSON.parse(localStorage.getItem(OWNER_TOKENS_KEY) || "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    }

    getOwnerToken(id) {
      return this.readOwnerTokens()[id] || "";
    }

    setOwnerToken(id, token) {
      try {
        const map = this.readOwnerTokens();
        map[id] = token;
        localStorage.setItem(OWNER_TOKENS_KEY, JSON.stringify(map));
      } catch {}
    }

    clearLocalQuizData(id) {
      try {
        const filtered = this.readAllLocal().filter((q) => q.id !== id);
        localStorage.setItem(QUIZZES_KEY, JSON.stringify(filtered));
      } catch {}
      if (this.getActiveCreatorQuizId() === id) {
        this.clearActiveCreatorQuizId();
      }
      try {
        const tokens = this.readOwnerTokens();
        if (id in tokens) {
          delete tokens[id];
          localStorage.setItem(OWNER_TOKENS_KEY, JSON.stringify(tokens));
        }
      } catch {}
      try {
        const subs = JSON.parse(localStorage.getItem(PLAYER_SUBMISSIONS_KEY) || "{}");
        if (subs && typeof subs === "object" && id in subs) {
          delete subs[id];
          localStorage.setItem(PLAYER_SUBMISSIONS_KEY, JSON.stringify(subs));
        }
      } catch {}
    }

    cacheLocalQuiz(quiz) {
      try {
        const list = this.readAllLocal().filter((q) => q.id !== quiz.id && !this.isExpired(q));
        list.unshift(quiz);
        localStorage.setItem(QUIZZES_KEY, JSON.stringify(list.slice(0, 10)));
      } catch {}
    }

    async purgeExpiredQuizFromFirebase(id) {
      if (!validId(id)) return;
      try {
        await this.fbFetch("/.json", {
          method: "PATCH",
          body: JSON.stringify({
            [`findly_quizzes/${id}`]: null,
            [`findly_expiry/${id}`]: null,
            [`findly_owners/${id}`]: null,
            [`findly_proof/${id}`]: null
          })
        });
      } catch {}
    }

    async sweepExpiredInBackground() {
      const now = this.serverNow();
      if (now - this.lastSweepAt < 120000) return;
      this.lastSweepAt = now;
      try {
        const res = await this.fbFetch(`/findly_expiry.json?orderBy=%22$value%22&endAt=${Math.floor(now)}&limitToFirst=15`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data || typeof data !== "object") return;
        const expiredIds = Object.keys(data).filter((id) => validId(id) && typeof data[id] === "number" && data[id] <= now);
        if (!expiredIds.length) return;
        const patch = {};
        expiredIds.forEach((id) => {
          patch[`findly_quizzes/${id}`] = null;
          patch[`findly_expiry/${id}`] = null;
          patch[`findly_owners/${id}`] = null;
          patch[`findly_proof/${id}`] = null;
          this.clearLocalQuizData(id);
        });
        await this.fbFetch("/.json", {
          method: "PATCH",
          body: JSON.stringify(patch)
        });
      } catch {}
    }

    async list() {
      const local = this.readAllLocal();
      const active = [];
      for (const item of local) {
        const q = normalizeQuiz(item);
        if (!q) continue;
        if (this.isExpired(q)) {
          this.clearLocalQuizData(q.id);
          void this.purgeExpiredQuizFromFirebase(q.id);
        } else {
          active.push(q);
        }
      }
      return active;
    }

    async get(id) {
      if (!validId(id)) return null;

      // Fast-check local copy expiry first
      const cached = this.readAllLocal().find((item) => item.id === id);
      if (cached) {
        const normCached = normalizeQuiz(cached);
        if (normCached && this.isExpired(normCached)) {
          this.clearLocalQuizData(id);
          await this.purgeExpiredQuizFromFirebase(id);
          return null;
        }
      }

      try {
        const res = await this.fbFetch(`/findly_quizzes/${encodeURIComponent(id)}.json`, { method: "GET" });
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          // Denied by expiresAt > now rule or already deleted
          this.clearLocalQuizData(id);
          void this.purgeExpiredQuizFromFirebase(id);
          return null;
        }
        if (!res.ok) {
          throw new Error(`Firebase read failed (${res.status})`);
        }
        const raw = await res.json();
        if (!raw) {
          this.clearLocalQuizData(id);
          return null;
        }
        const quiz = normalizeQuiz(raw);
        if (!quiz || this.isExpired(quiz)) {
          this.clearLocalQuizData(id);
          await this.purgeExpiredQuizFromFirebase(id);
          return null;
        }
        if (this.getActiveCreatorQuizId() === id) {
          this.cacheLocalQuiz(quiz);
        }
        return quiz;
      } catch (err) {
        // Offline fallback only for unexpired local creator cache
        if (cached) {
          const fallback = normalizeQuiz(cached);
          if (fallback && !this.isExpired(fallback)) return fallback;
        }
        console.error("[FirebaseQuizStore.get]", err);
        return null;
      }
    }

    async save(quizInput) {
      await this.syncServerTime();
      const id = validId(quizInput.id) ? quizInput.id : randomToken(12);
      const createdAtMs = Math.floor(this.serverNow());
      const expiresAt = createdAtMs + TTL_MS;
      const ownerToken = randomToken(32);

      const questions = normalizeQuestions(quizInput.questions).slice(0, 15).map((q) => ({
        id: String(q.id || "").slice(0, 16),
        question: String(q.question || "").slice(0, 300),
        options: (Array.isArray(q.options) ? q.options : []).slice(0, 20).map((o) => String(o).slice(0, 160)),
        correctAnswer: Math.max(0, Math.min(20, Number(q.correctAnswer ?? 0)))
      }));

      const payload = {
        id,
        ownerName: String(quizInput.ownerName || "").trim().slice(0, 60),
        gender: quizInput.gender === "male" ? "male" : "female",
        language: quizInput.language === "en" ? "en" : "ar",
        country: String(quizInput.country || "EG").slice(0, 8),
        questions,
        createdAt: new Date(createdAtMs).toISOString(),
        createdAtMs,
        expiresAt
      };

      const res = await this.fbFetch("/.json", {
        method: "PATCH",
        body: JSON.stringify({
          [`findly_quizzes/${id}`]: payload,
          [`findly_expiry/${id}`]: expiresAt,
          [`findly_owners/${id}`]: ownerToken
        })
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Failed to save quiz to Firebase (${res.status}): ${detail}`);
      }

      const saved = normalizeQuiz({ ...payload, responses: {} });
      this.setOwnerToken(id, ownerToken);
      this.cacheLocalQuiz(saved);
      void this.sweepExpiredInBackground();
      return saved;
    }

    async delete(id) {
      if (!validId(id)) return false;
      const ownerToken = this.getOwnerToken(id);

      try {
        if (ownerToken) {
          await this.fbFetch("/.json", {
            method: "PATCH",
            body: JSON.stringify({
              [`findly_proof/${id}`]: ownerToken,
              [`findly_quizzes/${id}`]: null,
              [`findly_expiry/${id}`]: null,
              [`findly_owners/${id}`]: null
            })
          });
          await this.fbFetch(`/findly_proof/${encodeURIComponent(id)}.json`, { method: "DELETE" });
        } else {
          await this.purgeExpiredQuizFromFirebase(id);
        }
      } catch (err) {
        console.error("[FirebaseQuizStore.delete]", err);
      }

      this.clearLocalQuizData(id);
      return true;
    }

    async addResponse(id, responseInput) {
      if (!validId(id)) return null;
      const respId = validId(responseInput.id) ? responseInput.id : randomToken(12);
      const payload = {
        id: respId,
        name: String(responseInput.name || "").trim().slice(0, 60),
        guesses: (Array.isArray(responseInput.guesses) ? responseInput.guesses : []).slice(0, 15).map((g) => Math.max(0, Math.min(20, Number(g ?? 0)))),
        score: Math.max(0, Math.min(15, Number(responseInput.score ?? 0))),
        createdAt: typeof responseInput.createdAt === "string" ? responseInput.createdAt : new Date(this.serverNow()).toISOString()
      };

      const res = await this.fbFetch(`/findly_quizzes/${encodeURIComponent(id)}/responses/${encodeURIComponent(respId)}.json`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      if (res.status === 401 || res.status === 403) {
        this.clearLocalQuizData(id);
        void this.purgeExpiredQuizFromFirebase(id);
        return null;
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Failed to submit response (${res.status}): ${detail}`);
      }

      return this.get(id);
    }

    async removeResponse(quizId, responseId) {
      if (!validId(quizId) || !validId(responseId)) return null;
      const ownerToken = this.getOwnerToken(quizId);
      if (!ownerToken) return this.get(quizId);

      const res = await this.fbFetch("/.json", {
        method: "PATCH",
        body: JSON.stringify({
          [`findly_proof/${quizId}`]: ownerToken,
          [`findly_quizzes/${quizId}/responses/${responseId}`]: null
        })
      });

      await this.fbFetch(`/findly_proof/${encodeURIComponent(quizId)}.json`, { method: "DELETE" }).catch(() => {});

      if (!res.ok) {
        console.error("[FirebaseQuizStore.removeResponse] failed", res.status);
      }
      return this.get(quizId);
    }

    getActiveCreatorQuizId() {
      try {
        return localStorage.getItem(ACTIVE_QUIZ_KEY) || "";
      } catch {
        return "";
      }
    }

    setActiveCreatorQuizId(id) {
      try {
        if (id) localStorage.setItem(ACTIVE_QUIZ_KEY, id);
      } catch {}
    }

    clearActiveCreatorQuizId() {
      try {
        localStorage.removeItem(ACTIVE_QUIZ_KEY);
      } catch {}
    }

    getPlayerSubmission(quizId) {
      try {
        const map = JSON.parse(localStorage.getItem(PLAYER_SUBMISSIONS_KEY) || "{}");
        return map && typeof map === "object" ? map[quizId] || null : null;
      } catch {
        return null;
      }
    }

    setPlayerSubmission(quizId, responseId) {
      try {
        const map = JSON.parse(localStorage.getItem(PLAYER_SUBMISSIONS_KEY) || "{}");
        map[quizId] = responseId;
        localStorage.setItem(PLAYER_SUBMISSIONS_KEY, JSON.stringify(map));
      } catch {}
    }

    getCountry() {
      try {
        return localStorage.getItem(COUNTRY_KEY) || "EG";
      } catch {
        return "EG";
      }
    }

    setCountry(code) {
      try {
        localStorage.setItem(COUNTRY_KEY, code);
      } catch {}
    }

    readAllLocal() {
      try {
        const value = JSON.parse(localStorage.getItem(QUIZZES_KEY) || "[]");
        return Array.isArray(value) ? value : [];
      } catch {
        return [];
      }
    }
  }

  window.quizStore = new FirebaseQuizStore();
})();
