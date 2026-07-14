const NEWPLAYER = {
  name: "",
  id: "",
  role: {},
  reminders: [],
  isVoteless: false,
  isDead: false,
  pronouns: "",
  bluffs: []
};

const state = () => ({
  players: [],
  fabled: [],
  bluffs: []
});

const getters = {
  alive({ players }) {
    return players.filter(player => !player.isDead).length;
  },
  nonTravelers({ players }) {
    const nonTravelers = players.filter(
      player => player.role.team !== "traveler"
    );
    return Math.min(nonTravelers.length, 15);
  },
  // calculate a Map of player => night order
  nightOrder({ players, fabled }) {
    const firstNight = [0];
    const otherNight = [0];
    players.forEach(({ role }) => {
      if (role.firstNight && !firstNight.includes(role.firstNight)) {
        firstNight.push(role.firstNight);
      }
      if (role.otherNight && !otherNight.includes(role.otherNight)) {
        otherNight.push(role.otherNight);
      }
    });
    fabled.forEach(role => {
      if (role.firstNight && !firstNight.includes(role.firstNight)) {
        firstNight.push(role.firstNight);
      }
      if (role.otherNight && !otherNight.includes(role.otherNight)) {
        otherNight.push(role.otherNight);
      }
    });
    firstNight.sort((a, b) => a - b);
    otherNight.sort((a, b) => a - b);
    const nightOrder = new Map();
    players.forEach(player => {
      const first = Math.max(firstNight.indexOf(player.role.firstNight), 0);
      const other = Math.max(otherNight.indexOf(player.role.otherNight), 0);
      nightOrder.set(player, { first, other });
    });
    fabled.forEach(role => {
      const first = Math.max(firstNight.indexOf(role.firstNight), 0);
      const other = Math.max(otherNight.indexOf(role.otherNight), 0);
      nightOrder.set(role, { first, other });
    });
    return nightOrder;
  }
};

const actions = {
  randomize({ state, commit }) {
    const players = state.players
      .map(a => [Math.random(), a])
      .sort((a, b) => a[0] - b[0])
      .map(a => a[1]);
    commit("set", players);
  },
  clearRoles({ state, commit, rootState }) {
    let players;
    if (rootState.session.isSpectator) {
      players = state.players.map(player => {
        if (player.role.team !== "traveler") {
          player.role = {};
        }
        player.reminders = [];
        return player;
      });
    } else {
      players = state.players.map(({ name, id, pronouns }) => ({
        ...NEWPLAYER,
        name,
        id,
        pronouns
      }));
      commit("setFabled", { fabled: [] });
    }
    commit("set", players);
    commit("setBluff");
  }
};

const mutations = {
  clear(state) {
    state.players = [];
    state.bluffs = [];
    state.fabled = [];
  },
  set(state, players = []) {
    state.players = players;
  },
  /**
  The update mutation also has a property for isFromSockets
  this property can be addded to payload object for any mutations
  then can be used to prevent infinite loops when a property is
  able to be set from multiple different session on websockets.
  An example of this is in the sendPlayerPronouns and _updatePlayerPronouns
  in socket.js.
   */
  update(state, { player, property, value }) {
    const index = state.players.indexOf(player);
    if (index >= 0) {
      if (property === "id") {
        console.log("[players/update] id commit: index=", index, "value=", JSON.stringify(value), "stack=", new Error().stack.split('\n').slice(1,8).join('\n'));
      }
      state.players[index][property] = value;
    }
  },
  /**
   * 从服务器 gamestate 合并数据到本地玩家。
   * 保留本地角色（非旅行者）、笔记、提醒等，仅同步座位/死亡/旅行者角色。
   */
  syncGamestate(state, { gamestate, roles, rolesJSONbyId, claimedSeat }) {
    console.log("[syncGamestate] called: gamestate.length=", gamestate.length, "currentPlayers.length=", state.players.length, "claimedSeat=", claimedSeat);
    console.log("[syncGamestate] gamestate ids:", gamestate.map(gs => gs.id));
    // 调整玩家数量
    while (state.players.length < gamestate.length) {
      state.players.push({ ...NEWPLAYER });
    }
    if (state.players.length > gamestate.length) {
      state.players.length = gamestate.length;
    }
    gamestate.forEach((gs, i) => {
      const player = state.players[i];
      if (!player) return;
      player.name = gs.name;
      // 座位信息：跳过自己已占的座位（防止竞态）
      if (i !== claimedSeat) {
        player.id = gs.id || "";
      }
      player.isDead = !!gs.isDead;
      player.isVoteless = !!gs.isVoteless;
      player.pronouns = gs.pronouns || "";
      // 旅行者角色：以服务器为准；非旅行者：保留本地设置
      if (gs.roleId) {
        const role = roles.get(gs.roleId) || rolesJSONbyId.get(gs.roleId);
        if (role) player.role = role;
      } else if (player.role && player.role.team === "traveler") {
        player.role = {};
      }
      // reminders 不从 gamestate 覆盖，保留本地数据
    });
  },
  add(state, name) {
    state.players.push({
      ...NEWPLAYER,
      name
    });
  },
  remove(state, index) {
    state.players.splice(index, 1);
  },
  swap(state, [from, to]) {
    [state.players[from], state.players[to]] = [
      state.players[to],
      state.players[from]
    ];
    // hack: "modify" the array so that Vue notices something changed
    state.players.splice(0, 0);
  },
  move(state, [from, to]) {
    state.players.splice(to, 0, state.players.splice(from, 1)[0]);
  },
  setBluff(state, { index, role } = {}) {
    if (index !== undefined) {
      state.bluffs.splice(index, 1, role);
    } else {
      state.bluffs = [];
    }
  },
  setFabled(state, { index, fabled } = {}) {
    if (index !== undefined) {
      state.fabled.splice(index, 1);
    } else if (fabled) {
      if (!Array.isArray(fabled)) {
        state.fabled.push(fabled);
      } else {
        state.fabled = fabled;
      }
    }
  }
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
};
