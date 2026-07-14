<template>
  <Modal
    class="script-browser"
    v-if="modals.scriptBrowser"
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
        />
        <span v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">
          <font-awesome-icon icon="times" />
        </span>
      </div>
      <div class="category-tabs">
        <span
          class="tab"
          :class="{ active: selectedCategory === '' }"
          @click="selectedCategory = ''"
        >全部</span>
        <span
          v-for="cat in categories"
          :key="cat"
          class="tab"
          :class="{ active: selectedCategory === cat }"
          @click="selectedCategory = cat"
        >{{ cat }}</span>
      </div>
    </div>

    <div class="browser-content" v-if="!loading">
      <div class="results-info">
        共 {{ filteredScripts.length }} 个剧本
      </div>
      <div class="script-grid">
        <div
          v-for="script in filteredScripts"
          :key="script.file"
          class="script-card"
          @click="loadScript(script)"
        >
          <div class="card-logo" v-if="script.logo">
            <img :src="script.logo" :alt="script.name" @error="e => e.target.style.display='none'" />
          </div>
          <div class="card-logo placeholder" v-else>
            <font-awesome-icon icon="book-open" />
          </div>
          <div class="card-info">
            <div class="card-name">{{ script.name }}</div>
            <div class="card-author" v-if="script.author">{{ script.author }}</div>
            <div class="card-category">{{ script.category }}</div>
            <div class="card-stats">
              <span class="team-count" v-if="script.teams.townsfolk" title="镇民">
                <span class="dot townsfolk"></span>{{ script.teams.townsfolk }}
              </span>
              <span class="team-count" v-if="script.teams.outsider" title="外来者">
                <span class="dot outsider"></span>{{ script.teams.outsider }}
              </span>
              <span class="team-count" v-if="script.teams.minion" title="爪牙">
                <span class="dot minion"></span>{{ script.teams.minion }}
              </span>
              <span class="team-count" v-if="script.teams.demon" title="恶魔">
                <span class="dot demon"></span>{{ script.teams.demon }}
              </span>
              <span class="team-count" v-if="script.teams.traveler" title="旅行者">
                <span class="dot traveler"></span>{{ script.teams.traveler }}
              </span>
              <span class="total-count">共{{ script.total }}角色</span>
            </div>
            <div class="card-desc" v-if="script.description">{{ script.description }}</div>
          </div>
        </div>
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

export default {
  components: { Modal },
  data() {
    return {
      scripts: [],
      searchQuery: "",
      selectedCategory: "",
      categories: [],
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
            s.description.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q)
        );
      }
      return result;
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
  padding: 10px 0;
  h3 {
    text-align: center;
    margin: 0 0 10px;
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
  margin-bottom: 10px;
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
    &::placeholder {
      color: #666;
    }
  }
  .clear-btn {
    cursor: pointer;
    color: #999;
    &:hover {
      color: #fff;
    }
  }
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 60px;
  overflow-y: auto;
  padding: 4px 0;
  .tab {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 80%;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.08);
    color: #ccc;
    white-space: nowrap;
    transition: all 150ms;
    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
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
  font-size: 80%;
  padding: 4px 0 8px;
}

.script-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  padding-bottom: 10px;
}

.script-card {
  display: flex;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 200ms;
  &:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(200, 160, 80, 0.4);
    transform: translateY(-1px);
  }
}

.card-logo {
  width: 80px;
  min-height: 80px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  &.placeholder {
    font-size: 24px;
    color: #555;
  }
}

.card-info {
  flex: 1;
  padding: 8px 10px;
  min-width: 0;
}

.card-name {
  font-weight: bold;
  font-size: 95%;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-author {
  font-size: 75%;
  color: #b0a080;
  margin-bottom: 2px;
}

.card-category {
  font-size: 70%;
  color: #888;
  margin-bottom: 4px;
}

.card-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 75%;
  margin-bottom: 4px;
}

.team-count {
  display: flex;
  align-items: center;
  gap: 2px;
  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    &.townsfolk { background: #3b82f6; }
    &.outsider { background: #22c55e; }
    &.minion { background: #f59e0b; }
    &.demon { background: #ef4444; }
    &.traveler { background: #a855f7; }
  }
}

.total-count {
  color: #999;
}

.card-desc {
  font-size: 70%;
  color: #999;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
