/**
 * Domain Profiles
 *
 * Configuration-driven domain knowledge for 13 business domains.
 * Each domain profile defines:
 *   - kpiTemplates: KPI candidates with required columns and aggregation specs
 *   - chartTemplates: Chart candidates with semantic requirements
 *
 * Rules:
 * - KPI is only generated if at least one 'requiredSemanticRoles' column exists in the dataset.
 * - requiredSemanticRoles is an array of arrays (OR-groups): at least one role from each group must exist.
 * - Chart is only generated if 'xSemanticRoles' AND 'ySemanticRoles' can both be satisfied.
 */

const { SEMANTIC_ROLES } = require('../semantic/semanticClassifier');
const { AGGREGATIONS } = require('../aggregation/aggregationRules');

// ---------------------------------------------------------------------------
// Domain profile definitions
// ---------------------------------------------------------------------------

const DOMAIN_PROFILES = {

  hr: {
    label: 'Human Resources',
    kpiTemplates: [
      {
        id: 'total_employees',
        title: 'Total Employees',
        description: 'Total number of unique employees in the dataset.',
        requiredSemanticRoles: [[SEMANTIC_ROLES.IDENTIFIER]],
        preferredColumnPatterns: [/employee_?id/i, /emp_?id/i, /staff_?id/i],
        aggregation: AGGREGATIONS.COUNT_DISTINCT,
        format: 'number',
        icon: 'Users',
        color: 'blue',
        priority: 'primary',
        domainRelevance: 100
      },
      {
        id: 'active_employees',
        title: 'Active Employees',
        description: 'Number of employees with active/current employment status.',
        requiredSemanticRoles: [[SEMANTIC_ROLES.STATUS_DIMENSION]],
        preferredColumnPatterns: [/status/i, /employment_?status/i, /job_?status/i],
        aggregation: AGGREGATIONS.COUNT,
        filterCondition: { type: 'categorical_value', values: ['Active', 'active', 'ACTIVE', 'Current', 'current', 'Employed'] },
        format: 'number',
        icon: 'UserCheck',
        color: 'green',
        priority: 'primary',
        domainRelevance: 95
      },
      {
        id: 'avg_salary',
        title: 'Average Monthly Salary',
        description: 'Average monthly salary across all employees.',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/salary/i, /wage/i, /pay/i, /compensation/i, /ctc/i, /remuneration/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'currency',
        icon: 'DollarSign',
        color: 'purple',
        priority: 'primary',
        domainRelevance: 94
      },
      {
        id: 'avg_performance',
        title: 'Average Performance Rating',
        description: 'Average employee performance rating.',
        requiredSemanticRoles: [[SEMANTIC_ROLES.ORDINAL_METRIC]],
        preferredColumnPatterns: [/performance/i, /rating/i, /appraisal/i, /score/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'number',
        icon: 'Star',
        color: 'amber',
        priority: 'secondary',
        domainRelevance: 88
      },
      {
        id: 'avg_attendance',
        title: 'Average Attendance',
        description: 'Average attendance percentage across all employees.',
        requiredSemanticRoles: [[SEMANTIC_ROLES.PERCENTAGE_METRIC]],
        preferredColumnPatterns: [/attendance/i, /presence/i, /working_days/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'percent',
        icon: 'Calendar',
        color: 'emerald',
        priority: 'secondary',
        domainRelevance: 85
      },
      {
        id: 'attrition_rate',
        title: 'Attrition Rate',
        description: 'Percentage of employees who have exited the organization.',
        requiredSemanticRoles: [[SEMANTIC_ROLES.STATUS_DIMENSION], [SEMANTIC_ROLES.TEMPORAL_DIMENSION]],
        preferredColumnPatterns: [/exit_?date/i, /termination/i, /resignation/i, /status/i],
        aggregation: AGGREGATIONS.COUNT,
        computed: true,
        format: 'percent',
        icon: 'TrendingDown',
        color: 'red',
        priority: 'primary',
        domainRelevance: 90
      }
    ],
    chartTemplates: [
      {
        id: 'employees_by_department',
        title: 'Employee Count by Department',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/department/i, /dept/i, /division/i, /team/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'primary',
        businessReason: 'Shows workforce distribution across departments.'
      },
      {
        id: 'avg_salary_by_department',
        title: 'Average Salary by Department',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/department/i, /dept/i],
        ySemanticRoles: [SEMANTIC_ROLES.MONETARY_METRIC],
        yPreferredPatterns: [/salary/i, /wage/i, /pay/i],
        aggregation: AGGREGATIONS.AVG,
        priority: 'primary',
        businessReason: 'Compares average compensation across departments.'
      },
      {
        id: 'status_distribution',
        title: 'Employee Status Distribution',
        chartType: 'pie',
        xSemanticRoles: [SEMANTIC_ROLES.STATUS_DIMENSION],
        xPreferredPatterns: [/status/i, /employment_?status/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'primary',
        businessReason: 'Shows breakdown of active vs. inactive employment statuses.'
      },
      {
        id: 'hiring_trend',
        title: 'Hiring Trend Over Time',
        chartType: 'line',
        xSemanticRoles: [SEMANTIC_ROLES.TEMPORAL_DIMENSION],
        xPreferredPatterns: [/join(?:ing)?_?date/i, /hire_?date/i, /start_?date/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'primary',
        businessReason: 'Shows employee hiring volume over time.'
      },
      {
        id: 'performance_distribution',
        title: 'Performance Rating Distribution',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.ORDINAL_METRIC],
        xPreferredPatterns: [/performance/i, /rating/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'secondary',
        businessReason: 'Shows how employees are distributed across performance levels.'
      },
      {
        id: 'attendance_by_department',
        title: 'Average Attendance by Department',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/department/i],
        ySemanticRoles: [SEMANTIC_ROLES.PERCENTAGE_METRIC],
        yPreferredPatterns: [/attendance/i],
        aggregation: AGGREGATIONS.AVG,
        priority: 'secondary',
        businessReason: 'Compares attendance rates across departments.'
      },
      {
        id: 'avg_salary_by_role',
        title: 'Average Salary by Role',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/role/i, /designation/i, /job_?title/i, /position/i],
        ySemanticRoles: [SEMANTIC_ROLES.MONETARY_METRIC],
        yPreferredPatterns: [/salary/i, /wage/i],
        aggregation: AGGREGATIONS.AVG,
        priority: 'secondary',
        businessReason: 'Compares compensation across job roles.'
      },
      {
        id: 'employees_by_location',
        title: 'Employee Count by Location',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.GEOGRAPHIC_DIMENSION],
        xPreferredPatterns: [/location/i, /city/i, /branch/i, /office/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'secondary',
        businessReason: 'Shows workforce geographic distribution.'
      }
    ]
  },

  sales: {
    label: 'Sales',
    kpiTemplates: [
      {
        id: 'total_revenue',
        title: 'Total Revenue',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/revenue/i, /sales_?amount/i, /total_?sales/i, /amount/i],
        aggregation: AGGREGATIONS.SUM,
        format: 'currency',
        icon: 'DollarSign',
        color: 'purple',
        priority: 'primary',
        domainRelevance: 100
      },
      {
        id: 'total_orders',
        title: 'Total Orders',
        requiredSemanticRoles: [[SEMANTIC_ROLES.IDENTIFIER], [SEMANTIC_ROLES.ADDITIVE_METRIC]],
        preferredColumnPatterns: [/order_?id/i, /transaction_?id/i, /order_?count/i],
        aggregation: AGGREGATIONS.COUNT,
        format: 'number',
        icon: 'ShoppingCart',
        color: 'blue',
        priority: 'primary',
        domainRelevance: 95
      },
      {
        id: 'avg_order_value',
        title: 'Average Order Value',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/amount/i, /revenue/i, /order_?value/i, /sale_?value/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'currency',
        icon: 'TrendingUp',
        color: 'green',
        priority: 'primary',
        domainRelevance: 88
      },
      {
        id: 'total_customers',
        title: 'Unique Customers',
        requiredSemanticRoles: [[SEMANTIC_ROLES.IDENTIFIER]],
        preferredColumnPatterns: [/customer_?id/i, /client_?id/i, /cust_?id/i],
        aggregation: AGGREGATIONS.COUNT_DISTINCT,
        format: 'number',
        icon: 'Users',
        color: 'emerald',
        priority: 'secondary',
        domainRelevance: 85
      }
    ],
    chartTemplates: [
      {
        id: 'revenue_over_time',
        title: 'Revenue Trend Over Time',
        chartType: 'line',
        xSemanticRoles: [SEMANTIC_ROLES.TEMPORAL_DIMENSION],
        xPreferredPatterns: [/date/i, /time/i, /period/i],
        ySemanticRoles: [SEMANTIC_ROLES.MONETARY_METRIC],
        yPreferredPatterns: [/revenue/i, /amount/i, /sales/i],
        aggregation: AGGREGATIONS.SUM,
        priority: 'primary',
        businessReason: 'Tracks revenue performance over time.'
      },
      {
        id: 'revenue_by_category',
        title: 'Revenue by Category',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/category/i, /product/i, /type/i, /segment/i],
        ySemanticRoles: [SEMANTIC_ROLES.MONETARY_METRIC],
        yPreferredPatterns: [/revenue/i, /amount/i, /sales/i],
        aggregation: AGGREGATIONS.SUM,
        priority: 'primary',
        businessReason: 'Identifies highest-revenue product categories.'
      },
      {
        id: 'revenue_by_region',
        title: 'Revenue by Region',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.GEOGRAPHIC_DIMENSION],
        xPreferredPatterns: [/region/i, /territory/i, /country/i, /state/i],
        ySemanticRoles: [SEMANTIC_ROLES.MONETARY_METRIC],
        yPreferredPatterns: [/revenue/i, /amount/i],
        aggregation: AGGREGATIONS.SUM,
        priority: 'primary',
        businessReason: 'Shows geographic revenue distribution.'
      },
      {
        id: 'orders_by_status',
        title: 'Order Status Distribution',
        chartType: 'pie',
        xSemanticRoles: [SEMANTIC_ROLES.STATUS_DIMENSION],
        xPreferredPatterns: [/status/i, /order_?status/i, /fulfillment/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'secondary',
        businessReason: 'Shows distribution of order fulfillment statuses.'
      }
    ]
  },

  ecommerce: {
    label: 'E-Commerce',
    kpiTemplates: [
      {
        id: 'total_gmv',
        title: 'Gross Merchandise Value',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/gmv/i, /revenue/i, /sale_?price/i, /amount/i],
        aggregation: AGGREGATIONS.SUM,
        format: 'currency',
        icon: 'DollarSign',
        color: 'purple',
        priority: 'primary',
        domainRelevance: 100
      },
      {
        id: 'total_orders',
        title: 'Total Orders',
        requiredSemanticRoles: [[SEMANTIC_ROLES.IDENTIFIER]],
        preferredColumnPatterns: [/order_?id/i, /transaction_?id/i],
        aggregation: AGGREGATIONS.COUNT,
        format: 'number',
        icon: 'ShoppingCart',
        color: 'blue',
        priority: 'primary',
        domainRelevance: 95
      },
      {
        id: 'avg_order_value',
        title: 'Average Order Value',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/amount/i, /revenue/i, /price/i, /value/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'currency',
        icon: 'TrendingUp',
        color: 'green',
        priority: 'primary',
        domainRelevance: 90
      },
      {
        id: 'return_rate',
        title: 'Return Rate',
        requiredSemanticRoles: [[SEMANTIC_ROLES.PERCENTAGE_METRIC]],
        preferredColumnPatterns: [/return_?rate/i, /refund_?rate/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'percent',
        icon: 'RotateCcw',
        color: 'red',
        priority: 'secondary',
        domainRelevance: 80
      }
    ],
    chartTemplates: [
      {
        id: 'orders_over_time',
        title: 'Orders Over Time',
        chartType: 'line',
        xSemanticRoles: [SEMANTIC_ROLES.TEMPORAL_DIMENSION],
        xPreferredPatterns: [/date/i, /time/i, /order_?date/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'primary',
        businessReason: 'Tracks order volume trends.'
      },
      {
        id: 'revenue_by_category',
        title: 'Revenue by Product Category',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/category/i, /product_?type/i, /department/i],
        ySemanticRoles: [SEMANTIC_ROLES.MONETARY_METRIC],
        yPreferredPatterns: [/revenue/i, /amount/i, /price/i],
        aggregation: AGGREGATIONS.SUM,
        priority: 'primary',
        businessReason: 'Identifies top-performing product categories.'
      }
    ]
  },

  finance: {
    label: 'Finance & Accounting',
    kpiTemplates: [
      {
        id: 'total_revenue',
        title: 'Total Revenue',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/revenue/i, /income/i, /sales/i, /inflow/i],
        aggregation: AGGREGATIONS.SUM,
        format: 'currency',
        icon: 'DollarSign',
        color: 'green',
        priority: 'primary',
        domainRelevance: 100
      },
      {
        id: 'total_expenses',
        title: 'Total Expenses',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/expense/i, /cost/i, /spend/i, /outflow/i],
        aggregation: AGGREGATIONS.SUM,
        format: 'currency',
        icon: 'Wallet',
        color: 'red',
        priority: 'primary',
        domainRelevance: 95
      },
      {
        id: 'net_profit',
        title: 'Net Profit',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/profit/i, /net_?income/i, /earnings/i, /margin/i],
        aggregation: AGGREGATIONS.SUM,
        format: 'currency',
        icon: 'TrendingUp',
        color: 'purple',
        priority: 'primary',
        domainRelevance: 98
      },
      {
        id: 'avg_transaction',
        title: 'Average Transaction Value',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/amount/i, /transaction/i, /value/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'currency',
        icon: 'Activity',
        color: 'blue',
        priority: 'secondary',
        domainRelevance: 80
      }
    ],
    chartTemplates: [
      {
        id: 'revenue_vs_expense',
        title: 'Revenue vs Expenses Over Time',
        chartType: 'line',
        xSemanticRoles: [SEMANTIC_ROLES.TEMPORAL_DIMENSION],
        xPreferredPatterns: [/date/i, /period/i, /month/i, /quarter/i],
        ySemanticRoles: [SEMANTIC_ROLES.MONETARY_METRIC],
        yPreferredPatterns: [/revenue/i, /expense/i, /income/i],
        aggregation: AGGREGATIONS.SUM,
        priority: 'primary',
        businessReason: 'Compares revenue and expense trends over time.'
      },
      {
        id: 'expense_by_category',
        title: 'Expenses by Category',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/category/i, /type/i, /account_?type/i],
        ySemanticRoles: [SEMANTIC_ROLES.MONETARY_METRIC],
        yPreferredPatterns: [/expense/i, /cost/i, /amount/i],
        aggregation: AGGREGATIONS.SUM,
        priority: 'primary',
        businessReason: 'Identifies largest expense categories.'
      }
    ]
  },

  marketing: {
    label: 'Marketing',
    kpiTemplates: [
      {
        id: 'total_spend',
        title: 'Total Ad Spend',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/spend/i, /budget/i, /cost/i, /ad_?spend/i],
        aggregation: AGGREGATIONS.SUM,
        format: 'currency',
        icon: 'Wallet',
        color: 'red',
        priority: 'primary',
        domainRelevance: 95
      },
      {
        id: 'avg_ctr',
        title: 'Average Click-Through Rate',
        requiredSemanticRoles: [[SEMANTIC_ROLES.PERCENTAGE_METRIC]],
        preferredColumnPatterns: [/ctr/i, /click_?through/i, /click_?rate/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'percent',
        icon: 'MousePointer',
        color: 'blue',
        priority: 'primary',
        domainRelevance: 90
      },
      {
        id: 'avg_conversion_rate',
        title: 'Conversion Rate',
        requiredSemanticRoles: [[SEMANTIC_ROLES.PERCENTAGE_METRIC]],
        preferredColumnPatterns: [/conversion_?rate/i, /cvr/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'percent',
        icon: 'TrendingUp',
        color: 'green',
        priority: 'primary',
        domainRelevance: 92
      },
      {
        id: 'total_impressions',
        title: 'Total Impressions',
        requiredSemanticRoles: [[SEMANTIC_ROLES.ADDITIVE_METRIC]],
        preferredColumnPatterns: [/impressions?/i, /reach/i, /views?/i],
        aggregation: AGGREGATIONS.SUM,
        format: 'number',
        icon: 'Eye',
        color: 'indigo',
        priority: 'secondary',
        domainRelevance: 80
      }
    ],
    chartTemplates: [
      {
        id: 'spend_by_channel',
        title: 'Ad Spend by Channel',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/channel/i, /medium/i, /platform/i, /source/i],
        ySemanticRoles: [SEMANTIC_ROLES.MONETARY_METRIC],
        yPreferredPatterns: [/spend/i, /cost/i, /budget/i],
        aggregation: AGGREGATIONS.SUM,
        priority: 'primary',
        businessReason: 'Shows budget allocation across marketing channels.'
      },
      {
        id: 'performance_over_time',
        title: 'Campaign Performance Over Time',
        chartType: 'line',
        xSemanticRoles: [SEMANTIC_ROLES.TEMPORAL_DIMENSION],
        xPreferredPatterns: [/date/i, /time/i, /period/i, /week/i, /month/i],
        ySemanticRoles: [SEMANTIC_ROLES.PERCENTAGE_METRIC, SEMANTIC_ROLES.ADDITIVE_METRIC],
        yPreferredPatterns: [/ctr/i, /conversion/i, /impressions/i, /clicks/i],
        aggregation: AGGREGATIONS.AVG,
        priority: 'primary',
        businessReason: 'Tracks marketing performance metrics over time.'
      }
    ]
  },

  inventory: {
    label: 'Inventory & Stock',
    kpiTemplates: [
      {
        id: 'total_sku',
        title: 'Total SKUs',
        requiredSemanticRoles: [[SEMANTIC_ROLES.IDENTIFIER]],
        preferredColumnPatterns: [/sku/i, /product_?id/i, /item_?id/i],
        aggregation: AGGREGATIONS.COUNT_DISTINCT,
        format: 'number',
        icon: 'Package',
        color: 'blue',
        priority: 'primary',
        domainRelevance: 95
      },
      {
        id: 'total_stock_value',
        title: 'Total Stock Value',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/value/i, /cost/i, /price/i, /amount/i],
        aggregation: AGGREGATIONS.SUM,
        format: 'currency',
        icon: 'DollarSign',
        color: 'purple',
        priority: 'primary',
        domainRelevance: 92
      },
      {
        id: 'total_units',
        title: 'Total Units On Hand',
        requiredSemanticRoles: [[SEMANTIC_ROLES.ADDITIVE_METRIC]],
        preferredColumnPatterns: [/quantity/i, /qty/i, /units?/i, /stock/i, /on_?hand/i],
        aggregation: AGGREGATIONS.SUM,
        format: 'number',
        icon: 'Layers',
        color: 'green',
        priority: 'primary',
        domainRelevance: 90
      }
    ],
    chartTemplates: [
      {
        id: 'stock_by_category',
        title: 'Stock Levels by Category',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/category/i, /type/i, /department/i],
        ySemanticRoles: [SEMANTIC_ROLES.ADDITIVE_METRIC],
        yPreferredPatterns: [/quantity/i, /qty/i, /stock/i, /units/i],
        aggregation: AGGREGATIONS.SUM,
        priority: 'primary',
        businessReason: 'Shows inventory distribution by product category.'
      },
      {
        id: 'inventory_value_by_location',
        title: 'Inventory Value by Location',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.GEOGRAPHIC_DIMENSION],
        xPreferredPatterns: [/location/i, /warehouse/i, /region/i],
        ySemanticRoles: [SEMANTIC_ROLES.MONETARY_METRIC],
        yPreferredPatterns: [/value/i, /cost/i, /amount/i],
        aggregation: AGGREGATIONS.SUM,
        priority: 'secondary',
        businessReason: 'Shows inventory value distribution by warehouse location.'
      }
    ]
  },

  crm: {
    label: 'CRM / Customer Management',
    kpiTemplates: [
      {
        id: 'total_contacts',
        title: 'Total Contacts',
        requiredSemanticRoles: [[SEMANTIC_ROLES.IDENTIFIER]],
        preferredColumnPatterns: [/contact_?id/i, /customer_?id/i, /lead_?id/i],
        aggregation: AGGREGATIONS.COUNT_DISTINCT,
        format: 'number',
        icon: 'Users',
        color: 'blue',
        priority: 'primary',
        domainRelevance: 95
      },
      {
        id: 'total_pipeline_value',
        title: 'Total Pipeline Value',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/deal_?value/i, /pipeline/i, /opportunity_?value/i, /amount/i],
        aggregation: AGGREGATIONS.SUM,
        format: 'currency',
        icon: 'DollarSign',
        color: 'purple',
        priority: 'primary',
        domainRelevance: 92
      },
      {
        id: 'avg_nps',
        title: 'Average NPS Score',
        requiredSemanticRoles: [[SEMANTIC_ROLES.ORDINAL_METRIC]],
        preferredColumnPatterns: [/nps/i, /satisfaction/i, /score/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'number',
        icon: 'Star',
        color: 'amber',
        priority: 'secondary',
        domainRelevance: 80
      }
    ],
    chartTemplates: [
      {
        id: 'pipeline_by_stage',
        title: 'Pipeline by Stage',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.STATUS_DIMENSION, SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/stage/i, /status/i, /pipeline_?stage/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'primary',
        businessReason: 'Shows deal distribution across pipeline stages.'
      },
      {
        id: 'leads_over_time',
        title: 'New Leads Over Time',
        chartType: 'line',
        xSemanticRoles: [SEMANTIC_ROLES.TEMPORAL_DIMENSION],
        xPreferredPatterns: [/date/i, /created_?at/i, /signup_?date/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'primary',
        businessReason: 'Tracks lead generation trends.'
      }
    ]
  },

  customer_support: {
    label: 'Customer Support',
    kpiTemplates: [
      {
        id: 'total_tickets',
        title: 'Total Support Tickets',
        requiredSemanticRoles: [[SEMANTIC_ROLES.IDENTIFIER]],
        preferredColumnPatterns: [/ticket_?id/i, /case_?id/i, /issue_?id/i],
        aggregation: AGGREGATIONS.COUNT,
        format: 'number',
        icon: 'MessageSquare',
        color: 'blue',
        priority: 'primary',
        domainRelevance: 95
      },
      {
        id: 'avg_csat',
        title: 'Average CSAT Score',
        requiredSemanticRoles: [[SEMANTIC_ROLES.ORDINAL_METRIC]],
        preferredColumnPatterns: [/csat/i, /satisfaction/i, /rating/i, /score/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'number',
        icon: 'Star',
        color: 'amber',
        priority: 'primary',
        domainRelevance: 90
      },
      {
        id: 'avg_resolution_time',
        title: 'Average Resolution Time',
        requiredSemanticRoles: [[SEMANTIC_ROLES.ADDITIVE_METRIC, SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE]],
        preferredColumnPatterns: [/resolution_?time/i, /time_?to_?resolve/i, /handling_?time/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'number',
        icon: 'Clock',
        color: 'orange',
        priority: 'secondary',
        domainRelevance: 85
      }
    ],
    chartTemplates: [
      {
        id: 'tickets_by_status',
        title: 'Tickets by Status',
        chartType: 'pie',
        xSemanticRoles: [SEMANTIC_ROLES.STATUS_DIMENSION],
        xPreferredPatterns: [/status/i, /ticket_?status/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'primary',
        businessReason: 'Shows open vs. resolved ticket distribution.'
      },
      {
        id: 'tickets_by_category',
        title: 'Tickets by Category',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/category/i, /type/i, /issue_?type/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'primary',
        businessReason: 'Identifies most common support issue types.'
      }
    ]
  },

  healthcare: {
    label: 'Healthcare',
    kpiTemplates: [
      {
        id: 'total_patients',
        title: 'Total Patients',
        requiredSemanticRoles: [[SEMANTIC_ROLES.IDENTIFIER]],
        preferredColumnPatterns: [/patient_?id/i, /patient_?no/i, /case_?id/i],
        aggregation: AGGREGATIONS.COUNT_DISTINCT,
        format: 'number',
        icon: 'Users',
        color: 'blue',
        priority: 'primary',
        domainRelevance: 95
      },
      {
        id: 'avg_length_of_stay',
        title: 'Average Length of Stay',
        requiredSemanticRoles: [[SEMANTIC_ROLES.ADDITIVE_METRIC, SEMANTIC_ROLES.DEMOGRAPHIC_ATTRIBUTE]],
        preferredColumnPatterns: [/length_?of_?stay/i, /los/i, /days?/i, /duration/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'number',
        icon: 'Calendar',
        color: 'blue',
        priority: 'secondary',
        domainRelevance: 85
      },
      {
        id: 'total_claim_value',
        title: 'Total Claim Value',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/claim/i, /amount/i, /cost/i, /charge/i],
        aggregation: AGGREGATIONS.SUM,
        format: 'currency',
        icon: 'DollarSign',
        color: 'purple',
        priority: 'primary',
        domainRelevance: 88
      }
    ],
    chartTemplates: [
      {
        id: 'admissions_over_time',
        title: 'Admissions Over Time',
        chartType: 'line',
        xSemanticRoles: [SEMANTIC_ROLES.TEMPORAL_DIMENSION],
        xPreferredPatterns: [/admission_?date/i, /date/i, /time/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'primary',
        businessReason: 'Tracks patient admission trends over time.'
      },
      {
        id: 'patients_by_diagnosis',
        title: 'Patients by Diagnosis',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/diagnosis/i, /condition/i, /icd/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'primary',
        businessReason: 'Shows patient distribution by diagnosis type.'
      }
    ]
  },

  education: {
    label: 'Education',
    kpiTemplates: [
      {
        id: 'total_students',
        title: 'Total Students',
        requiredSemanticRoles: [[SEMANTIC_ROLES.IDENTIFIER]],
        preferredColumnPatterns: [/student_?id/i, /enroll_?id/i],
        aggregation: AGGREGATIONS.COUNT_DISTINCT,
        format: 'number',
        icon: 'Users',
        color: 'blue',
        priority: 'primary',
        domainRelevance: 95
      },
      {
        id: 'avg_score',
        title: 'Average Score',
        requiredSemanticRoles: [[SEMANTIC_ROLES.ORDINAL_METRIC]],
        preferredColumnPatterns: [/score/i, /grade/i, /marks?/i, /gpa/i, /percentage/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'number',
        icon: 'Star',
        color: 'amber',
        priority: 'primary',
        domainRelevance: 90
      },
      {
        id: 'avg_attendance',
        title: 'Average Attendance',
        requiredSemanticRoles: [[SEMANTIC_ROLES.PERCENTAGE_METRIC]],
        preferredColumnPatterns: [/attendance/i, /presence/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'percent',
        icon: 'Calendar',
        color: 'green',
        priority: 'secondary',
        domainRelevance: 82
      }
    ],
    chartTemplates: [
      {
        id: 'scores_by_course',
        title: 'Average Score by Course',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/course/i, /subject/i, /class/i, /module/i],
        ySemanticRoles: [SEMANTIC_ROLES.ORDINAL_METRIC],
        yPreferredPatterns: [/score/i, /grade/i, /marks/i],
        aggregation: AGGREGATIONS.AVG,
        priority: 'primary',
        businessReason: 'Compares average academic performance across courses.'
      }
    ]
  },

  manufacturing: {
    label: 'Manufacturing',
    kpiTemplates: [
      {
        id: 'total_production',
        title: 'Total Units Produced',
        requiredSemanticRoles: [[SEMANTIC_ROLES.ADDITIVE_METRIC]],
        preferredColumnPatterns: [/production/i, /units?_?produced/i, /output/i, /manufactured/i],
        aggregation: AGGREGATIONS.SUM,
        format: 'number',
        icon: 'Factory',
        color: 'blue',
        priority: 'primary',
        domainRelevance: 95
      },
      {
        id: 'defect_rate',
        title: 'Defect Rate',
        requiredSemanticRoles: [[SEMANTIC_ROLES.PERCENTAGE_METRIC]],
        preferredColumnPatterns: [/defect_?rate/i, /rejection_?rate/i, /scrap_?rate/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'percent',
        icon: 'AlertTriangle',
        color: 'red',
        priority: 'primary',
        domainRelevance: 90
      },
      {
        id: 'avg_oee',
        title: 'Average OEE',
        requiredSemanticRoles: [[SEMANTIC_ROLES.PERCENTAGE_METRIC]],
        preferredColumnPatterns: [/oee/i, /efficiency/i, /utilization/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'percent',
        icon: 'Activity',
        color: 'green',
        priority: 'secondary',
        domainRelevance: 85
      }
    ],
    chartTemplates: [
      {
        id: 'production_over_time',
        title: 'Production Volume Over Time',
        chartType: 'line',
        xSemanticRoles: [SEMANTIC_ROLES.TEMPORAL_DIMENSION],
        xPreferredPatterns: [/date/i, /time/i, /shift_?date/i, /batch_?date/i],
        ySemanticRoles: [SEMANTIC_ROLES.ADDITIVE_METRIC],
        yPreferredPatterns: [/production/i, /output/i, /units/i, /quantity/i],
        aggregation: AGGREGATIONS.SUM,
        priority: 'primary',
        businessReason: 'Tracks production volume trends over time.'
      },
      {
        id: 'defects_by_line',
        title: 'Defects by Production Line',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/line/i, /machine/i, /plant/i, /shift/i],
        ySemanticRoles: [SEMANTIC_ROLES.ADDITIVE_METRIC],
        yPreferredPatterns: [/defect/i, /reject/i, /scrap/i, /error/i],
        aggregation: AGGREGATIONS.SUM,
        priority: 'secondary',
        businessReason: 'Identifies quality issues by production line.'
      }
    ]
  },

  logistics: {
    label: 'Logistics & Supply Chain',
    kpiTemplates: [
      {
        id: 'total_shipments',
        title: 'Total Shipments',
        requiredSemanticRoles: [[SEMANTIC_ROLES.IDENTIFIER]],
        preferredColumnPatterns: [/shipment_?id/i, /tracking/i, /order_?id/i],
        aggregation: AGGREGATIONS.COUNT,
        format: 'number',
        icon: 'Truck',
        color: 'blue',
        priority: 'primary',
        domainRelevance: 95
      },
      {
        id: 'avg_delivery_time',
        title: 'Average Delivery Time',
        requiredSemanticRoles: [[SEMANTIC_ROLES.ADDITIVE_METRIC]],
        preferredColumnPatterns: [/delivery_?time/i, /transit_?time/i, /lead_?time/i, /days?_?to_?deliver/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'number',
        icon: 'Clock',
        color: 'orange',
        priority: 'primary',
        domainRelevance: 90
      },
      {
        id: 'on_time_delivery_rate',
        title: 'On-Time Delivery Rate',
        requiredSemanticRoles: [[SEMANTIC_ROLES.PERCENTAGE_METRIC]],
        preferredColumnPatterns: [/on_?time/i, /otd/i, /delivery_?rate/i],
        aggregation: AGGREGATIONS.AVG,
        format: 'percent',
        icon: 'CheckCircle',
        color: 'green',
        priority: 'primary',
        domainRelevance: 88
      }
    ],
    chartTemplates: [
      {
        id: 'shipments_by_carrier',
        title: 'Shipments by Carrier',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION],
        xPreferredPatterns: [/carrier/i, /courier/i, /shipper/i, /mode/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'primary',
        businessReason: 'Shows shipment volume by logistics provider.'
      },
      {
        id: 'shipments_over_time',
        title: 'Shipments Over Time',
        chartType: 'line',
        xSemanticRoles: [SEMANTIC_ROLES.TEMPORAL_DIMENSION],
        xPreferredPatterns: [/date/i, /ship_?date/i, /delivery_?date/i],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'primary',
        businessReason: 'Tracks shipment volume trends.'
      }
    ]
  },

  general: {
    label: 'General / Analytics',
    kpiTemplates: [
      {
        id: 'total_records',
        title: 'Total Records',
        requiredSemanticRoles: [[SEMANTIC_ROLES.IDENTIFIER, SEMANTIC_ROLES.CATEGORICAL_DIMENSION, SEMANTIC_ROLES.MONETARY_METRIC]],
        preferredColumnPatterns: [/.*/],
        aggregation: AGGREGATIONS.COUNT,
        format: 'number',
        icon: 'Activity',
        color: 'blue',
        priority: 'primary',
        domainRelevance: 70
      },
      {
        id: 'primary_metric',
        title: 'Primary Metric Total',
        requiredSemanticRoles: [[SEMANTIC_ROLES.MONETARY_METRIC, SEMANTIC_ROLES.ADDITIVE_METRIC]],
        preferredColumnPatterns: [/value/i, /amount/i, /total/i, /metric/i],
        aggregation: AGGREGATIONS.SUM,
        format: 'number',
        icon: 'TrendingUp',
        color: 'purple',
        priority: 'primary',
        domainRelevance: 65
      }
    ],
    chartTemplates: [
      {
        id: 'count_by_category',
        title: 'Count by Category',
        chartType: 'bar',
        xSemanticRoles: [SEMANTIC_ROLES.CATEGORICAL_DIMENSION, SEMANTIC_ROLES.STATUS_DIMENSION],
        yMetric: 'count',
        aggregation: AGGREGATIONS.COUNT,
        priority: 'primary',
        businessReason: 'Shows frequency distribution by category.'
      },
      {
        id: 'metric_over_time',
        title: 'Metric Over Time',
        chartType: 'line',
        xSemanticRoles: [SEMANTIC_ROLES.TEMPORAL_DIMENSION],
        ySemanticRoles: [SEMANTIC_ROLES.MONETARY_METRIC, SEMANTIC_ROLES.ADDITIVE_METRIC],
        aggregation: AGGREGATIONS.SUM,
        priority: 'primary',
        businessReason: 'Tracks primary metric trends over time.'
      }
    ]
  }
};

/**
 * Gets the domain profile for a given domain key.
 * Falls back to 'general' if the domain is not found.
 *
 * @param {string} domain
 * @returns {Object}
 */
const getDomainProfile = (domain) => {
  const key = (domain || 'general').toLowerCase().replace(/[^a-z_]/g, '_');
  return DOMAIN_PROFILES[key] || DOMAIN_PROFILES.general;
};

module.exports = {
  DOMAIN_PROFILES,
  getDomainProfile
};
