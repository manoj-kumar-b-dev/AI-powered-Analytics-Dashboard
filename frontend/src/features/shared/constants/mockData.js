// Static mock data for the SaaS analytics dashboard

export const metricCardsData = [
  {
    title: "Total Revenue",
    value: "$24,530",
    trend: "18.2%",
    isPositive: true,
    timeframe: "Last Month",
    color: "purple",
    icon: "RefreshCw"
  },
  {
    title: "Total Sales",
    value: "$15,120",
    trend: "11.7%",
    isPositive: true,
    timeframe: "Last Month",
    color: "blue",
    icon: "ShoppingCart"
  },
  {
    title: "Total Customers",
    value: "2,350",
    trend: "8.4%",
    isPositive: true,
    timeframe: "Last Month",
    color: "green",
    icon: "Users"
  },
  {
    title: "Total Expenses",
    value: "$8,430",
    trend: "3.6%",
    isPositive: false,
    timeframe: "Last Month",
    color: "red",
    icon: "Wallet"
  },
  {
    title: "Net Profit",
    value: "$7,690",
    trend: "14.6%",
    isPositive: true,
    timeframe: "Last Month",
    color: "orange",
    icon: "Coins"
  }
];

export const revenueData = [
  { month: "Jan", revenue: 12000, sales: 8000 },
  { month: "Feb", revenue: 16500, sales: 11000 },
  { month: "Mar", revenue: 15000, sales: 9500 },
  { month: "Apr", revenue: 19000, sales: 13000 },
  { month: "May", revenue: 24530, sales: 17000 },
  { month: "Jun", revenue: 21000, sales: 14000 }
];

export const salesByRegionData = [
  { name: "North America", value: 45, amount: "$6,804", color: "#8B5CF6" },
  { name: "Europe", value: 25, amount: "$3,780", color: "#3B82F6" },
  { name: "Asia", value: 20, amount: "$3,024", color: "#22C55E" },
  { name: "South America", value: 10, amount: "$1,512", color: "#F59E0B" }
];

export const salesOverviewWeeklyData = [
  { day: "May 6", direct: 2200, indirect: 1400 },
  { day: "May 13", direct: 2700, indirect: 1900 },
  { day: "May 20", direct: 3240, indirect: 2200 },
  { day: "May 27", direct: 2900, indirect: 1800 },
  { day: "Jun 3", direct: 3600, indirect: 2400 },
  { day: "Jun 10", direct: 3100, indirect: 2100 }
];

export const topProductsData = [
  { name: "Product A", value: 85, amount: "$4,230", color: "#8B5CF6" },
  { name: "Product B", value: 68, amount: "$3,120", color: "#3B82F6" },
  { name: "Product C", value: 45, amount: "$2,450", color: "#22C55E" },
  { name: "Product D", value: 32, amount: "$1,230", color: "#F59E0B" },
  { name: "Product E", value: 20, amount: "$890", color: "#EF4444" }
];

export const recentUploadsData = [
  {
    id: "up-01",
    fileName: "sales_may_jun.csv",
    rows: "12,520",
    columns: "8",
    uploadedOn: "Jun 10, 2024",
    status: "Processed"
  },
  {
    id: "up-02",
    fileName: "marketing_data.xlsx",
    rows: "8,430",
    columns: "6",
    uploadedOn: "Jun 8, 2024",
    status: "Processed"
  },
  {
    id: "up-03",
    fileName: "expenses_may.csv",
    rows: "5,210",
    columns: "7",
    uploadedOn: "Jun 6, 2024",
    status: "Processed"
  }
];

export const kpisData = [
  {
    id: "kpi-1",
    name: "Revenue Growth",
    status: "Good",
    color: "text-green-400"
  },
  {
    id: "kpi-2",
    name: "Customer Retention",
    status: "Warning",
    color: "text-amber-400"
  },
  {
    id: "kpi-3",
    name: "Profit Margin",
    status: "Good",
    color: "text-green-400"
  },
  {
    id: "kpi-4",
    name: "Expense Ratio",
    status: "Critical",
    color: "text-red-400"
  }
];

export const aiInsightsData = [
  {
    id: "ins-1",
    text: "Revenue increased by <span class='text-green-400 font-semibold'>18.2%</span> compared to last month. Great job!",
    type: "sparkle"
  },
  {
    id: "ins-2",
    text: "South region generated the highest revenue of $6,804 (45%).",
    type: "trending"
  },
  {
    id: "ins-3",
    text: "Expenses are rising faster than profits. Consider optimizing costs.",
    type: "warning"
  },
  {
    id: "ins-4",
    text: "Weekend sales are 35% higher than weekday sales.",
    type: "lightbulb"
  }
];

export const initialChatMessages = [
  {
    sender: "user",
    text: "Why did my sales drop in April?",
    timestamp: "6:48 PM"
  },
  {
    sender: "ai",
    text: "Sales dropped in April mainly due to a 22% decrease in Product A sales and lower marketing spend during that period.",
    timestamp: "6:49 PM"
  }
];

export const quickActionsData = [
  {
    id: "qa-1",
    title: "Upload New Data",
    icon: "UploadCloud"
  },
  {
    id: "qa-2",
    title: "Generate Report",
    icon: "FileBarChart"
  },
  {
    id: "qa-3",
    title: "AI Data Insights",
    icon: "Sparkles"
  },
  {
    id: "qa-4",
    title: "Invite Team Members",
    icon: "UserPlus"
  }
];
