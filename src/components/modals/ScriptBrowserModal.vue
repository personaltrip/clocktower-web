<template>
  <Modal
    class="script-browser"
    v-if="modals.scriptBrowser"
    :maximized="true"
    @close="toggleModal('scriptBrowser')"
  >
    <div class="browser-header">
      <h3>内置剧本</h3>
      <div class="search-bar">
        <font-awesome-icon icon="search" />
        <input
          type="text"
          v-model="searchQuery"
          placeholder="搜索剧本名称、作者..."
          ref="searchInput"
          @input="currentPage = 1"
        />
        <span v-if="searchQuery" class="clear-btn" @click="searchQuery = ''; currentPage = 1">
          <font-awesome-icon icon="times" />
        </span>
      </div>
      <div class="category-tabs">
        <span
          class="tab"
          :class="{ active: selectedCategory === '' }"
          @click="selectedCategory = ''; currentPage = 1"
        >全部</span>
        <span
          v-for="cat in categories"
          :key="cat"
          class="tab"
          :class="{ active: selectedCategory === cat }"
          @click="selectedCategory = cat; currentPage = 1"
        >{{ cat }}</span>
      </div>
    </div>

    <div class="browser-content" v-if="!loading">
      <div class="results-info">
        共 {{ filteredScripts.length }} 个剧本
      </div>
      <div class="script-grid">
        <div
          v-for="script in pagedScripts"
          :key="script.file"
          class="script-card"
          @click="loadScript(script)"
        >
          <div class="card-name">{{ script.name }}</div>
          <div class="card-meta">
            <span class="card-author" v-if="script.author">{{ script.author }}</span>
            <span class="card-players">{{ script.players }}人</span>
          </div>
        </div>
      </div>
      <div class="pagination" v-if="totalPages > 1">
        <span class="page-btn" :class="{ disabled: currentPage <= 1 }" @click="goPage(currentPage - 1)">
          &laquo;
        </span>
        <span
          v-for="p in visiblePages"
          :key="p"
          class="page-btn"
          :class="{ active: p === currentPage, ellipsis: p === '...' }"
          @click="p !== '...' && goPage(p)"
        >{{ p }}</span>
        <span class="page-btn" :class="{ disabled: currentPage >= totalPages }" @click="goPage(currentPage + 1)">
          &raquo;
        </span>
      </div>
    </div>

    <div class="browser-loading" v-else>
      <font-awesome-icon icon="spinner" spin />
      加载中...
    </div>
  </Modal>
</template>

<script>
import { mapMutations, mapState } from "vuex";
import Modal from "./Modal";

const PAGE_SIZE = 30;

export default {
  components: { Modal },
  data() {
    return {
      scripts: [],
      searchQuery: "",
      selectedCategory: "",
      categories: [],
      currentPage: 1,
      loading: true
    };
  },
  computed: {
    ...mapState(["modals"]),
    filteredScripts() {
      let result = this.scripts;
      if (this.selectedCategory) {
        result = result.filter(s => s.category === this.selectedCategory);
      }
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        result = result.filter(
          s =>
            s.name.toLowerCase().includes(q) ||
            s.author.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q)
        );
      }
      return result;
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.filteredScripts.length / PAGE_SIZE));
    },
    pagedScripts() {
      const start = (this.currentPage - 1) * PAGE_SIZE;
      return this.filteredScripts.slice(start, start + PAGE_SIZE);
    },
    visiblePages() {
      const total = this.totalPages;
      const cur = this.currentPage;
      if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
      }
      const pages = [1];
      if (cur > 3) pages.push("...");
      for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) {
        pages.push(i);
      }
      if (cur < total - 2) pages.push("...");
      pages.push(total);
      return pages;
    }
  },
  watch: {
    "modals.scriptBrowser"(val) {
      if (val && this.scripts.length === 0) {
        this.fetchIndex();
      }
      if (val) {
        this.$nextTick(() => {
          this.$refs.searchInput && this.$refs.searchInput.focus();
        });
      }
    },
    filteredScripts() {
      if (this.currentPage > this.totalPages) {
        this.currentPage = 1;
      }
    }
  },
  methods: {
    async fetchIndex() {
      try {
        const res = await fetch("/scripts-index.json");
        this.scripts = await res.json();
        this.categories = [...new Set(this.scripts.map(s => s.category))].sort(
          (a, b) => a.localeCompare(b)
        );
      } catch (e) {
        console.error("加载剧本索引失败:", e);
      } finally {
        this.loading = false;
      }
    },
    goPage(p) {
      if (p < 1 || p > this.totalPages) return;
      this.currentPage = p;
      this.$nextTick(() => {
        const content = this.$el.querySelector(".browser-content");
        if (content) content.scrollTop = 0;
      });
    },
    async loadScript(script) {
      this.loading = true;
      try {
        const res = await fetch("/" + script.file);
        const roles = await res.json();
        this.parseRoles(roles);
        this.toggleModal("scriptBrowser");
      } catch (e) {
        alert("加载剧本出错: " + e.message);
      } finally {
        this.loading = false;
      }
    },
    parseRoles(roles) {
      if (!roles || !roles.length) return;
      roles = roles.map(role =>
        typeof role === "string" ? { id: role } : role
      );
      const metaIndex = roles.findIndex(({ id }) => id === "_meta");
      let meta = {};
      if (metaIndex > -1) {
        meta = roles.splice(metaIndex, 1).pop();
      }
      this.$store.commit("setCustomRoles", roles);
      this.$store.commit(
        "setEdition",
        Object.assign({}, meta, { id: "custom" })
      );
      if (roles.some(role => this.$store.state.fabled.has(role.id || role))) {
        const fabled = [];
        roles.forEach(role => {
          if (this.$store.state.fabled.has(role.id || role)) {
            fabled.push(this.$store.state.fabled.get(role.id || role));
          }
        });
        this.$store.commit("players/setFabled", { fabled });
      }
    },
    ...mapMutations(["toggleModal"])
  }
};
</script>

<style scoped lang="scss">
.browser-header {
  padding: 8px 0;
  h3 {
    text-align: center;
    margin: 0 0 8px;
    font-family: PiratesBay, sans-serif;
    font-size: 120%;
  }
}

.search-bar {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 6px 14px;
  margin-bottom: 8px;
  svg {
    color: #999;
    margin-right: 8px;
    flex-shrink: 0;
  }
  input {
    flex: 1;
    background: none;
    border: none;
    color: #fff;
    font-size: 100%;
    outline: none;
    &::placeholder { color: #666; }
  }
  .clear-btn {
    cursor: pointer;
    color: #999;
    &:hover { color: #fff; }
  }
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 2px 0;
  .tab {
    display: inline-block;
    padding: 3px 9px;
    border-radius: 12px;
    font-size: 75%;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.08);
    color: #ccc;
    white-space: nowrap;
    transition: all 150ms;
    &:hover { background: rgba(255, 255, 255, 0.2); }
    &.active {
      background: rgba(200, 160, 80, 0.5);
      color: #fff;
    }
  }
}

.browser-content {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.results-info {
  text-align: center;
  color: #999;
  font-size: 75%;
  padding: 4px 0 6px;
}

.script-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding-bottom: 10px;
}

@media (max-width: 768px) {
  .script-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .script-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
}

.script-card {
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms;
  &:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(200, 160, 80, 0.4);
  }
}

.card-name {
  font-weight: bold;
  font-size: 85%;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
}

.card-author {
  font-size: 70%;
  color: #b0a080;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.card-players {
  font-size: 75%;
  color: #aaa;
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 6px;
  border-radius: 8px;
  white-space: nowrap;
  flex-shrink: 0;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  padding: 10px 0;
  position: sticky;
  bottom: 0;
  background: rgba(20, 20, 30, 0.95);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 80%;
  cursor: pointer;
  color: #ccc;
  background: rgba(255, 255, 255, 0.06);
  transition: all 150ms;
  user-select: none;
  &:hover:not(.disabled):not(.ellipsis) {
    background: rgba(255, 255, 255, 0.15);
  }
  &.active {
    background: rgba(200, 160, 80, 0.5);
    color: #fff;
    font-weight: bold;
  }
  &.disabled {
    color: #555;
    cursor: default;
  }
  &.ellipsis {
    cursor: default;
    background: none;
  }
}

.browser-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  color: #999;
  font-size: 110%;
}
</style>
