<template>
  <div id="controls">
    <span
      class="nomlog-summary"
      v-show="session.voteHistory.length && session.sessionId"
      @click="toggleModal('voteHistory')"
      :title="`${session.voteHistory.length} 次提名记录`"
    >
      <font-awesome-icon icon="book-dead" />
      {{ session.voteHistory.length }}
    </span>
    <span
      class="session"
      :class="{
        spectator: session.isSpectator,
        reconnecting: session.isReconnecting
      }"
      v-if="session.sessionId"
      @click="leaveSession"
      :title="
        session.isSpectator
          ? `房间内有 ${session.playerCount} 名玩家${session.ping ? ' (' + session.ping + 'ms 延迟)' : ''}`
          : `房间内还有其他 ${session.playerCount} 名玩家${session.ping ? ' (' + session.ping + 'ms 延迟)' : ''}`
      "
    >
      <font-awesome-icon icon="broadcast-tower" />
      {{ session.playerCount }}
    </span>
    <div class="menu" :class="{ open: grimoire.isMenuOpen }">
      <font-awesome-icon icon="cog" @click="toggleMenu" />
      <ul>
        <li class="tabs" :class="tab">
          <font-awesome-icon icon="book-open" @click="tab = 'grimoire'" />
          <font-awesome-icon
            icon="users"
            v-if="!session.isSpectator"
            @click="tab = 'players'"
          />
          <font-awesome-icon icon="theater-masks" @click="tab = 'characters'" />
          <font-awesome-icon icon="cog" @click="tab = 'settings'" />
        </li>

        <template v-if="tab === 'grimoire'">
          <li class="headline">游戏</li>
          <li @click="toggleNight" v-if="!session.isSpectator">
            <template v-if="!grimoire.isNight">进入夜晚</template>
            <template v-if="grimoire.isNight">进入白天</template>
            <em>[Q]</em>
          </li>
          <li @click="toggleModal('reference')" v-if="players.length">
            角色能力表
            <em>[R]</em>
          </li>
          <li @click="toggleModal('nightOrder')" v-if="players.length">
            夜晚顺序表
            <em>[N]</em>
          </li>
          <li
            v-if="session.voteHistory.length || !session.isSpectator"
            @click="toggleModal('voteHistory')"
          >
            投票记录
            <em>[V]</em>
          </li>
          <li @click="toggleGrimoire" v-if="players.length">
            <template v-if="!grimoire.isPublic">隐藏角色</template>
            <template v-if="grimoire.isPublic">显示角色</template>
            <em>[H]</em>
          </li>
          <li @click="hostSession" v-if="!session.isSpectator && !session.sessionId">
            创建小镇(说书人)
            <em>[C]</em>
          </li>
          <li @click="joinSession" v-if="!session.sessionId">
            加入小镇(玩家)
            <em>[J]</em>
          </li>
          <li @click="copySessionUrl" v-if="session.sessionId">
            复制玩家链接
            <em><font-awesome-icon icon="copy"/></em>
          </li>
          <li @click="leaveSession" v-if="session.sessionId">
            退出小镇
            <em>{{ session.sessionId }}</em>
          </li>
        </template>

        <template v-if="tab === 'players' && !session.isSpectator">
          <li class="headline">玩家</li>
          <li @click="addPlayer" v-if="players.length < 20">
            添加座位
            <em>[A]</em>
          </li>
          <li @click="randomizeSeatings" v-if="players.length > 2">
            随机座位
            <em><font-awesome-icon icon="dice"/></em>
          </li>
          <li @click="clearPlayers" v-if="players.length">
            移除座位
            <em><font-awesome-icon icon="trash-alt"/></em>
          </li>
        </template>

        <template v-if="tab === 'characters'">
          <li class="headline">角色</li>
          <li v-if="!session.isSpectator" @click="toggleModal('edition')">
            选择剧本
            <em>[P]</em>
          </li>
          <li
            @click="toggleModal('roles')"
            v-if="!session.isSpectator && players.length > 4"
          >
            分配角色
            <em>[O]</em>
          </li>
          <li v-if="!session.isSpectator" @click="distributeRoles">
            发送角色
            <em>[I]</em>
          </li>
          <li v-if="!session.isSpectator" @click="toggleModal('fabled')">
            传奇/奇遇角色
            <em>[L]</em>
          </li>
          <li @click="clearRoles" v-if="players.length">
            重置角色
          </li>
        </template>

        <template v-if="tab === 'settings'">
          <li class="headline">设置</li>
          <li v-if="session.sessionId && session.ping">
            主机延迟
            <em>{{ session.ping }}ms</em>
          </li>
          <li @click="toggleNightOrder" v-if="players.length">
            显示夜晚顺序
            <em>
              <font-awesome-icon
                :icon="[
                  'fas',
                  grimoire.isNightOrder ? 'check-square' : 'square'
                ]"
              />
            </em>
          </li>
          <li v-if="players.length">
            缩放
            <em>
              <font-awesome-icon
                @click="setZoom(grimoire.zoom - 1)"
                icon="search-minus"
              />
              {{ Math.round(100 + grimoire.zoom * 10) }}%
              <font-awesome-icon
                @click="setZoom(grimoire.zoom + 1)"
                icon="search-plus"
              />
            </em>
          </li>
          <li @click="toggleStatic">
            关闭动画
            <em
              ><font-awesome-icon
                :icon="['fas', grimoire.isStatic ? 'check-square' : 'square']"
            /></em>
          </li>
          <li @click="toggleMuted">
            静音
            <em
              ><font-awesome-icon
                :icon="['fas', grimoire.isMuted ? 'volume-mute' : 'volume-up']"
            /></em>
          </li>
          <li @click="setBackground">
            设置背景
            <em><font-awesome-icon icon="image"/></em>
          </li>
          <li>
            <a href="https://clocktower.gstonegames.com/guide/?type=2&bIsWM=" target="_blank">
              教程
            </a>
          </li>
          <li>
            <a href="https://clocktower.gstonegames.com/script_tool/" target="_blank">
              剧本工具
            </a>
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>

<script>
import { mapMutations, mapState } from "vuex";

export default {
  computed: {
    ...mapState(["grimoire", "session"]),
    ...mapState("players", ["players"])
  },
  data() {
    return {
      tab: "grimoire"
    };
  },
  methods: {
    setBackground() {
      const background = prompt("输入自定义背景图片URL");
      if (background || background === "") {
        this.$store.commit("setBackground", background);
      }
    },
    hostSession() {
      if (this.session.sessionId) return;
      const sessionIdRaw = prompt(
        "输入你想要加入的房间号码或名字，最多支持10个英文或数字字符",
        Math.round(Math.random() * 10000)
      );
      if (sessionIdRaw === null) return;
      const sessionId = sessionIdRaw
        .replace(/[^0-9a-zA-Z]/g, "")
        .substr(0, 10);
      if (!sessionId) {
        alert("房间号码不能为空，请输入有效的房间号码");
        return;
      }
      this.$store.commit("session/clearVoteHistory");
      this.$store.commit("session/setSpectator", false);
      this.$store.commit("session/setSessionId", sessionId);
      this.copySessionUrl();
    },
    copySessionUrl() {
      const url = window.location.href.split("#")[0];
      const link = url + "#" + this.session.sessionId;
      navigator.clipboard.writeText(link);
    },
    distributeRoles() {
      if (this.session.isSpectator) return;
      const popup = "是否要对所有坐下的玩家发送角色？";
      if (confirm(popup)) {
        this.$store.commit("session/distributeRoles", true);
        setTimeout(
          (() => {
            this.$store.commit("session/distributeRoles", false);
          }).bind(this),
          2000
        );
      }
    },
    joinSession() {
      if (this.session.sessionId) return this.leaveSession();
      this.$store.commit("toggleModal", "roomList");
    },
    leaveSession() {
      const sessionId = this.session.sessionId;
      if (confirm(`确定要退出小镇吗？\n房间号：${sessionId}`)) {
        this.$store.commit("session/setSpectator", false);
        this.$store.commit("session/setSessionId", "");
      }
    },
    addPlayer() {
      if (this.session.isSpectator) return;
      if (this.players.length >= 20) return;
      this.$store.commit("players/add", "空座位");
    },
    randomizeSeatings() {
      if (this.session.isSpectator) return;
      if (confirm("你确定要随机打乱座位吗？")) {
        this.$store.dispatch("players/randomize");
      }
    },
    clearPlayers() {
      if (this.session.isSpectator) return;
      if (confirm("你确定要移除所有座位吗？")) {
        if (this.session.nomination) {
          this.$store.commit("session/nomination");
        }
        this.$store.commit("players/clear");
      }
    },
    clearRoles() {
      if (confirm("你确定要移除所有角色和相关标记吗？")) {
        this.$store.dispatch("players/clearRoles");
      }
    },
    toggleNight() {
      this.$store.commit("toggleNight");
      if (this.grimoire.isNight) {
        this.$store.commit("session/setMarkedPlayer", -1);
      }
    },
    ...mapMutations([
      "toggleGrimoire",
      "toggleMenu",
      "toggleMuted",
      "toggleNightOrder",
      "toggleStatic",
      "setZoom",
      "toggleModal"
    ])
  }
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

@keyframes greenToWhite {
  from {
    color: green;
  }
  to {
    color: white;
  }
}

#controls {
  position: absolute;
  right: 3px;
  top: 3px;
  text-align: right;
  padding-right: 50px;
  z-index: 75;

  svg {
    filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));
    &.success {
      animation: greenToWhite 1s normal forwards;
      animation-iteration-count: 1;
    }
  }

  > span {
    display: inline-block;
    cursor: pointer;
    z-index: 5;
    margin-top: 7px;
    margin-left: 10px;
  }

  span.nomlog-summary {
    color: $townsfolk;
  }

  span.session {
    color: $demon;
    &.spectator {
      color: $townsfolk;
    }
    &.reconnecting {
      animation: blink 1s infinite;
    }
  }
}

@keyframes blink {
  50% {
    opacity: 0.5;
    color: gray;
  }
}

.menu {
  width: 240px;
  transform-origin: 220px 22px;
  transition: transform 500ms cubic-bezier(0.68, -0.55, 0.27, 1.55);
  transform: rotate(-90deg);
  position: absolute;
  right: 0;
  top: 0;

  &.open {
    transform: rotate(0deg);
  }

  > svg {
    cursor: pointer;
    background: rgba(0, 0, 0, 0.5);
    border: 3px solid black;
    width: 40px;
    height: 50px;
    margin-bottom: -8px;
    border-bottom: 0;
    border-radius: 10px 10px 0 0;
    padding: 5px 5px 15px;
  }

  a {
    color: white;
    text-decoration: none;
    &:hover {
      color: red;
    }
  }

  ul {
    display: flex;
    list-style-type: none;
    padding: 0;
    margin: 0;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 0 10px black;
    border: 3px solid black;
    border-radius: 10px 0 10px 10px;

    li {
      padding: 2px 5px;
      color: white;
      text-align: left;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 30px;
      white-space: nowrap;
      overflow: hidden;

      &.tabs {
        display: flex;
        padding: 0;
        svg {
          flex-grow: 1;
          flex-shrink: 0;
          height: 35px;
          border-bottom: 3px solid black;
          border-right: 3px solid black;
          padding: 5px 0;
          cursor: pointer;
          transition: color 250ms;
          &:hover {
            color: red;
          }
          &:last-child {
            border-right: 0;
          }
        }
        &.grimoire .fa-book-open,
        &.players .fa-users,
        &.characters .fa-theater-masks,
        &.session .fa-broadcast-tower,
        &.settings .fa-cog {
          background: linear-gradient(
            to bottom,
            $townsfolk 0%,
            rgba(0, 0, 0, 0.5) 100%
          );
        }
      }

      &:not(.headline):not(.tabs):hover {
        cursor: pointer;
        color: red;
      }

      em {
        flex-grow: 0;
        font-style: normal;
        margin-left: 10px;
        font-size: 80%;
      }
    }

    .headline {
      font-family: PiratesBay, sans-serif;
      letter-spacing: 1px;
      padding: 0 10px;
      text-align: center;
      justify-content: center;
      background: linear-gradient(
        to right,
        $townsfolk 0%,
        rgba(0, 0, 0, 0.5) 20%,
        rgba(0, 0, 0, 0.5) 80%,
        $demon 100%
      );
    }
  }
}
</style>
