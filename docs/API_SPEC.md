# PulseList Frontend API Spec (v0.1)

> 目标：为现有前端页面提供统一、清晰、可扩展的后端接口规范。
> - JSON over HTTPS
> - Base URL: `/api`
> - 认证：Bearer Token（JWT）
> - 时间格式：ISO 8601（`YYYY-MM-DD` 或 `YYYY-MM-DDTHH:mm:ssZ`）

---

## 1) Auth / User

### POST /api/auth/login
**说明**：登录，返回 token 与用户信息。

**Request**
```json
{
  "account": "string",
  "password": "string"
}
```

**Response**
```json
{
  "token": "jwt_token",
  "user": {
    "id": "u_123",
    "nickname": "罗董",
    "avatar": "https://.../avatar.png",
    "timezone": "Asia/Shanghai"
  }
}
```

### POST /api/auth/logout
**说明**：退出登录（可选）。

---

### GET /api/users/me
**说明**：获取当前用户信息。

**Response**
```json
{
  "id": "u_123",
  "nickname": "罗董",
  "avatar": "https://.../avatar.png",
  "timezone": "Asia/Shanghai"
}
```

### PATCH /api/users/me
**说明**：更新个人设置（昵称 + 番茄参数）。

**Request**
```json
{
  "nickname": "罗董",
  "pomodoroSettings": {
    "focusMinutes": 30,
    "shortBreakMinutes": 10,
    "longBreakMinutes": 20,
    "longBreakEvery": 4
  }
}
```

**Response**
```json
{
  "success": true
}
```

---

## 2) Dashboard

### GET /api/dashboard/overview
**说明**：今日概览数据（4 卡片 + 进度）。

**Response**
```json
{
  "completionRate": 72,
  "focusMinutes": 75,
  "todoCount": 5,
  "teamMembers": 4
}
```

### GET /api/dashboard/tasks
**说明**：今日任务列表。

**Response**
```json
[
  {
    "id": "t1",
    "title": "梳理下周家庭计划与预算",
    "category": "家庭",
    "priority": "P1",
    "due": "2026-03-13",
    "done": false,
    "icon": "mdi:home-heart"
  }
]
```

---

## 3) Tasks

### GET /api/tasks
**说明**：任务列表。

**Query**
- `status`: `all | todo | done`
- `priority`: `all | P1 | P2 | P3`
- `q`: keyword

**Response**
```json
[
  {
    "id": "t1",
    "title": "完成客户需求梳理",
    "category": "工作",
    "priority": "P1",
    "due": "2026-03-13",
    "done": false,
    "icon": "mdi:briefcase-outline"
  }
]
```

### POST /api/tasks
**Request**
```json
{
  "title": "string",
  "category": "string",
  "priority": "P1|P2|P3",
  "due": "YYYY-MM-DD",
  "icon": "mdi:xxx"
}
```

### PATCH /api/tasks/:id
**Request**
```json
{
  "title": "string",
  "category": "string",
  "priority": "P1|P2|P3",
  "due": "YYYY-MM-DD",
  "done": true,
  "icon": "mdi:xxx"
}
```

### DELETE /api/tasks/:id

---

## 4) Calendar (Upcoming)

### GET /api/calendar/events
**说明**：待办安排（用于日历 + 右侧列表）。

**Response**
```json
[
  {
    "id": "e1",
    "date": "2026-03-13",
    "time": "09:00",
    "title": "家庭采购清单检查",
    "status": "todo" 
  }
]
```

`status` = `todo | done | overdue`

---

## 5) Habits

### GET /api/habits
**说明**：习惯列表（按成员过滤）。

**Query**
- `memberId`: string

**Response**
```json
[
  {
    "id": "h1",
    "name": "晨间拉伸",
    "target": 20,
    "streak": 8,
    "done": true,
    "icon": "mdi:weather-sunny",
    "memberId": "m1"
  }
]
```

### POST /api/habits
```json
{
  "name": "string",
  "target": 20,
  "memberId": "m1"
}
```

### PATCH /api/habits/:id
```json
{
  "name": "string",
  "target": 20,
  "done": true,
  "memberId": "m1"
}
```

### DELETE /api/habits/:id

---

## 6) Habit Members

### GET /api/habit-members
**Response**
```json
[
  { "id": "m1", "name": "罗董" },
  { "id": "m2", "name": "小李" }
]
```

### POST /api/habit-members
```json
{ "name": "string" }
```

### DELETE /api/habit-members/:id

---

## 7) Ledger (个人明细)

### GET /api/ledger/records
**Query**
- `type`: `all | income | expense`
- `category`: string
- `q`: keyword

**Response**
```json
[
  {
    "id": "l1",
    "type": "expense",
    "category": "餐饮",
    "amount": 68,
    "date": "2026-03-13",
    "note": "午餐"
  }
]
```

### POST /api/ledger/records
```json
{
  "type": "expense",
  "category": "餐饮",
  "amount": 68,
  "date": "2026-03-13",
  "note": "午餐"
}
```

### PATCH /api/ledger/records/:id
```json
{
  "type": "expense",
  "category": "餐饮",
  "amount": 68,
  "date": "2026-03-13",
  "note": "午餐"
}
```

### DELETE /api/ledger/records/:id

---

## 8) Ledger (家庭概览)

### GET /api/ledger/family/summary
**说明**：家庭/月度统计（用于弹窗 3 个 tab）。

**Query**
- `month`: `YYYY-MM`

**Response**
```json
{
  "month": "2026-03",
  "expenseTotal": 289,
  "incomeTotal": 0,
  "members": [
    { "memberId": "m1", "memberName": "罗董", "expense": 90, "income": 0 },
    { "memberId": "m2", "memberName": "小李", "expense": 199, "income": 0 }
  ],
  "categories": [
    { "category": "餐饮", "total": 90 },
    { "category": "交通", "total": 22 }
  ]
}
```

---

## 9) Stats

### GET /api/stats/weekly
**说明**：本周节奏（图表）。

**Response**
```json
{
  "labels": ["一","二","三","四","五","六","日"],
  "focusMinutes": [95,120,65,140,80,50,110]
}
```

---

# 后端开发进程建议

## Step 1: 基础架构与鉴权
- 初始化后端工程（ThinkPHP6）
- 完成用户表、JWT 认证中间件
- 实现 `/auth/login` `/users/me`

## Step 2: 业务模块接口
- 任务（tasks）、习惯（habits + members）、日历（calendar）
- 记账个人明细（ledger/records）

## Step 3: 统计与家庭概览
- dashboard/overview + stats/weekly
- ledger/family/summary（支出/收入/分类）
- 性能/安全检查、日志

---

> 文件位置：`/docs/API_SPEC.md`
