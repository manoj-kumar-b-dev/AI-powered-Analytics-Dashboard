/**
 * ChatAnswerContextBuilder
 *
 * Prepares compact evidence and contextual payload for the LLM Answer Generator.
 * Prevents passing raw 1000+ dataset rows to the LLM during answer synthesis.
 */
class ChatAnswerContextBuilder {
  /**
   * Build answer synthesis context.
   * @param {string} question - Original user question
   * @param {Object} queryPlan - Validated Query Plan
   * @param {Object} executionResult - Output from QueryExecutor
   * @param {Object} conversationContext - Recent chat turns
   * @returns {Object} Answer Context payload
   */
  buildContext(question, queryPlan, executionResult, conversationContext) {
    return {
      question,
      intent: queryPlan.intent,
      metric: queryPlan.metric?.column,
      dimension: queryPlan.dimension?.column,
      evidence: executionResult.evidence,
      analysisResult: executionResult.analysis,
      methodology: executionResult.methodology,
      recentTurns: conversationContext.recentTurns || []
    };
  }
}

module.exports = new ChatAnswerContextBuilder();
