# 染·钟楼谜团 在线魔典工具

> 基于 [bra1n/townsquare](https://github.com/bra1n/townsquare) 定制的中文版本，为 Blood on the Clocktower (血染钟楼) 提供完整的在线游戏辅助功能。

## 项目简介

这是一款 **Blood on the Clocktower (血染钟楼)** 桌游的在线魔典 (Grimoire) 工具，供说书人 (Storyteller) 和玩家在线上进行游戏。支持实时联网对战、角色管理、投票系统等功能。所有界面和角色数据均已完全中文化。

**版本：** v2.16.2  
**技术栈：** Vue 2.6 + Vuex 3 + SCSS + WebSocket  
**代码规模：** ~29,000 行 (含 JSON 数据)  
**许可证：** GPL-3.0

---

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

项目包含两个独立的服务，需要**同时启动**：

```bash
# 1. 启动前端开发服务器（端口 8080）
npm run serve

# 2. 启动 WebSocket 服务器（端口 8081，另开一个终端）
NODE_ENV=development node server/index.js
```

### 局域网使用

前端已配置允许局域网设备访问（`vue.config.js` 中 `host: "0.0.0.0"`）。

假设服务端 IP 为 `192.168.149.98`：

1. **服务端**：启动上述两个服务
2. **说书人**：在浏览器打开 `http://192.168.149.98:8080`，点击菜单 → "创建小镇(说书人)" → 输入房间号
3. **玩家**：在**同一局域网**的任何设备上，用浏览器打开 `http://192.168.149.98:8080`，点击菜单 → "加入小镇(玩家)" → 输入房间号

> **关键**：玩家浏览器地址栏必须是**服务端的 IP 地址**（如 `http://192.168.149.98:8080`），不能是 `localhost`。前端会自动使用浏览器当前连接的 IP 地址建立 WebSocket 连接。

### 其他命令

```bash
# 生产构建
npm run build

# 代码检查与自动修复
npm run lint

# CI 模式代码检查 (不自动修复)
npm run lint-ci
```

### Docker 部署

一键部署到生产环境（包含 Web 静态文件和 WebSocket 两个服务）：

```bash
# 构建并启动（web:80 + ws:8080 内部通信）
docker compose up -d --build

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

Nginx 会自动将 WebSocket 升级请求代理到后端 WS 服务，无需额外配置。

如需热更新剧本（不重新构建镜像），取消 `docker-compose.yml` 中 volumes 注释后重启：

```bash
docker compose restart web
```

访问 `http://your-server-ip` 即可使用。

---

## 核心功能

### 🎭 完整的游戏辅助

- **公开/私密模式切换** (快捷键 **G**)：说书人魔典 ↔ 小镇广场视图
- **昼夜切换** (快捷键 **S**)：支持夜晚模式显示，带动态背景效果
- **玩家管理**：添加/移除玩家、随机座位、交换/移动位置
- **角色分配**：支持官方剧本和自定义剧本的角色管理
- **内置剧本浏览器**：内置 900+ 剧本，支持搜索和分类筛选，一键加载
- **恶魔伪装**：为恶魔设置伪装角色，可分发给玩家查看
- **传奇角色**：支持添加/移除传奇 (Fabled) 角色
- **提醒标记**：为每个玩家添加技能提醒 token
- **夜晚顺序**：显示每个角色的夜晚行动顺序和提醒文本

### 🗳️ 投票系统

- **实时投票**：支持提名、投票、计票的完整流程
- **投票锁定**：逐步锁定投票，模拟真实举手表态过程
- **投票历史**：记录每次投票的详细信息
- **投票速度控制**：可调节投票倒计时速度

### 🌐 实时联网

- **房间系统**：说书人创建房间，玩家通过房间号加入
- **状态同步**：说书人的所有操作实时同步给所有玩家
- **角色分发**：通过私聊消息仅给每位玩家发送自己的角色，保障信息隐藏
- **座位认领**：玩家可以认领座位，说书人确认
- **断线重连**：3 秒自动重连 + 重连状态 UI 提示
- **房间列表**：显示所有可用房间及其玩家数量

### 💾 数据持久化

- **自动保存**：所有游戏状态自动保存到 localStorage
- **完整恢复**：页面刷新后完整恢复游戏状态（玩家、角色、剧本、设置等）
- **图片缓存**：自定义剧本角色图标异步缓存到 IndexedDB，下次加载秒开
- **会话恢复**：通过 URL hash (`#roomname`) 自动加入房间

### 🎨 界面定制

- **缩放控制**：支持魔典视图缩放
- **自定义背景**：支持图片或视频背景
- **禁用动画**：一键关闭所有过渡和动画效果
- **静音模式**：关闭所有音效

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│  App.vue (根组件)                                        │
│  ├── Intro.vue (无玩家时的欢迎界面)                       │
│  ├── TownInfo.vue (游戏信息条)                            │
│  ├── TownSquare.vue (主游戏区 - 玩家圈 + 伪装 + 传奇)     │
│  │   ├── Player.vue (每个玩家 token)                      │
│  │   ├── Token.vue (角色 token 显示)                      │
│  │   ├── ReminderModal.vue                                │
│  │   └── RoleModal.vue                                    │
│  ├── Vote.vue (投票覆盖层)                                │
│  ├── Menu.vue (设置菜单)                                  │
│  ├── modals/ (10个模态框组件)                              │
│  └── Gradients.vue (SVG 渐变定义)                         │
└─────────────────────────────────────────────────────────┘
         │                    │
    Vuex Store            WebSocket
    ┌────┴────┐          ┌──────────┐
    │  root   │          │ server/  │
    │ index.js│◄────────►│ index.js │
    ├─────────┤   双向    │ (WSS)    │
    │ players │          └──────────┘
    │ session │
    ├─────────┤
    │persist  │ ←→ localStorage
    │ socket  │ ←→ WebSocket 事件
    └─────────┘
```

### 状态管理 (Vuex)

| 模块 | 文件 | 职责 |
|------|------|------|
| **Root** | `src/store/index.js` | 魔典 UI 状态、版 edition/角色数据、自定义角色处理、相克关系 |
| **Players** | `src/store/modules/players.js` | 玩家座位、角色、提醒标记、生死状态、投票状态、恶魔伪装、传奇角色 |
| **Session** | `src/store/modules/session.js` | 联机状态、房间 ID、提名/投票、投票历史、座位认领 |
| **Persistence** | `src/store/persistence.js` | localStorage 持久化插件，自动保存/恢复所有游戏设置和玩家数据 |
| **Socket** | `src/store/socket.js` | WebSocket 插件，实现完整的 Host/Spectator 实时同步协议 |

### 数据层

| 文件 | 行数 | 内容 |
|------|------|------|
| `src/roles.json` | 3,505 | 所有角色定义 (中文)，含夜晚顺序、提醒词、技能描述 |
| `src/fabled.json` | 232 | 传奇/奇遇角色 |
| `src/hatred.json` | 376 | 角色相克 (Jinx) 关系 |
| `src/game.json` | 13 | 人数对应角色配置规则 |
| `src/editions.json` | ~110 | 剧本版本定义 |

### WebSocket 服务器 (`server/index.js`)

- 基于 `ws` 库的轻量 WebSocket 中继服务器
- 支持频道 (channel) 隔离，每个房间一个频道
- Host/Player 角色区分，防止重复 Host
- 内置速率限制 (5 msg/s)、心跳检测 (30s)
- Prometheus 监控指标（并发数、消息量、频道数）
- 房间列表广播功能
- 生产环境使用 HTTPS + WSS

---

## 关键设计模式

### 1. 事件冒泡模式

玩家操作通过事件冒泡传递到顶层组件：

```javascript
Player.vue → $emit('trigger', ['methodName', params])
  → TownSquare.vue → handleTrigger() → 调用对应方法
```

### 2. Host/Spectator 双角色架构

- **Host（说书人）**：完全控制游戏状态，广播给所有 Spectator
- **Spectator（观众/玩家）**：只读状态，可认领座位、投票
- 通过 `_isSpectator` 标志区分，大量方法开头都有此守卫

```javascript
sendPlayer({ player, property, value }) {
  if (this._isSpectator || property === "reminders") return;
  // ... 发送数据
}
```

### 3. 自定义角色支持

- 兼容官方 Script Tool JSON 格式 + `_meta` 扩展
- 自定义角色用数字索引替代 key 名以节省带宽
- **内置剧本浏览器**：900+ 剧本一键加载，无需手动上传 JSON
- **智能图片策略**：官方剧本使用本地图标，自定义剧本使用 JSON 中的远程 URL 并缓存到 IndexedDB

### 4. 状态持久化

- 所有关键状态通过 Vuex plugin 自动同步到 localStorage
- 页面刷新后完整恢复游戏状态
- Session ID 通过 URL hash 传播 (`#roomname`)

### 5. 增量状态同步

`sendGamestate` 支持 `isLightweight` 模式，只同步玩家增减，避免全量传输：

```javascript
sendGamestate(playerId = "", isLightweight = false) {
  if (isLightweight) {
    // 只发送玩家基本信息
    this._sendDirect(playerId, "gs", {
      gamestate: this._gamestate,
      isLightweight
    });
  } else {
    // 发送完整游戏状态
    this._sendDirect(playerId, "gs", {
      gamestate: this._gamestate,
      isNight: grimoire.isNight,
      nomination: session.nomination,
      // ... 更多状态
    });
  }
}
```

---

## 支持的剧本版本

| ID | 名称 | 类型 | 难度 |
|----|------|------|------|
| `tb` | 暗流涌动 | 官方基础 | Beginner |
| `bmr` | 黯月初升 | 官方中级 | Intermediate |
| `snv` | 梦殒春宵 | 官方中级 | Intermediate |
| `luf` | 窃窃私语 | 官方高级 | Veteran |
| `ngj` | 无上愉悦 | 官方小型剧本 | 1级 |
| `hdcs` | 华灯初上 | 官方剧本 | 4级 |
| `syyl` | 染·原创剧本 | GStone 原创 | Advanced |
| `exp` | 实验性角色 | 实验 | - |
| 自定义 | 任意 JSON 导入 | 用户自制 | - |

---

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| **G** | 切换公开/私密模式 |
| **A** | 添加玩家 |
| **S** | 切换昼夜 |
| **N** | 显示夜晚顺序 |
| **R** | 显示参考表 |
| **E** | 选择剧本版本 |
| **C** | 自定义角色 |
| **V** | 投票历史 |
| **H** | 主持房间 |
| **J** | 加入房间 |
| **ESC** | 关闭模态框 |

---

## 技术亮点

### 1. 纯 CSS 圆形布局

用 SCSS 循环 + `transform: rotate()` 实现 1-20 人自适应圆形排列，无需 JS 计算：

```scss
@for $i from 1 through 20 {
  .circle.size-#{$i} > li {
    @include on-circle($item-count: $i);
  }
}
```

### 2. 投票锁定机制

支持逐步锁定投票，模拟真实举手表态过程，增强游戏体验。

### 3. 恶魔伪装分发

`distributeRoles()` 通过 `direct` 消息仅给每位玩家发送自己的角色，保障信息隐藏：

```javascript
distributeRoles() {
  const message = {};
  this._store.state.players.players.forEach((player, index) => {
    if (player.id && player.role && player.role.id) {
      message[player.id] = ["player", { index, property: "role", value: player.role.id }];
    }
  });
  if (Object.keys(message).length) {
    this._send("direct", message);
  }
}
```

### 4. 视频背景支持

支持 `.mp4`/`.webm` 视频背景，增强视觉效果：

```vue
<video
  id="background"
  v-if="grimoire.background && grimoire.background.match(/\.(mp4|webm)$/i)"
  :src="grimoire.background"
  autoplay
  loop
></video>
```

### 5. 房间销毁通知

说书人退出时自动销毁房间并通知所有玩家：

```javascript
_handleSessionDestroy() {
  this._store.commit("session/setSessionId", "");
  this.disconnect();
  alert("说书人已退出，房间已销毁");
}
```

---

## 自定义脚本格式

支持官方 Script Tool JSON 格式，并可添加 `_meta` 对象提供额外信息：

```json
[
  { "id": "_meta", "name": "剧本名称", "author": "作者", "logo": "url" },
  { "id": "washerwoman" },
  { "id": "custom_char", "name": "自定义角色", "team": "outsider", "ability": "..." }
]
```

### 角色属性说明

**必需属性：**
- `id` - 角色唯一标识（无空格或特殊字符）
- `name` - 角色显示名称
- `team` - 角色阵营：`townsfolk`、`outsider`、`minion`、`demon`、`traveler`、`fabled`
- `ability` - 角色技能描述

**可选属性：**
- `image` - 角色图标 URL（内置剧本自动缓存到 IndexedDB，用户上传剧本需开启自定义图片选项）
- `edition` - 所属剧本 ID
- `firstNight` / `otherNight` - 首夜/其他夜晚行动顺序（正整数，0 表示不行动）
- `firstNightReminder` / `otherNightReminder` - 夜晚提醒文本
- `reminders` - 提醒 token 列表
- `remindersGlobal` - 全局提醒 token
- `setup` - 是否影响设置（橙色树叶标记）

---

## 项目结构

```
clocktower/
├── src/
│   ├── main.js                 # 入口文件，注册 FontAwesome 图标
│   ├── App.vue                 # 根组件
│   ├── store/                  # Vuex 状态管理
│   │   ├── index.js           # Root store
│   │   ├── modules/
│   │   │   ├── players.js     # 玩家状态模块
│   │   │   └── session.js     # 联机会话模块
│   │   ├── persistence.js     # localStorage 持久化
│   │   └── socket.js          # WebSocket 插件
│   ├── utils/
│   │   └── imageCache.js      # IndexedDB 图片缓存
│   ├── components/             # Vue 组件
│   │   ├── TownSquare.vue     # 主游戏区
│   │   ├── Player.vue         # 玩家 token
│   │   ├── Token.vue          # 角色 token
│   │   ├── Vote.vue           # 投票覆盖层
│   │   ├── Menu.vue           # 设置菜单
│   │   ├── Intro.vue          # 欢迎界面
│   │   ├── TownInfo.vue       # 游戏信息条
│   │   ├── Gradients.vue      # SVG 渐变
│   │   └── modals/            # 模态框组件
│   │       └── ScriptBrowserModal.vue  # 内置剧本浏览器
│   ├── roles.json             # 角色定义 (中文)
│   ├── editions.json          # 剧本版本定义
│   ├── fabled.json            # 传奇角色
│   ├── hatred.json            # 相克关系
│   ├── game.json              # 人数配置规则
│   ├── vars.scss              # SCSS 变量
│   ├── media.scss             # 响应式样式
│   └── assets/                # 静态资源
│       ├── icons/             # 角色图标
│       ├── sounds/            # 音效
│       ├── fonts/             # 字体
│       └── editions/          # 剧本 logo
├── server/
│   ├── index.js               # WebSocket 服务器
│   ├── package.json           # WS 服务器依赖（ws + prom-client）
│   └── ecosystem.config.js    # PM2 配置
├── public/                     # 公共静态资源
│   ├── scripts/               # 内置剧本 JSON (900+ 剧本)
│   └── scripts-index.json     # 剧本索引
├── Dockerfile                  # Docker 多阶段构建（Web 前端）
├── Dockerfile.ws               # Docker 镜像（WebSocket 服务）
├── docker-compose.yml          # Docker Compose 编排（web + ws）
├── nginx.conf                  # Nginx 配置（含 WebSocket 反向代理）
└── package.json               # 项目配置
```

---

## 致谢与版权

- [Blood on the Clocktower](https://bloodontheclocktower.com/) 是 Steven Medway 和 [The Pandemonium Institute](https://www.thepandemoniuminstitute.com/) 的商标

---

## 相关链接

- [上游项目](https://github.com/bra1n/townsquare)
- [Blood on the Clocktower 官网](https://bloodontheclocktower.com/)
- [官方 Script Tool](https://script.bloodontheclocktower.com/)
