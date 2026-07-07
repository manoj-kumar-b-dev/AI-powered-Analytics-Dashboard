const { z } = require('zod');

const widgetSchema = z.object({
  widgetId: z.string(),
  chartType: z.enum(['line', 'bar', 'pie', 'scatter', 'kpi']),
  dataSourceId: z.string().optional(),
  xField: z.string().optional(),
  yField: z.string().optional(),
  aggregation: z.enum(['sum', 'avg', 'count', 'none']).default('none'),
  title: z.string().optional(),
  kpiType: z.string().optional()
});

const layoutItemSchema = z.object({
  widgetId: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number()
});

const createDashboardSchema = z.object({
  name: z.string().min(1, 'Dashboard name is required'),
  layout: z.array(layoutItemSchema).default([]),
  widgets: z.array(widgetSchema).default([])
});

const updateDashboardSchema = z.object({
  name: z.string().optional(),
  layout: z.array(layoutItemSchema).optional(),
  widgets: z.array(widgetSchema).optional()
});

const patchWidgetSchema = z.object({
  id: z.string(),
  type: z.string(),
  dataSourceId: z.string().nullable().optional(),
  config: z.any().optional(),
  layout: z.any().optional()
});

const patchDashboardSchema = z.object({
  widgets: z.array(patchWidgetSchema)
});

module.exports = {
  widgetSchema,
  layoutItemSchema,
  createDashboardSchema,
  updateDashboardSchema,
  patchWidgetSchema,
  patchDashboardSchema
};
