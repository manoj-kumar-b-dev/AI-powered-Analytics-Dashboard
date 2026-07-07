/**
 * Dataset Classifier Service
 *
 * Responsibilities:
 * - Analyze file columns, formats, and cell examples to determine the domain of a dataset.
 * - Categorize datasets into 15 business taxonomies with confidence scoring.
 * - Return domain context used by downstream KPI, Chart, and Insight generators.
 *
 * Interface:
 * - classifyDataset(fileName: string, schema: Array): Promise<{ domain: string, confidence: number, domainLabel: string }>
 */

const DOMAIN_KEYWORDS = {
  sales: {
    label: 'Sales',
    primary: ['salesperson', 'sales_rep', 'rep_name', 'quota', 'pipeline', 'closed_won', 'closed_lost', 'deal_stage', 'territory', 'commission', 'target', 'forecast', 'win_rate', 'conversion'],
    secondary: ['revenue', 'amount', 'deal', 'client', 'prospect', 'lead']
  },
  marketing: {
    label: 'Marketing',
    primary: ['campaign', 'impression', 'click', 'ctr', 'cpc', 'cpm', 'roas', 'conversion_rate', 'ad_spend', 'engagement', 'reach', 'bounce_rate', 'session', 'utm', 'channel', 'attribution'],
    secondary: ['revenue', 'cost', 'traffic', 'audience', 'funnel', 'lead']
  },
  finance: {
    label: 'Finance & Accounting',
    primary: ['balance', 'debit', 'credit', 'ledger', 'journal', 'account_number', 'invoice', 'tax', 'vat', 'gst', 'payable', 'receivable', 'reconciliation', 'budget', 'forecast_amount', 'fiscal'],
    secondary: ['expense', 'profit', 'income', 'cost', 'revenue', 'payment']
  },
  hr: {
    label: 'Human Resources',
    primary: ['employee', 'emp_id', 'staff', 'headcount', 'department', 'designation', 'hire_date', 'termination', 'attrition', 'payroll', 'salary', 'bonus', 'leave', 'attendance', 'performance_rating', 'appraisal'],
    secondary: ['name', 'email', 'manager', 'team', 'location', 'age']
  },
  crm: {
    label: 'CRM / Customer Management',
    primary: ['lead', 'contact', 'opportunity', 'account', 'pipeline_stage', 'deal_value', 'follow_up', 'support_ticket', 'nps', 'churn', 'retention', 'lifetime_value', 'clv', 'ltv', 'renewal'],
    secondary: ['customer', 'client', 'email', 'phone', 'company', 'status']
  },
  inventory: {
    label: 'Inventory & Stock',
    primary: ['sku', 'stock', 'warehouse', 'reorder_point', 'on_hand', 'backorder', 'lot_number', 'expiry', 'bin', 'shelf', 'shrinkage', 'turnover', 'days_on_hand', 'po_number', 'supplier'],
    secondary: ['quantity', 'product', 'item', 'unit', 'cost', 'location']
  },
  ecommerce: {
    label: 'E-Commerce',
    primary: ['order_id', 'cart', 'checkout', 'sku', 'product_id', 'category', 'shipping', 'return_rate', 'refund', 'gmv', 'aov', 'basket_size', 'discount', 'coupon', 'fulfillment'],
    secondary: ['revenue', 'quantity', 'customer', 'price', 'transaction', 'amount']
  },
  customer_support: {
    label: 'Customer Support',
    primary: ['ticket', 'case_id', 'priority', 'escalation', 'resolution_time', 'first_response', 'csat', 'sla', 'agent', 'queue', 'open_tickets', 'closed_tickets', 'sentiment', 'feedback', 'complaint'],
    secondary: ['customer', 'status', 'date', 'channel', 'category', 'time']
  },
  healthcare: {
    label: 'Healthcare',
    primary: ['patient', 'diagnosis', 'icd', 'procedure', 'physician', 'hospital', 'admission', 'discharge', 'claim', 'insurance', 'dosage', 'medication', 'lab_result', 'vitals', 'appointment'],
    secondary: ['date', 'age', 'gender', 'status', 'cost', 'id']
  },
  education: {
    label: 'Education',
    primary: ['student', 'enrollment', 'grade', 'score', 'course', 'curriculum', 'attendance', 'graduation', 'tuition', 'instructor', 'class_size', 'gpa', 'exam', 'assignment', 'subject'],
    secondary: ['name', 'date', 'id', 'status', 'level', 'year']
  },
  manufacturing: {
    label: 'Manufacturing',
    primary: ['production', 'batch', 'machine', 'shift', 'oee', 'defect', 'yield', 'scrap', 'downtime', 'cycle_time', 'throughput', 'wip', 'bom', 'plant', 'line', 'operator'],
    secondary: ['quantity', 'date', 'cost', 'unit', 'time', 'status']
  },
  logistics: {
    label: 'Logistics & Supply Chain',
    primary: ['shipment', 'tracking', 'carrier', 'freight', 'delivery', 'eta', 'pod', 'route', 'driver', 'fleet', 'load', 'container', 'weight', 'customs', 'transit_time', 'origin', 'destination'],
    secondary: ['date', 'status', 'cost', 'quantity', 'id', 'address']
  },
  banking: {
    label: 'Banking & Financial Services',
    primary: ['account_type', 'transaction_type', 'branch', 'swift', 'iban', 'loan', 'interest_rate', 'emi', 'collateral', 'credit_score', 'npa', 'deposit', 'withdrawal', 'wire_transfer', 'kyc'],
    secondary: ['balance', 'amount', 'date', 'customer', 'status', 'id']
  },
  project_management: {
    label: 'Project Management',
    primary: ['task', 'milestone', 'sprint', 'backlog', 'story_point', 'velocity', 'epic', 'assignee', 'due_date', 'completion_rate', 'blocker', 'burndown', 'resource', 'timeline', 'deliverable'],
    secondary: ['status', 'priority', 'date', 'team', 'project', 'id']
  },
  general: {
    label: 'General / Analytics',
    primary: ['value', 'metric', 'count', 'total', 'average', 'sum', 'percentage', 'ratio', 'index'],
    secondary: ['date', 'name', 'id', 'category', 'type', 'status']
  }
};

class DatasetClassifierService {
  /**
   * Infer the high-level business domain of a dataset using weighted keyword scoring.
   * Supports 15 domains: sales, marketing, finance, hr, crm, inventory, ecommerce,
   * customer_support, healthcare, education, manufacturing, logistics, banking,
   * project_management, general.
   *
   * @param {string} fileName
   * @param {Array} schema - Dataset columns with name and type.
   * @returns {Promise<{ domain: string, domainLabel: string, confidence: number }>}
   */
  async classifyDataset(fileName, schema) {
    if (!schema || schema.length === 0) {
      return { domain: 'general', domainLabel: 'General / Analytics', confidence: 0.5 };
    }

    // Normalize column names for matching
    const cols = schema.map(c => (c.column || '').toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const fileNameNorm = (fileName || '').toLowerCase().replace(/[^a-z0-9]/g, '_');

    const scores = {};

    for (const [domain, config] of Object.entries(DOMAIN_KEYWORDS)) {
      let score = 0;

      // Primary keyword match = 3 points each
      for (const kw of config.primary) {
        const kwNorm = kw.replace(/[^a-z0-9_]/g, '_');
        for (const col of cols) {
          if (col === kwNorm || col.includes(kwNorm) || kwNorm.includes(col)) {
            score += 3;
            break; // Count each primary keyword once
          }
        }
        // File name hint = 2 points per primary match
        if (fileNameNorm.includes(kwNorm)) {
          score += 2;
        }
      }

      // Secondary keyword match = 1 point each
      for (const kw of config.secondary) {
        const kwNorm = kw.replace(/[^a-z0-9_]/g, '_');
        for (const col of cols) {
          if (col === kwNorm || col.includes(kwNorm)) {
            score += 1;
            break;
          }
        }
      }

      scores[domain] = score;
    }

    // Sort all domains by score descending
    const ranked = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .filter(([, s]) => s > 0);

    if (ranked.length === 0) {
      return { domain: 'general', domainLabel: 'General / Analytics', confidence: 0.4 };
    }

    const [topDomain, topScore] = ranked[0];
    const secondScore = ranked[1]?.[1] || 0;

    // Confidence: how decisively the top domain won
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
    const dominanceRatio = topScore / (secondScore + 1); // Separation from 2nd place
    const confidence = Math.min(
      0.97,
      Math.max(0.45, 0.5 + (topScore / totalScore) * 0.4 + Math.min(dominanceRatio / 10, 0.07))
    );

    return {
      domain: topDomain,
      domainLabel: DOMAIN_KEYWORDS[topDomain]?.label || topDomain,
      confidence: Number(confidence.toFixed(2))
    };
  }

  /**
   * Expose the domain keyword dictionary for downstream use by KPI/Chart recommenders.
   * @returns {Object}
   */
  getDomainKeywords() {
    return DOMAIN_KEYWORDS;
  }
}

module.exports = new DatasetClassifierService();
