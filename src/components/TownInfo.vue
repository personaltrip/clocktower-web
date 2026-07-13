<template>
  <div class="town-info">
    <!-- 中间：剧本logo和名字 -->
    <div class="edition-center">
      <div
        class="edition-logo"
        :class="['edition-' + edition.id]"
        :style="{
          backgroundImage: `url(${
            edition.logo && grimoire.isImageOptIn
              ? edition.logo
              : require('../assets/editions/' + edition.id + '.png')
          })`
        }"
      ></div>
      <div class="edition-name" v-if="!edition.isOfficial">
        {{ edition.name }}
        <span v-if="edition.author">{{ edition.author }}</span>
      </div>
      <div v-if="players.length - teams.traveler < 5" class="warning-text">
        请添加更多玩家！
      </div>
    </div>

    <!-- 左上角：玩家人数和角色分配 -->
    <ul class="stats" v-if="players.length">
      <li>
        <span>
          {{ players.length }} <font-awesome-icon class="players" icon="users" />
        </span>
        <span>
          {{ teams.alive }}
          <font-awesome-icon class="alive" icon="heartbeat" />
        </span>
        <span>
          {{ teams.votes }} <font-awesome-icon class="votes" icon="vote-yea" />
        </span>
        <span>
          <template v-if="grimoire.isNight">
            夜晚 <font-awesome-icon :icon="['fas', 'cloud-moon']" />
          </template>
          <template v-else>
            白天 <font-awesome-icon :icon="['fas', 'sun']" />
          </template>
        </span>
      </li>
      <li v-if="players.length - teams.traveler >= 5">
        <span>
          {{ teams.townsfolk }}
          <font-awesome-icon class="townsfolk" icon="user-friends" />
        </span>
        <span>
          {{ teams.outsider }}
          <font-awesome-icon
            class="outsider"
            :icon="teams.outsider > 1 ? 'user-friends' : 'user'"
          />
        </span>
        <span>
          {{ teams.minion }}
          <font-awesome-icon
            class="minion"
            :icon="teams.minion > 1 ? 'user-friends' : 'user'"
          />
        </span>
        <span>
          {{ teams.demon }}
          <font-awesome-icon
            class="demon"
            :icon="teams.demon > 1 ? 'user-friends' : 'user'"
          />
        </span>
        <span v-if="teams.traveler">
          {{ teams.traveler }}
          <font-awesome-icon
            class="traveler"
            :icon="teams.traveler > 1 ? 'user-friends' : 'user'"
          />
        </span>
      </li>
    </ul>
  </div>
</template>

<script>
import gameJSON from "./../game";
import { mapState } from "vuex";

export default {
  computed: {
    teams: function() {
      const { players } = this.$store.state.players;
      const nonTravelers = this.$store.getters["players/nonTravelers"];
      const alive = players.filter(player => player.isDead !== true).length;
      return {
        ...gameJSON[nonTravelers - 5],
        traveler: players.length - nonTravelers,
        alive,
        votes:
          alive +
          players.filter(
            player => player.isDead === true && player.isVoteless !== true
          ).length
      };
    },
    ...mapState(["edition", "grimoire"]),
    ...mapState("players", ["players"])
  }
};
</script>

<style lang="scss" scoped>
@import "../vars.scss";

.town-info {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* 居中：剧本logo和名字 */
.edition-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20%;
  pointer-events: none;
}

.edition-logo {
  width: 220px;
  height: 200px;
  max-width: 100%;
  background-position: center center;
  background-repeat: no-repeat;
  background-size: contain;
}

.edition-name {
  font-family: PiratesBay, sans-serif;
  text-align: center;
  text-shadow: 0 2px 4px black;
  margin-top: 5px;
  font-size: 110%;
  span {
    display: block;
    font-family: "Roboto Condensed", sans-serif;
    font-size: 70%;
    opacity: 0.7;
  }
}

.warning-text {
  font-weight: bold;
  text-shadow: 0 2px 4px black;
  margin-top: 10px;
  color: #ff4a50;
}

/* 左上角：玩家统计 */
.stats {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid black;
  border-radius: 8px;
  pointer-events: none;
  list-style: none;
  margin: 0;

  li {
    font-weight: bold;
    display: flex;
    gap: 10px;
    font-size: 90%;
    text-shadow: 0 2px 1px black, 0 -2px 1px black, 2px 0 1px black,
      -2px 0 1px black;

    span {
      white-space: nowrap;
    }

    svg {
      margin-right: 3px;
    }

    .players { color: #00f700; }
    .alive { color: #ff4a50; }
    .votes { color: #fff; }
    .townsfolk { color: $townsfolk; }
    .outsider { color: $outsider; }
    .minion { color: $minion; }
    .demon { color: $demon; }
    .traveler { color: $traveler; }
  }
}
</style>
