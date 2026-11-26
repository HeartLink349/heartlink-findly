/*
 * Storage boundary for Don't Block Me.
 * Replace LocalQuizStore with an API/database adapter later while keeping
 * the same async methods: list, get, save, delete, addResponse, removeResponse.
 */
(function () {
  const QUIZZES_KEY = "dont-block-me-quizzes-v1";
  const ACTIVE_QUIZ_KEY = "dont-block-me-active-quiz-v1";
  const PLAYER_SUBMISSIONS_KEY = "dont-block-me-player-submissions-v1";
  const COUNTRY_KEY = "dont-block-me-country-v1";

  class LocalQuizStore {
    async list() {
      return this.readAll();
    }

    async get(id) {
      if (!id) return null;
      return this.readAll().find((quiz) => quiz.id === id) || null;
    }

    async save(quiz) {
      const quizzes = this.readAll();
      const index = quizzes.findIndex((item) => item.id === quiz.id);
      if (index === -1) quizzes.unshift(quiz);
      else quizzes[index] = quiz;
      localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes));
      return quiz;
    }

    async delete(id) {
      const quizzes = this.readAll().filter((quiz) => quiz.id !== id);
      localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes));
      if (this.getActiveCreatorQuizId() === id) {
        this.clearActiveCreatorQuizId();
      }
      return true;
    }

    async addResponse(id, response) {
      const quiz = await this.get(id);
      if (!quiz) return null;
      quiz.responses = [...(quiz.responses || []), response];
      await this.save(quiz);
      return quiz;
    }

    async removeResponse(quizId, responseId) {
      const quiz = await this.get(quizId);
      if (!quiz) return null;
      quiz.responses = (quiz.responses || []).filter((item) => item.id !== responseId);
      await this.save(quiz);
      return quiz;
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

    readAll() {
      try {
        const value = JSON.parse(localStorage.getItem(QUIZZES_KEY) || "[]");
        return Array.isArray(value) ? value : [];
      } catch {
        return [];
      }
    }
  }

  window.quizStore = new LocalQuizStore();
})();
