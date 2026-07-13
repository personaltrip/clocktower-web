# 染·钟楼谜团项目维护学习路径

> 面向有 C 和 Python 基础的编程新手，学习如何维护本项目的完整指南。

---

## 📚 学习路径（按优先级排序）

### 阶段 1：JavaScript 基础（1-2 周）

**从 Python 过渡到 JavaScript**

你已经会 Python，JS 的很多概念是相通的。重点学习：

#### 1. 基本语法差异

```javascript
// 变量声明（Python 没有 let/const）
let x = 10;        // 可重新赋值
const y = 20;      // 常量

// 函数（Python 用 def）
function add(a, b) { return a + b; }
const multiply = (a, b) => a * b;  // 箭头函数

// 对象和数组（类似 Python 的 dict 和 list）
const player = { name: "Alice", isDead: false };
const players = [{ name: "Bob" }, { name: "Charlie" }];
```

#### 2. 异步编程（这个项目中大量使用）

```javascript
// Promise 和 async/await（类似 Python 的 asyncio）
async function fetchData() {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

// 回调函数（JavaScript 特有）
setTimeout(() => {
  console.log("3秒后执行");
}, 3000);
```

#### 3. ES6+ 特性

- **解构赋值**：`const { name, age } = player;`
- **展开运算符**：`const newArr = [...oldArr, newItem];`
- **模板字符串**：`` `Hello ${name}` ``
- **数组方法**：`map`, `filter`, `reduce`, `find`

#### 推荐资源

- [现代 JavaScript 教程](https://zh.javascript.info/)（中文，非常详细）
- [MDN Web Docs](https://developer.mozilla.org/zh-CN/docs/Learn/Getting_started_with_the_web/JavaScript_basics)（官方文档）

---

### 阶段 2：HTML/CSS 基础（3-5 天）

这个项目用的是 Vue 单文件组件，你需要了解基本的 HTML 和 CSS。

#### 1. HTML 基础

- 标签、属性、嵌套结构
- 表单元素（input, button, select）

#### 2. CSS 基础

- 选择器、盒模型、布局（flexbox）
- 这个项目用了 SCSS（CSS 预处理器），语法类似但更强大

#### 3. SCSS 快速了解

```scss
// 变量（CSS 本身不支持）
$primary-color: #3498db;

// 嵌套（类似 Python 的缩进）
.player {
  color: white;
  &:hover {  // 父选择器引用
    color: red;
  }
  .token {
    width: 100px;
  }
}
```

#### 推荐资源

- [MDN HTML 入门](https://developer.mozilla.org/zh-CN/docs/Learn/HTML/Introduction_to_HTML)
- [Flexbox 青蛙游戏](https://flexboxfroggy.com/#language=zh-cn)（交互式学习）

---

### 阶段 3：Vue 2 框架（1-2 周）

**这是项目的核心**，需要重点学习。

#### 1. Vue 基础概念

- 组件化思想（把页面拆分成独立的小部件）
- 模板语法 `{{ }}`
- 指令：`v-if`, `v-for`, `v-model`, `@click`

#### 2. 组件结构（这个项目用的）

```vue
<template>
  <!-- HTML 部分 -->
  <div class="player">
    <h3>{{ player.name }}</h3>
    <button @click="removePlayer">移除</button>
  </div>
</template>

<script>
export default {
  props: ['player'],  // 接收父组件数据
  
  data() {
    return {
      isEditing: false  // 组件内部状态
    };
  },
  
  computed: {
    // 计算属性（类似 Python 的 @property）
    isAlive() {
      return !this.player.isDead;
    }
  },
  
  methods: {
    removePlayer() {
      this.$emit('remove', this.player.id);  // 向父组件发送事件
    }
  }
};
</script>

<style lang="scss" scoped>
/* CSS 部分，scoped 表示只对这个组件生效 */
.player {
  padding: 10px;
}
</style>
```

#### 3. 生命周期钩子

```javascript
export default {
  mounted() {
    // 组件挂载后执行（类似 __init__）
    console.log("组件已加载");
  },
  beforeDestroy() {
    // 组件销毁前执行（类似 __del__）
    console.log("组件即将销毁");
  }
};
```

#### 推荐资源

- [Vue 2 官方文档（中文）](https://cn.vuejs.org/v2/guide/)（必读！）
- [Vue 实例](https://cn.vuejs.org/v2/guide/instance.html)（重点理解）

---

### 阶段 4：Vuex 状态管理（3-5 天）

项目用 Vuex 管理全局状态，类似 Python 的全局变量但更结构化。

#### 1. 核心概念

```javascript
// state - 存储数据（类似全局变量）
state: {
  players: [],
  isNight: false
}

// mutations - 修改 state（同步）
mutations: {
  addPlayer(state, player) {
    state.players.push(player);
  },
  toggleNight(state) {
    state.isNight = !state.isNight;
  }
}

// actions - 异步操作（调用 mutations）
actions: {
  async fetchPlayers({ commit }) {
    const data = await api.getPlayers();
    commit('addPlayer', data);
  }
}

// getters - 计算属性（类似 computed）
getters: {
  alivePlayers: state => state.players.filter(p => !p.isDead)
}
```

#### 2. 在组件中使用

```vue
<script>
import { mapState, mapMutations } from 'vuex';

export default {
  computed: {
    ...mapState(['players', 'isNight']),  // 映射 state
    ...mapGetters(['alivePlayers'])       // 映射 getters
  },
  methods: {
    ...mapMutations(['toggleNight']),     // 映射 mutations
    addPlayer() {
      this.$store.commit('addPlayer', { name: 'Alice' });
    }
  }
};
</script>
```

#### 推荐资源

- [Vuex 官方文档（中文）](https://vuex.vuejs.org/zh/guide/)

---

### 阶段 5：WebSocket 基础（2-3 天）

你有 C 语言基础，理解 socket 概念会很快。

```javascript
// 创建连接（类似 C 的 socket() + connect()）
const ws = new WebSocket('ws://localhost:8081/room123/host');

// 监听消息（类似 recv()）
ws.onmessage = (event) => {
  const [command, data] = JSON.parse(event.data);
  console.log("收到消息:", command, data);
};

// 发送消息（类似 send()）
ws.send(JSON.stringify(['command', { key: 'value' }]));

// 连接打开
ws.onopen = () => {
  console.log("连接已建立");
};

// 连接关闭
ws.onclose = (event) => {
  console.log("连接关闭:", event.code, event.reason);
};
```

---

## 🎯 实践建议

### 第 1 周：熟悉项目结构

1. 运行项目：`npm install` 然后 `npm run serve`
2. 打开浏览器访问 `http://localhost:8080`
3. 尝试使用所有功能，理解每个按钮的作用

### 第 2 周：阅读代码

从简单的组件开始读：

1. `src/components/Token.vue` - 最简单的组件之一
2. `src/components/Player.vue` - 理解 props 和事件
3. `src/store/modules/players.js` - 理解 Vuex 模块

### 第 3 周：做小改动

尝试修改：

1. 改文字：把"添加玩家"改成"新增玩家"
2. 改颜色：修改 `src/vars.scss` 中的颜色变量
3. 加功能：在玩家信息中显示序号

### 第 4 周：理解核心流程

阅读关键文件：

1. `src/store/socket.js` - WebSocket 通信
2. `src/store/persistence.js` - 数据持久化
3. `src/App.vue` - 根组件如何组织其他组件

---

## 🛠️ 调试技巧

### 1. 浏览器开发者工具（F12）

- **Console**：查看错误日志
- **Network**：查看网络请求和 WebSocket 消息
- **Vue Devtools**：查看组件树和 Vuex 状态

### 2. 常用调试方法

```javascript
// 打印变量（类似 Python 的 print）
console.log("player:", player);
console.table(players);  // 表格形式显示数组

// 断点调试
debugger;  // 代码执行到这里会暂停
```

---

## 📖 推荐学习顺序总结

| 阶段 | 内容 | 时间 | 重要性 |
|------|------|------|--------|
| 1 | JavaScript 基础 | 1-2 周 | ⭐⭐⭐⭐⭐ |
| 2 | HTML/CSS 基础 | 3-5 天 | ⭐⭐⭐ |
| 3 | Vue 2 框架 | 1-2 周 | ⭐⭐⭐⭐⭐ |
| 4 | Vuex | 3-5 天 | ⭐⭐⭐⭐ |
| 5 | WebSocket | 2-3 天 | ⭐⭐⭐ |

**总计：约 6-8 周**可以开始独立维护项目

---

## 💡 利用你的 C/Python 基础

### C 语言帮助你的地方

- 理解 WebSocket 的底层原理
- 理解事件循环（类似 C 的 select/epoll）
- 类型系统概念

### Python 帮助你的地方

- 对象和数组操作（JS 的 array/object 类似 Python 的 list/dict）
- 函数式编程（map/filter/reduce）
- 异步编程概念（async/await）

---

## 🆘 遇到问题怎么办

1. **先看控制台错误** - 90% 的问题都能从错误信息中找到答案
2. **搜索错误信息** - 复制错误信息到 Google/百度
3. **查看官方文档** - Vue/Vuex 的文档写得很好
4. **使用 AI 助手** - 遇到具体问题可以询问 Claude 或其他 AI 工具

---

## 🔗 学习资源汇总

### JavaScript

- [现代 JavaScript 教程](https://zh.javascript.info/) - 最全面的中文 JS 教程
- [MDN Web Docs](https://developer.mozilla.org/zh-CN/) - 官方文档
- [JavaScript 秘密花园](http://shamansir.github.io/js-garden/) - 常见陷阱

### Vue

- [Vue 2 官方文档](https://cn.vuejs.org/v2/guide/) - 必读
- [Vuex 文档](https://vuex.vuejs.org/zh/guide/) - 状态管理
- [Vue 开发者工具](https://github.com/vuejs/vue-devtools) - 调试必备

### HTML/CSS

- [MDN HTML 入门](https://developer.mozilla.org/zh-CN/docs/Learn/HTML)
- [MDN CSS 入门](https://developer.mozilla.org/zh-CN/docs/Learn/CSS)
- [Flexbox 青蛙](https://flexboxfroggy.com/#language=zh-cn) - 交互式学习
- [CSS 网格花园](https://cssgridgarden.com/) - Grid 布局学习

### 综合

- [菜鸟教程](https://www.runoob.com/) - 基础教程
- [W3School](https://www.w3school.com.cn/) - 在线参考手册

---

## 📝 学习检查清单

完成以下任务说明你已掌握相应技能：

### JavaScript 基础

- [ ] 理解 `let`、`const`、`var` 的区别
- [ ] 能写箭头函数
- [ ] 理解 `async/await` 和 Promise
- [ ] 会使用 `map`、`filter`、`reduce`
- [ ] 理解解构赋值和展开运算符

### HTML/CSS

- [ ] 能写基本的 HTML 结构
- [ ] 理解 CSS 选择器
- [ ] 会使用 Flexbox 布局
- [ ] 了解 SCSS 基本语法

### Vue 2

- [ ] 理解组件的 `template`、`script`、`style` 三部分
- [ ] 会使用 `props` 接收父组件数据
- [ ] 会用 `data`、`computed`、`methods`
- [ ] 理解生命周期钩子（`mounted`、`beforeDestroy`）
- [ ] 会用 `v-if`、`v-for`、`v-model`
- [ ] 会使用 `$emit` 向父组件发送事件

### Vuex

- [ ] 理解 `state`、`mutations`、`actions`、`getters`
- [ ] 会在组件中使用 `mapState`、`mapMutations`
- [ ] 理解命名空间（`namespaced: true`）

### WebSocket

- [ ] 能创建 WebSocket 连接
- [ ] 会发送和接收消息
- [ ] 理解连接状态管理

---

祝你学习顺利！有任何问题随时询问。
