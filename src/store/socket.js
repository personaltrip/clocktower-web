class LiveSession {
  constructor(store) {
    this._socket = null;
    this._isSpectator = true;
    this._gamestate = [];
    this._store = store;
    this._pingInterval = 30 * 1000; // 30 seconds between pings
    this._pingTimer = null;
    this._reconnectTimer = null;
    this._gamestateTimeout = null; // timeout for initial gamestate when joining
    this._gamestateReceived = false; // track if gamestate was received for current session
    this._players = {}; // map of players connected to a session
    this._pings = {}; // map of player IDs to ping
    this._messageQueue = []; // queue for messages sent before socket is open
    this._savedPlayerRoles = null; // saved player roles before connect() clears them
    // 切屏恢复时立即检测连接状态，避免等待浏览器缓慢发现死连接
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this._checkConnectionOnResume();
      }
    });
    // reconnect to previous session
    if (this._store.state.session.sessionId) {
      this.connect(this._store.state.session.sessionId, true);
    }
  }

  /**
   * 获取 WebSocket 服务器基础 URL
   * 使用浏览器当前连接的 hostname，自动适配局域网场景
   */
  _getWsBaseUrl() {
    if (process.env.VUE_APP_WS_URL) {
      return process.env.VUE_APP_WS_URL;
    }
    if (process.env.NODE_ENV === "development") {
      // 开发模式：WebSocket 服务器独立运行在 8081 端口
      // 使用浏览器当前的 hostname（即用户访问页面所用的 IP/域名）
      const host = window.location.hostname || "localhost";
      const url = `ws://${host}:8081/`;
      console.log("[WS] hostname:", window.location.hostname, "→ wsUrl:", url);
      return url;
    }
    // 生产模式：WebSocket 与 HTTP 同源同端口
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/`;
  }

  /**
   * Open a new session for the passed channel.
   * @param channel
   * @private
   */
  _open(channel, browsing = false) {
    this.disconnect();
    const wsBaseUrl = this._getWsBaseUrl();
    const socket = new WebSocket(
      wsBaseUrl +
        channel +
        "/" +
        (this._isSpectator ? this._store.state.session.playerId : "host")
    );
    this._socket = socket;
    socket.addEventListener("message", this._handleMessage.bind(this));
    socket.onopen = () => {
      if (this._socket !== socket) return;
      this._store.commit("session/setConnectError", "");
      this._onOpen(browsing);
    };
    socket.onerror = () => {
      if (this._socket !== socket) return;
      // 连接失败不清空缓存，保留本地数据供用户查看
      this._store.commit("session/setConnectError", "连接失败");
    };
    socket.onclose = err => {
      // 已有新连接（重连场景），旧 socket 的 close 事件直接忽略
      if (this._socket !== null && this._socket !== socket) return;
      this._socket = null;
      clearInterval(this._pingTimer);
      this._pingTimer = null;
      if (err.code !== 1000) {
        // 连接中断，不清空缓存，尝试重连
        this._store.commit("session/setReconnecting", true);
        this._reconnectTimer = setTimeout(
          () => this.connect(channel),
          3 * 1000
        );
      } else if (!this._store.state.session.sessionId) {
        // 只有用户主动退出时（sessionId 已被 subscriber 清空）才处理 1000
        if (err.reason) alert(err.reason);
      }
    };
  }

  /**
   * Send a message through the socket.
   * @param command
   * @param params
   * @private
   */
  _send(command, params) {
    if (this._socket && this._socket.readyState === 1) {
      this._socket.send(JSON.stringify([command, params]));
      console.log("[WS] sent:", command);
    } else if (this._socket) {
      // socket 尚未 OPEN（CONNECTING 状态），暂存到队列，onopen 时发出
      console.log("[WS] queue:", command, "(socket readyState =", this._socket.readyState + ")");
      this._messageQueue.push([command, params]);
    } else {
      console.warn("[WS] drop:", command, "(socket is null)");
    }
  }

  /**
   * Flush queued messages that were sent before the socket was open.
   * Called after _onOpen sends the initial getGamestate/hostReconnect.
   */
  _flushQueue() {
    if (this._messageQueue.length) {
      console.log("[WS] flush queue:", this._messageQueue.length, "messages");
    }
    while (this._messageQueue.length) {
      const [command, params] = this._messageQueue.shift();
      this._socket.send(JSON.stringify([command, params]));
    }
  }

  /**
   * Send a message directly to a single playerId, if provided.
   * Otherwise broadcast it.
   * @param playerId player ID or "host", optional
   * @param command
   * @param params
   * @private
   */
  _sendDirect(playerId, command, params) {
    if (playerId) {
      this._send("direct", { [playerId]: [command, params] });
    } else {
      this._send(command, params);
    }
  }

  /**
   * Open event handler for socket.
   * @private
   */
  _onOpen(browsing = false) {
    if (this._isSpectator) {
      if (!browsing) {
        // send getGamestate directly to the host
        this._sendDirect("host", "getGamestate", this._store.state.session.playerId);
        // 刷新连接建立前暂存的消息队列（如坐下 claim）
        this._flushQueue();
      }
    } else {
      this.sendGamestate();
      // 刷新队列
      this._flushQueue();
    }
    this._ping();
  }

  /**
   * Send a ping message with player ID and ST flag.
   * @private
   */
  _ping() {
    this._handlePing();
    this._send("ping", [
      this._isSpectator
        ? this._store.state.session.playerId
        : Object.keys(this._players).length,
      "latency"
    ]);
    clearTimeout(this._pingTimer);
    this._pingTimer = setTimeout(this._ping.bind(this), this._pingInterval);
  }

  /**
   * Handle an incoming socket message.
   * @param data
   * @private
   */
  _handleMessage({ data }) {
    let command, params;
    try {
      [command, params] = JSON.parse(data);
    } catch (err) {
      console.log("unsupported socket message", data);
    }
    switch (command) {
      case "getGamestate":
        this.sendGamestate(params);
        break;
      case "edition":
        this._updateEdition(params);
        break;
      case "fabled":
        this._updateFabled(params);
        break;
      case "gs":
        this._updateGamestate(params);
        break;
      case "player":
        this._updatePlayer(params);
        break;
      case "claim":
        this._updateSeat(params);
        break;
      case "ping":
        this._handlePing(params);
        break;
      case "nomination":
        if (!this._isSpectator) return;
        if (!params) {
          // create vote history record
          this._store.commit(
            "session/addHistory",
            this._store.state.players.players
          );
        }
        this._store.commit("session/nomination", { nomination: params });
        break;
      case "swap":
        if (!this._isSpectator) return;
        this._store.commit("players/swap", params);
        break;
      case "move":
        if (!this._isSpectator) return;
        this._store.commit("players/move", params);
        break;
      case "remove":
        if (!this._isSpectator) return;
        this._store.commit("players/remove", params);
        break;
      case "marked":
        if (!this._isSpectator) return;
        this._store.commit("session/setMarkedPlayer", params);
        break;
      case "isNight":
        if (!this._isSpectator) return;
        this._store.commit("toggleNight", params);
        break;
      case "isVoteHistoryAllowed":
        if (!this._isSpectator) return;
        this._store.commit("session/setVoteHistoryAllowed", params);
        this._store.commit("session/clearVoteHistory");
        break;
      case "votingSpeed":
        if (!this._isSpectator) return;
        this._store.commit("session/setVotingSpeed", params);
        break;
      case "clearVoteHistory":
        if (!this._isSpectator) return;
        this._store.commit("session/clearVoteHistory");
        break;
      case "isVoteInProgress":
        if (!this._isSpectator) return;
        this._store.commit("session/setVoteInProgress", params);
        break;
      case "vote":
        this._handleVote(params);
        break;
      case "lock":
        this._handleLock(params);
        break;
      case "bye":
        this._handleBye(params);
        break;
      case "pronouns":
        this._updatePlayerPronouns(params);
        break;
      case "sessionDestroy":
        this._handleSessionDestroy();
        break;
      case "playerCount":
        // 服务器主动推送的 playerCount 更新
        this._store.commit("session/setPlayerCount", params);
        break;
    }
  }

  /**
   * Handle session destruction by the storyteller.
   * Disconnect the spectator and clear session data.
   */
  _handleSessionDestroy() {
    clearTimeout(this._gamestateTimeout);
    this._gamestateTimeout = null;
    this._store.commit("session/distributeRoles", false);
    this._store.commit("session/setSessionId", "");
    this.disconnect();
    alert("说书人已退出，房间已销毁");
  }

  /**
   * Connect to a new live session, either as host or spectator.
   * Set a unique playerId if there isn't one yet.
   * @param channel
   * @param isReconnect true when restoring from localStorage (page refresh), skips clearing players
   */
  connect(channel, isReconnect = false) {
    const browsing = channel === "browsing";
    if (!this._store.state.session.playerId) {
      this._store.commit(
        "session/setPlayerId",
        Math.random()
          .toString(36)
          .substr(2)
      );
    }
    this._pings = {};
    this._gamestateReceived = false;
    this._messageQueue = []; // clear stale queued messages
    this._store.commit("session/setPlayerCount", 0);
    this._store.commit("session/setPing", 0);
    this._isSpectator = this._store.state.session.isSpectator;
    // 非重连时清空玩家数据（进入新房间），重连时保留（刷新页面）
    if (this._isSpectator && !browsing && !isReconnect) {
      this._savedPlayerRoles = null; // 进入新房间，丢弃旧房间的角色缓存
      this._store.commit("players/set", []);
      this._store.commit("players/setBluff");
      this._store.commit("players/setFabled");
    }
    this._open(channel, browsing);
  }

  /**
   * 切屏恢复时检查 WebSocket 连接状态。
   * 移动端浏览器在后台时会冻结 WebSocket，回到前台后可能需要数秒才能检测到连接已死。
   * 此方法主动检测并立即重连，避免用户看到"房间号不存在"的错误。
   */
  _checkConnectionOnResume() {
    if (!this._store.state.session.sessionId) return;
    clearTimeout(this._reconnectTimer);
    // socket 不存在或不在 OPEN 状态 → 连接已死，立即重连
    if (!this._socket || this._socket.readyState !== WebSocket.OPEN) {
      this._socket = null;
      this.connect(this._store.state.session.sessionId);
    } else {
      // socket 显示 OPEN，发一次 ping 验证连接是否真正存活
      try {
        this._socket.send(JSON.stringify(["ping", [this._store.state.session.playerId, "latency"]]));
      } catch (e) {
        // 发送失败说明连接已死
        this._socket = null;
        this.connect(this._store.state.session.sessionId);
      }
    }
  }

  /**
   * Close the current session, if any.
   */
  disconnect() {
    this._pings = {};
    this._messageQueue = [];
    clearTimeout(this._gamestateTimeout);
    this._gamestateTimeout = null;
    this._store.commit("session/setPlayerCount", 0);
    this._store.commit("session/setPing", 0);
    this._store.commit("session/setReconnecting", false);
    clearTimeout(this._reconnectTimer);
    if (this._socket) {
      if (this._isSpectator) {
        this._sendDirect("host", "bye", this._store.state.session.playerId);
      }
      this._socket.close(1000);
      this._socket = null;
    }
  }

  /**
   * Publish the current gamestate.
   * Optional param to reduce traffic. (send only player data)
   * @param playerId
   * @param isLightweight
   */
  sendGamestate(playerId = "", isLightweight = false) {
    if (this._isSpectator) return;
    this._gamestate = this._store.state.players.players.map(player => ({
      name: player.name,
      id: player.id,
      isDead: player.isDead,
      isVoteless: player.isVoteless,
      pronouns: player.pronouns,
      ...(player.role && player.role.team === "traveler"
        ? { roleId: player.role.id }
        : {})
    }));
    if (isLightweight) {
      this._sendDirect(playerId, "gs", {
        gamestate: this._gamestate,
        isLightweight
      });
    } else {
      const { session, grimoire } = this._store.state;
      const { fabled } = this._store.state.players;
      this.sendEdition(playerId);
      this._sendDirect(playerId, "gs", {
        gamestate: this._gamestate,
        isNight: grimoire.isNight,
        isVoteHistoryAllowed: session.isVoteHistoryAllowed,
        nomination: session.nomination,
        votingSpeed: session.votingSpeed,
        lockedVote: session.lockedVote,
        isVoteInProgress: session.isVoteInProgress,
        markedPlayer: session.markedPlayer,
        fabled: fabled.map(f => (f.isCustom ? f : { id: f.id })),
        ...(session.nomination ? { votes: session.votes } : {})
      });
    }
  }

  /**
   * Update the gamestate based on incoming data.
   * @param data
   * @private
   */
  _updateGamestate(data) {
    if (!this._isSpectator) return;
    this._gamestateReceived = true;
    // clear the join timeout since we received a gamestate
    if (this._gamestateTimeout) {
      clearTimeout(this._gamestateTimeout);
      this._gamestateTimeout = null;
    }
    const {
      gamestate,
      isLightweight,
      isNight,
      isVoteHistoryAllowed,
      nomination,
      votingSpeed,
      votes,
      lockedVote,
      isVoteInProgress,
      markedPlayer,
      fabled
    } = data;
    // for full gamestate with players, merge server data into local players
    // 不清空本地角色/提醒等数据，仅同步座位/死亡/旅行者角色
    if (!isLightweight && gamestate.length) {
      this._savedPlayerRoles = null;
      this._store.commit("players/syncGamestate", {
        gamestate,
        roles: this._store.state.roles,
        rolesJSONbyId: this._store.getters.rolesJSONbyId,
        claimedSeat: this._store.state.session.claimedSeat
      });
    }
    const players = this._store.state.players.players;
    // adjust number of players (lightweight only, full already synced above)
    if (isLightweight) {
      if (players.length < gamestate.length) {
        for (let x = players.length; x < gamestate.length; x++) {
          this._store.commit("players/add", gamestate[x].name);
        }
      } else if (players.length > gamestate.length) {
        for (let x = players.length; x > gamestate.length; x--) {
          this._store.commit("players/remove", x - 1);
        }
      }
      // lightweight: sync id/death from server for existing players
      gamestate.forEach((gs, x) => {
        const player = players[x];
        if (!player) return;
        if (x !== this._store.state.session.claimedSeat) {
          player.id = gs.id || "";
        }
        player.isDead = !!gs.isDead;
        player.isVoteless = !!gs.isVoteless;
      });
    }
    if (!isLightweight) {
      this._store.commit("toggleNight", !!isNight);
      this._store.commit("session/setVoteHistoryAllowed", isVoteHistoryAllowed);
      this._store.commit("session/nomination", {
        nomination,
        votes,
        votingSpeed,
        lockedVote,
        isVoteInProgress
      });
      this._store.commit("session/setMarkedPlayer", markedPlayer);
      this._store.commit("players/setFabled", {
        fabled: fabled.map(f => this._store.state.fabled.get(f.id) || f)
      });
    }
  }

  /**
   * Publish an edition update. ST only
   * @param playerId
   */
  sendEdition(playerId = "") {
    if (this._isSpectator) return;
    const { edition } = this._store.state;
    let roles;
    if (!edition.isOfficial) {
      roles = this._store.getters.customRolesStripped;
    }
    this._sendDirect(playerId, "edition", {
      edition: edition.isOfficial ? { id: edition.id } : edition,
      ...(roles ? { roles } : {})
    });
  }

  /**
   * Update edition and roles for custom editions.
   * @param edition
   * @param roles
   * @private
   */
  _updateEdition({ edition, roles }) {
    if (!this._isSpectator) return;
    this._store.commit("setEdition", edition);
    if (roles) {
      this._store.commit("setCustomRoles", roles);
      if (this._store.state.roles.size !== roles.length) {
        const missing = [];
        roles.forEach(({ id }) => {
          if (!this._store.state.roles.get(id)) {
            missing.push(id);
          }
        });
        alert(
          `This session contains custom characters that can't be found. ` +
            `Please load them before joining! ` +
            `Missing roles: ${missing.join(", ")}`
        );
        this.disconnect();
        this._store.commit("toggleModal", "edition");
      }
    }
  }

  /**
   * Publish a fabled update. ST only
   */
  sendFabled() {
    if (this._isSpectator) return;
    const { fabled } = this._store.state.players;
    this._send(
      "fabled",
      fabled.map(f => (f.isCustom ? f : { id: f.id }))
    );
  }

  /**
   * Update fabled roles.
   * @param fabled
   * @private
   */
  _updateFabled(fabled) {
    if (!this._isSpectator) return;
    this._store.commit("players/setFabled", {
      fabled: fabled.map(f => this._store.state.fabled.get(f.id) || f)
    });
  }

  /**
   * Publish a player update.
   * @param player
   * @param property
   * @param value
   */
  sendPlayer({ player, property, value }) {
    if (this._isSpectator || property === "reminders") return;
    const index = this._store.state.players.players.indexOf(player);
    if (property === "role") {
      if (value.team && value.team === "traveler") {
        // update local gamestate to remember this player as a traveler
        this._gamestate[index].roleId = value.id;
        this._send("player", {
          index,
          property,
          value: value.id
        });
      } else if (this._gamestate[index].roleId) {
        // player was previously a traveler
        delete this._gamestate[index].roleId;
        this._send("player", { index, property, value: "" });
      }
    } else {
      this._send("player", { index, property, value });
    }
  }

  /**
   * Update a player based on incoming data. Player only.
   * @param index
   * @param property
   * @param value
   * @private
   */
  _updatePlayer({ index, property, value }) {
    const player = this._store.state.players.players[index];
    if (!player) return;
    if (property === "role") {
      // 角色更新对观众和恶魔都生效（恶魔需要接收自己的伪装）
      let roleId;
      let bluffs;
      if (typeof value === "object" && value !== null) {
        roleId = value.id;
        bluffs = value.bluffs;
      } else {
        roleId = value;
      }
      if (!roleId && player.role.team === "traveler") {
        this._store.commit("players/update", {
          player,
          property: "role",
          value: {}
        });
      } else if (roleId) {
        const role =
          this._store.state.roles.get(roleId) ||
          this._store.getters.rolesJSONbyId.get(roleId) ||
          {};
        this._store.commit("players/update", {
          player,
          property: "role",
          value: role
        });
        if (bluffs && Array.isArray(bluffs)) {
          player.bluffs = bluffs.map(
            id =>
              this._store.state.roles.get(id) ||
              this._store.getters.rolesJSONbyId.get(id) ||
              { id }
          );
        }
      }
    } else if (this._isSpectator) {
      // 非角色属性只有观众需要处理
      this._store.commit("players/update", { player, property, value });
    }
  }

  /**
   * Publish a player pronouns update
   * @param player
   * @param value
   * @param isFromSockets
   */
  sendPlayerPronouns({ player, value, isFromSockets }) {
    //send pronoun only for the seated player or storyteller
    //Do not re-send pronoun data for an update that was recieved from the sockets layer
    if (
      isFromSockets ||
      (this._isSpectator && this._store.state.session.playerId !== player.id)
    )
      return;
    const index = this._store.state.players.players.indexOf(player);
    this._send("pronouns", [index, value]);
  }

  /**
   * Update a pronouns based on incoming data.
   * @param index
   * @param value
   * @private
   */
  _updatePlayerPronouns([index, value]) {
    const player = this._store.state.players.players[index];

    this._store.commit("players/update", {
      player,
      property: "pronouns",
      value,
      isFromSockets: true
    });
  }

  /**
   * Handle a ping message by another player / storyteller
   * Protocol: host sends numeric player count, spectator sends UUID string.
   * @param playerIdOrCount - number (from host) or UUID string (from spectator)
   * @param latency
   * @private
   */
  _handlePing([playerIdOrCount = 0, latency] = []) {
    const now = new Date().getTime();
    if (!this._isSpectator) {
      // remove players that haven't sent a ping in twice the timespan
      for (let player in this._players) {
        if (now - this._players[player] > this._pingInterval * 8) {
          delete this._players[player];
          delete this._pings[player];
        }
      }
      // remove claimed seats from players that are no longer connected
      this._store.state.players.players.forEach(player => {
        if (player.id && !this._players[player.id]) {
          this._store.commit("players/update", {
            player,
            property: "id",
            value: ""
          });
        }
      });
      // store new player data — only accept UUID strings, not numeric counts
      if (playerIdOrCount && typeof playerIdOrCount === "string") {
        this._players[playerIdOrCount] = now;
        const ping = parseInt(latency, 10);
        if (ping && ping > 0 && ping < 30 * 1000) {
          // ping to Players
          this._pings[playerIdOrCount] = ping;
          const pings = Object.values(this._pings);
          this._store.commit(
            "session/setPing",
            Math.round(pings.reduce((a, b) => a + b, 0) / pings.length)
          );
        }
      }
      // host always updates its own player count from _players map
      // 但如果服务器推送了 playerCount，优先使用服务器的值
      const serverPlayerCount = this._store.state.session.playerCount;
      const localPlayerCount = Object.keys(this._players).length;
      this._store.commit(
        "session/setPlayerCount",
        Math.max(serverPlayerCount, localPlayerCount)
      );
    } else if (latency) {
      // ping response to spectator — latency is always valid
      this._store.commit("session/setPing", parseInt(latency, 10));
      // only update playerCount when host sends a numeric count (not a UUID)
      if (typeof playerIdOrCount === "number") {
        this._store.commit("session/setPlayerCount", playerIdOrCount);
      }
    }
  }

  /**
   * Handle a player leaving the sessions. ST only
   * @param playerId
   * @private
   */
  _handleBye(playerId) {
    if (this._isSpectator) return;
    delete this._players[playerId];
    this._store.commit(
      "session/setPlayerCount",
      Object.keys(this._players).length
    );
  }

  /**
   * Claim a seat, needs to be confirmed by the Storyteller.
   * Seats already occupied can't be claimed.
   * @param seat either -1 to vacate or the index of the seat claimed
   */
  claimSeat(seat) {
    if (!this._isSpectator) return;
    this._send("claim", [seat, this._store.state.session.playerId]);
  }

  /**
   * Update a player id associated with that seat.
   * @param index seat index or -1
   * @param value playerId to add / remove
   * @private
   */
  _updateSeat([index, value]) {
    const property = "id";
    const players = this._store.state.players.players;
    // remove previous seat
    const oldIndex = players.findIndex(({ id }) => id === value);
    if (oldIndex >= 0 && oldIndex !== index) {
      this._store.commit("players/update", {
        player: players[oldIndex],
        property,
        value: ""
      });
    }
    // add playerId to new seat
    if (index >= 0) {
      const player = players[index];
      if (!player) return;
      this._store.commit("players/update", { player, property, value });
    }
    // 只有 host 需要更新 _players 和 playerCount
    if (!this._isSpectator) {
      this._handlePing([value, 0]);
    }
  }

  /**
   * Distribute player roles to all seated players in a direct message.
   * This will be split server side so that each player only receives their own (sub)message.
   */
  distributeRoles() {
    if (this._isSpectator) return;
    const message = {};
    const bluffs = this._store.state.players.bluffs
      .filter(b => b && b.id)
      .map(b => b.id);
    this._store.state.players.players.forEach((player, index) => {
      if (player.id && player.role && player.role.id) {
        if (player.role.team === "demon" && bluffs.length) {
          message[player.id] = [
            "player",
            { index, property: "role", value: { id: player.role.id, bluffs } }
          ];
        } else {
          message[player.id] = [
            "player",
            { index, property: "role", value: player.role.id }
          ];
        }
      }
    });
    if (Object.keys(message).length) {
      this._send("direct", message);
    }
  }

  /**
   * A player nomination. ST only
   * This also syncs the voting speed to the players.
   * Payload can be an object with {nomination} property or just the nomination itself, or undefined.
   * @param payload [nominator, nominee]|{nomination}
   */
  nomination(payload) {
    if (this._isSpectator) return;
    const nomination = payload ? payload.nomination || payload : payload;
    const players = this._store.state.players.players;
    if (
      !nomination ||
      (players.length > nomination[0] && players.length > nomination[1])
    ) {
      this.setVotingSpeed(this._store.state.session.votingSpeed);
      this._send("nomination", nomination);
    }
  }

  /**
   * Set the isVoteInProgress status. ST only
   */
  setVoteInProgress() {
    if (this._isSpectator) return;
    this._send("isVoteInProgress", this._store.state.session.isVoteInProgress);
  }

  /**
   * Send the isNight status. ST only
   */
  setIsNight() {
    if (this._isSpectator) return;
    this._send("isNight", this._store.state.grimoire.isNight);
  }

  /**
   * Send the isVoteHistoryAllowed state. ST only
   */
  setVoteHistoryAllowed() {
    if (this._isSpectator) return;
    this._send(
      "isVoteHistoryAllowed",
      this._store.state.session.isVoteHistoryAllowed
    );
  }

  /**
   * Send the voting speed. ST only
   * @param votingSpeed voting speed in seconds, minimum 1
   */
  setVotingSpeed(votingSpeed) {
    if (this._isSpectator) return;
    if (votingSpeed) {
      this._send("votingSpeed", votingSpeed);
    }
  }

  /**
   * Set which player is on the block. ST only
   * @param playerIndex, player id or -1 for empty
   */
  setMarked(playerIndex) {
    if (this._isSpectator) return;
    this._send("marked", playerIndex);
  }

  /**
   * Clear the vote history for everyone. ST only
   */
  clearVoteHistory() {
    if (this._isSpectator) return;
    this._send("clearVoteHistory");
  }

  /**
   * Send a vote. Player or ST
   * @param index Seat of the player
   * @param sync Flag whether to sync this vote with others or not
   */
  vote([index]) {
    const player = this._store.state.players.players[index];
    if (
      this._store.state.session.playerId === player.id ||
      !this._isSpectator
    ) {
      // send vote only if it is your own vote or you are the storyteller
      this._send("vote", [
        index,
        this._store.state.session.votes[index],
        !this._isSpectator
      ]);
    }
  }

  /**
   * Handle an incoming vote, but only if it is from ST or unlocked.
   * @param index
   * @param vote
   * @param fromST
   */
  _handleVote([index, vote, fromST]) {
    const { session, players } = this._store.state;
    const playerCount = players.players.length;
    const indexAdjusted =
      (index - 1 + playerCount - session.nomination[1]) % playerCount;
    if (fromST || indexAdjusted >= session.lockedVote - 1) {
      this._store.commit("session/vote", [index, vote]);
    }
  }

  /**
   * Lock a vote. ST only
   */
  lockVote() {
    if (this._isSpectator) return;
    const { lockedVote, votes, nomination } = this._store.state.session;
    const { players } = this._store.state.players;
    const index = (nomination[1] + lockedVote - 1) % players.length;
    this._send("lock", [this._store.state.session.lockedVote, votes[index]]);
  }

  /**
   * Update vote lock and the locked vote, if it differs. Player only
   * @param lock
   * @param vote
   * @private
   */
  _handleLock([lock, vote]) {
    if (!this._isSpectator) return;
    this._store.commit("session/lockVote", lock);
    if (lock > 1) {
      const { lockedVote, nomination } = this._store.state.session;
      const { players } = this._store.state.players;
      const index = (nomination[1] + lockedVote - 1) % players.length;
      if (this._store.state.session.votes[index] !== vote) {
        this._store.commit("session/vote", [index, vote]);
      }
    }
  }

  /**
   * Swap two player seats. ST only
   * @param payload
   */
  swapPlayer(payload) {
    if (this._isSpectator) return;
    this._send("swap", payload);
  }

  /**
   * Move a player to another seat. ST only
   * @param payload
   */
  movePlayer(payload) {
    if (this._isSpectator) return;
    this._send("move", payload);
  }

  /**
   * Remove a player. ST only
   * @param payload
   */
  removePlayer(payload) {
    if (this._isSpectator) return;
    this._send("remove", payload);
  }
}

export default store => {
  // setup
  const session = new LiveSession(store);

  // listen to mutations
  store.subscribe(({ type, payload }, state) => {
    switch (type) {
      case "session/setSessionId":
        if (state.session.sessionId) {
          session.connect(state.session.sessionId);
        } else {
          window.location.hash = "";
          // 退出房间时清空玩家和缓存的角色数据
          store.commit("players/set", []);
          store.commit("players/setBluff");
          store.commit("players/setFabled");
          session.disconnect();
        }
        break;
      case "session/claimSeat":
        console.log("[WS] claimSeat subscriber, sessionId:", !!state.session.sessionId, "seat:", payload);
        session.claimSeat(payload);
        break;
      case "session/distributeRoles":
        if (payload) {
          session.distributeRoles();
        }
        break;
      case "session/nomination":
      case "session/setNomination":
        session.nomination(payload);
        break;
      case "session/setVoteInProgress":
        session.setVoteInProgress(payload);
        break;
      case "session/voteSync":
        session.vote(payload);
        break;
      case "session/lockVote":
        session.lockVote();
        break;
      case "session/setVotingSpeed":
        session.setVotingSpeed(payload);
        break;
      case "session/clearVoteHistory":
        session.clearVoteHistory();
        break;
      case "session/setVoteHistoryAllowed":
        session.setVoteHistoryAllowed();
        break;
      case "toggleNight":
        session.setIsNight();
        break;
      case "setEdition":
        session.sendEdition();
        break;
      case "players/setFabled":
        session.sendFabled();
        break;
      case "session/setMarkedPlayer":
        session.setMarked(payload);
        break;
      case "players/swap":
        if (!state.session.isSpectator) session.swapPlayer(payload);
        break;
      case "players/move":
        if (!state.session.isSpectator) session.movePlayer(payload);
        break;
      case "players/remove":
        if (!state.session.isSpectator) session.removePlayer(payload);
        break;
      case "players/set":
      case "players/clear":
      case "players/add":
        if (!state.session.isSpectator) session.sendGamestate("", true);
        break;
      case "players/update":
        if (!state.session.isSpectator) {
          if (payload.property === "pronouns") {
            session.sendPlayerPronouns(payload);
          } else {
            session.sendPlayer(payload);
          }
        }
        break;
    }
  });

  // check for session Id in hash
  const sessionId = window.location.hash.substr(1);
  if (sessionId) {
    store.commit("session/setSpectator", true);
    store.commit("session/setSessionId", sessionId);
    store.commit("toggleGrimoire", false);
  }
};
