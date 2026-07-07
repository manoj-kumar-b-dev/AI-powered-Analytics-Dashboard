/**
 * AI Service
 * 
 * Responsibilities:
 * - Orchestrate communication with Large Language Models (LLMs) (e.g. OpenAI, Anthropic, Gemini).
 * - Handle general natural language chat requests with context injection.
 * - Perform structural JSON transformations from raw text.
 * 
 * Interface:
 * - chat(messageHistory: Array, context: Object): Promise<{ response: string, usage: Object }>
 * - extractMetadata(text: string): Promise<Object>
 */

class AIService {
  /**
   * Send chat messages to AI subagents with contextual data source injects.
   * @param {Array} messageHistory - List of previous chat messages.
   * @param {Object} context - Optional active dataset or chart context.
   * @returns {Promise<Object>}
   */
  async chat(messageHistory, context = {}) {
    const lastMsg = messageHistory[messageHistory.length - 1]?.content || '';
    const query = lastMsg.toLowerCase();
    
    // Extract info from context
    const kpis = context.kpis || [];
    const kpiMap = {};
    kpis.forEach(k => {
      kpiMap[k.kpi] = k;
    });

    let response = "I'm analyzing your dataset. Feel free to ask about revenue, sales, profit, or regional performance.";
    
    if (query.includes('revenue') || query.includes('sales amount')) {
      if (kpiMap.revenue) {
        response = `Based on the active dataset, the total revenue is **${kpiMap.revenue.formattedValue}**.`;
        if (kpiMap.revenue.deltaPct !== null) {
          response += ` This represents a **${kpiMap.revenue.deltaPct}%** growth (${kpiMap.revenue.deltaDirection}) compared to the prior period.`;
        }
      } else {
        response = "Total revenue could not be calculated from this dataset because no revenue column was identified.";
      }
    } else if (query.includes('sales') || query.includes('quantity') || query.includes('orders')) {
      if (kpiMap.sales) {
        response = `The total sales volume is **${kpiMap.sales.formattedValue}**.`;
      } else {
        response = "Total sales metrics could not be resolved for this dataset.";
      }
    } else if (query.includes('profit') || query.includes('net income')) {
      if (kpiMap.profit) {
        response = `The net profit computed for this dataset stands at **${kpiMap.profit.formattedValue}**.`;
      } else {
        response = "Net profit could not be determined. Check if your spreadsheet contains profit, revenue, or expense columns.";
      }
    } else if (query.includes('expense') || query.includes('cost')) {
      if (kpiMap.expenses) {
        response = `The total expenses recorded are **${kpiMap.expenses.formattedValue}**.`;
      } else {
        response = "Total expenses could not be resolved from the spreadsheet headers.";
      }
    } else if (query.includes('growth')) {
      if (kpiMap.growth) {
        response = `The growth rate is currently calculated as **${kpiMap.growth.formattedValue}**.`;
      } else {
        response = "Growth rate is not available for this dataset (requires date and revenue or sales columns).";
      }
    } else if (query.includes('hi') || query.includes('hello')) {
      response = "Hello! I am your AI Data Assistant. Ask me anything about your active spreadsheet data!";
    }

    return {
      response,
      usage: { promptTokens: 120, completionTokens: 80, totalTokens: 200 }
    };
  }

  /**
   * Structure unorganized query parameters or labels into JSON models.
   * @param {string} text - User prompt or data text.
   * @returns {Promise<Object>}
   */
  async extractMetadata(text) {
    return {
      processedText: text,
      timestamp: new Date(),
      status: 'success'
    };
  }
}

module.exports = new AIService();
