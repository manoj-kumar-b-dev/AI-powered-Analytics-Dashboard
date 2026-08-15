/**
 * ConversationContextBuilder
 *
 * Extracts and formats recent multi-turn chat history into a compact,
 * bounded context window for the LLM Query Planner.
 * Enables resolution of follow-up questions ("Which one grew fastest?", "What about last month?").
 */
class ConversationContextBuilder {
  /**
   * Build conversation context from raw message history.
   * @param {Array<Object>} history - Message array from frontend/sessionStore
   * @param {number} maxTurns - Maximum previous turns to include (default: 4)
   * @returns {Object} Compact conversation context
   */
  buildContext(history = [], maxTurns = 4) {
    if (!Array.isArray(history) || history.length === 0) {
      return { recentTurns: [], lastQueryPlan: null, lastEntity: null, lastMetric: null };
    }

    // Filter relevant user/ai turns
    const validMsgs = history.filter(m => m.text || m.data?.answer);
    const recent = validMsgs.slice(-maxTurns * 2);

    let lastQueryPlan = null;
    let lastEntity = null;
    let lastMetric = null;

    // Scan backwards to find last executed analysis specs
    for (let i = validMsgs.length - 1; i >= 0; i--) {
      const msg = validMsgs[i];
      if (msg.sender === 'ai' && msg.data?.analysis) {
        lastQueryPlan = msg.data.analysis;
        lastMetric = msg.data.analysis.metric;
        lastEntity = msg.data.analysis.groupBy || msg.data.analysis.filterColumn;
        break;
      }
    }

    const turns = recent.map(m => {
      if (m.sender === 'user') {
        return `User: "${m.text}"`;
      }
      return `AI Answer: "${m.data?.answer || 'Response generated'}"`;
    });

    return {
      recentTurns: turns,
      lastQueryPlan,
      lastEntity,
      lastMetric,
      contextSummary: turns.length > 0 ? turns.join('\n') : 'No prior turn.'
    };
  }
}

module.exports = new ConversationContextBuilder();
