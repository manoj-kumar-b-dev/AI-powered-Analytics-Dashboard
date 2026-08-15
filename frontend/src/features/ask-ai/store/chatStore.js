import { create } from 'zustand';

/**
 * Zustand Chat Store supporting multi-session chat history per dataset.
 * Persists sessions, active session selection, and message history to sessionStorage.
 */
const SESSIONS_STORAGE_KEY = 'saas_analytics_chat_sessions_v2';

const loadInitialSessions = () => {
  try {
    const raw = sessionStorage.getItem(SESSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('[ChatStore] Failed to load chat sessions from sessionStorage:', err);
    return {};
  }
};

const saveSessions = (sessionsMap) => {
  try {
    sessionStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessionsMap));
  } catch (err) {
    console.warn('[ChatStore] Failed to save chat sessions to sessionStorage:', err);
  }
};

export const useChatStore = create((set, get) => ({
  sessionsByDataset: loadInitialSessions(),
  activeSessionIdByDataset: {},

  // Get all sessions for a datasetId
  getSessions: (datasetId) => {
    if (!datasetId) return [];
    return get().sessionsByDataset[datasetId] || [];
  },

  // Get active session ID for a datasetId (or initialize default if none)
  getActiveSessionId: (datasetId) => {
    if (!datasetId) return null;
    const currentActive = get().activeSessionIdByDataset[datasetId];
    const sessions = get().sessionsByDataset[datasetId] || [];

    if (currentActive && sessions.some(s => s.id === currentActive)) {
      return currentActive;
    }

    if (sessions.length > 0) {
      const firstId = sessions[0].id;
      set((state) => ({
        activeSessionIdByDataset: { ...state.activeSessionIdByDataset, [datasetId]: firstId }
      }));
      return firstId;
    }

    // Auto-create initial session if none exists
    const newSessionId = `session-${Date.now()}`;
    const newSession = {
      id: newSessionId,
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      messages: []
    };

    set((state) => {
      const updatedDatasetSessions = [newSession];
      const updatedMap = {
        ...state.sessionsByDataset,
        [datasetId]: updatedDatasetSessions
      };
      saveSessions(updatedMap);

      return {
        sessionsByDataset: updatedMap,
        activeSessionIdByDataset: { ...state.activeSessionIdByDataset, [datasetId]: newSessionId }
      };
    });

    return newSessionId;
  },

  // Set active session ID for a datasetId
  setActiveSessionId: (datasetId, sessionId) => {
    if (!datasetId || !sessionId) return;
    set((state) => ({
      activeSessionIdByDataset: { ...state.activeSessionIdByDataset, [datasetId]: sessionId }
    }));
  },

  // Create a new session for a datasetId
  createNewSession: (datasetId) => {
    if (!datasetId) return null;
    const newSessionId = `session-${Date.now()}`;
    const newSession = {
      id: newSessionId,
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      messages: []
    };

    set((state) => {
      const currentList = state.sessionsByDataset[datasetId] || [];
      const updatedList = [newSession, ...currentList];
      const updatedMap = {
        ...state.sessionsByDataset,
        [datasetId]: updatedList
      };

      saveSessions(updatedMap);

      return {
        sessionsByDataset: updatedMap,
        activeSessionIdByDataset: { ...state.activeSessionIdByDataset, [datasetId]: newSessionId }
      };
    });

    return newSessionId;
  },

  // Get active session messages
  getActiveMessages: (datasetId) => {
    if (!datasetId) return [];
    const activeId = get().getActiveSessionId(datasetId);
    const sessions = get().sessionsByDataset[datasetId] || [];
    const activeSession = sessions.find(s => s.id === activeId);
    return activeSession ? activeSession.messages : [];
  },

  // Add message to active session
  addMessageToActiveSession: (datasetId, message) => {
    if (!datasetId) return;
    const activeId = get().getActiveSessionId(datasetId);

    set((state) => {
      const sessions = state.sessionsByDataset[datasetId] || [];
      let sessionIndex = sessions.findIndex(s => s.id === activeId);

      let currentSessions = [...sessions];
      if (sessionIndex === -1) {
        // Fallback: create session if missing
        const newSession = {
          id: activeId || `session-${Date.now()}`,
          title: 'New Chat',
          createdAt: new Date().toISOString(),
          messages: []
        };
        currentSessions.unshift(newSession);
        sessionIndex = 0;
      }

      const targetSession = currentSessions[sessionIndex];
      const updatedMessages = [...targetSession.messages, message];

      // Auto-update session title from first user message if title is "New Chat"
      let newTitle = targetSession.title;
      if ((newTitle === 'New Chat' || !newTitle) && message.sender === 'user' && message.text) {
        newTitle = message.text.length > 28 ? message.text.substring(0, 28) + '...' : message.text;
      }

      const updatedSession = {
        ...targetSession,
        title: newTitle,
        messages: updatedMessages
      };

      currentSessions[sessionIndex] = updatedSession;

      const updatedMap = {
        ...state.sessionsByDataset,
        [datasetId]: currentSessions
      };

      saveSessions(updatedMap);

      return { sessionsByDataset: updatedMap };
    });
  },

  // Delete a session
  deleteSession: (datasetId, sessionId) => {
    if (!datasetId || !sessionId) return;

    set((state) => {
      const currentList = state.sessionsByDataset[datasetId] || [];
      const updatedList = currentList.filter(s => s.id !== sessionId);

      const updatedMap = {
        ...state.sessionsByDataset,
        [datasetId]: updatedList
      };

      saveSessions(updatedMap);

      let nextActiveId = state.activeSessionIdByDataset[datasetId];
      if (nextActiveId === sessionId) {
        nextActiveId = updatedList.length > 0 ? updatedList[0].id : null;
      }

      return {
        sessionsByDataset: updatedMap,
        activeSessionIdByDataset: { ...state.activeSessionIdByDataset, [datasetId]: nextActiveId }
      };
    });
  },

  // Backward compatibility helper
  get chatByDataset() {
    const raw = get().sessionsByDataset;
    const res = {};
    Object.keys(raw).forEach(dsId => {
      const firstSess = raw[dsId]?.[0];
      res[dsId] = firstSess ? firstSess.messages : [];
    });
    return res;
  },

  addMessage: (datasetId, message) => {
    get().addMessageToActiveSession(datasetId, message);
  }
}));
