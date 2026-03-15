# Dashboard V2 设计方案（参考图片）

## 目标
- 视觉风格：深色/霓虹质感 + 玻璃/柔光卡片
- 结构：左侧紧凑导航 + 顶部搜索/个人信息 + 中央数据卡片 + 右侧资金卡片/交易列表
- 交互：主区域聚焦仪表盘数据；导航与筛选尽量轻量

---

## 视觉基调
- 背景：深灰渐变（#0E1113 → #1A1F22）
- 卡片：深色半透明 + 柔和阴影（blur + 12~18px）
- 高亮色：紫/绿/蓝（用于主图表与关键数字）
- 字体层级：标题 20~24 / 数据 18~22 / 辅助 12~14

---

## 新导航规划（已调整标签）
- **总览** /dashboard
- **收支** /ledger
- **待办** /tasks
- **习惯** /habits
- **洞察** /stats

> 目的：将“收支”前置到更核心的位置，与图中“Transactions/Balance”强调一致。

---

## 页面结构（与参考图一致）

### A. 左侧窄栏导航（后续迭代）
- 圆角胶囊图标
- 状态：选中高亮 + 微光

### B. 顶部条
- 左：搜索框（圆角/暗底）
- 右：头像 + “Hi, 罗董”

### C. 主面板（左侧）
1. 标题区：My Dashboard + 子筛选 Pills（All / Withdrawal / Savings / Deposit）
2. Revenue Flow（柱状 + 高亮标记点）
3. Available（环形/半环形统计）
4. Income & Expense 双卡

### D. 右侧面板
1. My Card（余额卡 + 轻浮层）
2. Transactions（列表，图标 + 金额）
3. Spending（迷你折线）

---

## 数据映射建议
- Revenue Flow：用账单月度趋势（ledger 月统计）
- Available：预算-已用比例
- Income/Expense：本月收入/支出
- Transactions：最近 5 条记录

---

## 下一步实现建议
1. 拆分 Dashboard 组件：`DashboardHeader` / `RevenueChart` / `SummaryRing` / `CardPanel` / `TransactionList`
2. 加入 `dashboard-v2` 样式文件，统一卡片/渐变/圆角基线
3. 引入 Chart 组件（ECharts/Chart.js）

