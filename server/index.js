const fs = require("fs");
const https = require("https");
const WebSocket = require("ws");
const client = require("prom-client");

// Create a Registry which registers the metrics
const register = new client.Registry();
// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: "clocktower-online"
});

const PING_INTERVAL = 30000; // 30 seconds

const isDev = process.env.NODE_ENV === "development";
// HTTP_MODE=1: 使用 HTTP（适用于 Docker 内部/nginx 反向代理场景，无需证书）
const isHttpMode = process.env.HTTP_MODE === "1";

let server;
if (isDev || isHttpMode) {
  // 开发模式或 Docker 反向代理模式：使用 HTTP，不需要证书
  server = require("http").createServer();
} else {
  const options = {
    cert: fs.readFileSync("cert.pem"),
    key: fs.readFileSync("key.pem")
  };
  server = https.createServer(options);
}

// map of channels currently in use
const channels = {};

// map of active rooms: channel -> { name, createdAt, playerCount }
const rooms = {};

// 说书人断连宽限期定时器（刷新页面时给说书人时间重新连接）
const hostDestroyTimers = {};
const HOST_RECONNECT_GRACE = 24 * 60 * 60 * 1000; // 24 hours

// allowed origins for production
const allowedOrigins = /^https?:\/\/([^.]+\.github\.io|localhost|clocktower\.online|eddbra1nprivatetownsquare\.xyz|gstonegames\.com)/i;

// unified connection verification: origin + room validation + duplicate host
function verifyClient(info, callback) {
  // origin check (production only, skip in dev or Docker HTTP mode)
  if (process.env.NODE_ENV !== "development" && !isHttpMode) {
    if (info.origin && !info.origin.match(allowedOrigins)) {
      return callback(false, 403, "Forbidden", { "X-Reason": "origin" });
    }
  }
  // parse URL to get channel and playerId
  const url = (info.req.url || "").toLocaleLowerCase().split("/");
  const playerId = url.pop();
  const channel = url.pop();
  // reject host connections to the browsing-only channel
  if (playerId === "host" && channel === "browsing") {
    return callback(false, 400, "Bad Request", { "X-Reason": "browsing" });
  }
  // prevent spectators from joining a channel with no registered room
  if (playerId !== "host" && !rooms[channel]) {
    return callback(false, 404, "Not Found", { "X-Reason": "no-room" });
  }
  // check for duplicate host
  if (
    playerId === "host" &&
    channels[channel] &&
    channels[channel].some(
      client =>
        client.readyState === WebSocket.OPEN &&
        client.playerId === "host"
    )
  ) {
    return callback(false, 409, "Conflict", { "X-Reason": "duplicate-host" });
  }
  callback(true);
}

const wss = new WebSocket.Server({
  ...(process.env.NODE_ENV === "development" ? { port: 8081 } : { server }),
  verifyClient
});

function noop() {}

// broadcast current room list to all connected clients
function broadcastRoomList() {
  const list = Object.entries(rooms).map(([id, r]) => ({
    id,
    name: r.name,
    playerCount: r.playerCount,
    createdAt: r.createdAt
  }));
  const msg = JSON.stringify(["rooms", list]);
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(msg);
      } catch (e) {
        // ignore
      }
    }
  });
}

// calculate latency on heartbeat
function heartbeat() {
  this.latency = Math.round((new Date().getTime() - this.pingStart) / 2);
  this.counter = 0;
  this.isAlive = true;
}

// metrics
const metrics = {
  players_concurrent: new client.Gauge({
    name: "players_concurrent",
    help: "Concurrent Players",
    collect() {
      this.set(wss.clients.size);
    }
  }),
  channels_concurrent: new client.Gauge({
    name: "channels_concurrent",
    help: "Concurrent Channels",
    collect() {
      this.set(Object.keys(channels).length);
    }
  }),
  channels_list: new client.Gauge({
    name: "channel_players",
    help: "Players in each channel",
    labelNames: ["name"],
    collect() {
      for (let channel in channels) {
        this.set(
          { name: channel },
          channels[channel].filter(
            ws =>
              ws &&
              (ws.readyState === WebSocket.OPEN ||
                ws.readyState === WebSocket.CONNECTING)
          ).length
        );
      }
    }
  }),
  messages_incoming: new client.Counter({
    name: "messages_incoming",
    help: "Incoming messages"
  }),
  messages_outgoing: new client.Counter({
    name: "messages_outgoing",
    help: "Outgoing messages"
  }),
  connection_terminated_host: new client.Counter({
    name: "connection_terminated_host",
    help: "Terminated connection due to host already present"
  }),
  connection_terminated_spam: new client.Counter({
    name: "connection_terminated_spam",
    help: "Terminated connection due to message spam"
  }),
  connection_terminated_timeout: new client.Counter({
    name: "connection_terminated_timeout",
    help: "Terminated connection due to timeout"
  })
};

// register metrics
for (let metric in metrics) {
  register.registerMetric(metrics[metric]);
}

// a new client connects
wss.on("connection", function connection(ws, req) {
  // url pattern: clocktower.online/<channel>/<playerId|host>
  const url = req.url.toLocaleLowerCase().split("/");
  ws.playerId = url.pop();
  ws.channel = url.pop();
  ws.isAlive = true;
  ws.pingStart = new Date().getTime();
  ws.counter = 0;
  // add channel to list
  if (!channels[ws.channel]) {
    channels[ws.channel] = [];
  }
  channels[ws.channel].push(ws);
  // register room when host connects
  if (ws.playerId === "host" && !rooms[ws.channel]) {
    rooms[ws.channel] = {
      name: ws.channel,
      createdAt: new Date().getTime(),
      playerCount: 1 // host 自己算 1 人
    };
    broadcastRoomList();
    // 通知 host 自己的 playerCount
    ws.send(JSON.stringify(["playerCount", 1]));
  } else if (ws.playerId === "host" && rooms[ws.channel]) {
    // 说书人重连，取消宽限期销毁定时器
    if (hostDestroyTimers[ws.channel]) {
      clearTimeout(hostDestroyTimers[ws.channel]);
      delete hostDestroyTimers[ws.channel];
    }
  } else if (ws.playerId !== "host" && rooms[ws.channel]) {
    // 玩家连接时增加计数
    rooms[ws.channel].playerCount++;
    broadcastRoomList();
    // 通知房间内所有人更新 playerCount
    channels[ws.channel].forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(["playerCount", rooms[ws.channel].playerCount]));
        } catch (e) {
          // ignore
        }
      }
    });
  }
  // start ping pong
  ws.ping(noop);
  ws.on("pong", heartbeat);
  // handle disconnect: if host disconnects, notify all spectators and remove room
  ws.on("close", function() {
    // 从 channels 列表中移除
    if (channels[ws.channel]) {
      channels[ws.channel] = channels[ws.channel].filter(c => c !== ws);
    }
    // 更新 playerCount
    if (rooms[ws.channel]) {
      if (ws.playerId === "host") {
        // 说书人断开：启动宽限期，等待说书人重新连接（处理刷新页面场景）
        // 先清理该频道已有的定时器（防止重复触发）
        if (hostDestroyTimers[ws.channel]) {
          clearTimeout(hostDestroyTimers[ws.channel]);
        }
        // 宽限期结束后，真正销毁房间并踢出玩家
        hostDestroyTimers[ws.channel] = setTimeout(function() {
          delete hostDestroyTimers[ws.channel];
          if (rooms[ws.channel]) {
            channels[ws.channel].forEach(function each(client) {
              if (client.readyState === WebSocket.OPEN) {
                try {
                  client.send(JSON.stringify(["sessionDestroy"]));
                } catch (e) {
                  // ignore
                }
              }
            });
            delete rooms[ws.channel];
            broadcastRoomList();
          }
        }, HOST_RECONNECT_GRACE);
      } else {
        // 玩家断开，减少计数
        rooms[ws.channel].playerCount = Math.max(0, rooms[ws.channel].playerCount - 1);
        broadcastRoomList();
      }
    }
    // 清理空 channels
    if (channels[ws.channel] && channels[ws.channel].length === 0) {
      delete channels[ws.channel];
    }
  });
  // handle message
  ws.on("message", function incoming(data) {
    metrics.messages_incoming.inc();
    // check rate limit (max 5msg/second)
    ws.counter++;
    if (ws.counter > (5 * PING_INTERVAL) / 1000) {
      console.log(ws.channel, "disconnecting user due to spam");
      ws.close(
        1000,
        "Your app seems to be malfunctioning, please clear your browser cache."
      );
      metrics.connection_terminated_spam.inc();
      return;
    }
    const messageType = data
      .toLocaleLowerCase()
      .substr(1)
      .split(",", 1)
      .pop();
    switch (messageType) {
      case '"rooms"':
        // send current room list to requester
        try {
          const list = Object.entries(rooms).map(([id, r]) => ({
            id,
            name: r.name,
            playerCount: r.playerCount,
            createdAt: r.createdAt
          }));
          ws.send(JSON.stringify(["rooms", list]));
          metrics.messages_outgoing.inc();
        } catch (e) {
          // ignore
        }
        break;
      case '"ping"':
        // ping messages will only be sent host -> all or all -> host
        channels[ws.channel].forEach(function each(client) {
          if (
            client !== ws &&
            client.readyState === WebSocket.OPEN &&
            (ws.playerId === "host" || client.playerId === "host")
          ) {
            // 如果是发给 host 的 ping，用服务器的 playerCount 替换第一个参数
            let msg = data;
            if (client.playerId === "host" && rooms[ws.channel]) {
              try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed) && parsed[0] !== undefined) {
                  parsed[0] = rooms[ws.channel].playerCount;
                  msg = JSON.stringify(parsed);
                }
              } catch (e) {
                // ignore
              }
            }
            client.send(
              msg.replace(/latency/, (client.latency || 0) + (ws.latency || 0))
            );
            metrics.messages_outgoing.inc();
          }
        });
        break;
      case '"direct"':
        // handle "direct" messages differently
        console.log(
          new Date(),
          wss.clients.size,
          ws.channel,
          ws.playerId,
          data
        );
        try {
          const dataToPlayer = JSON.parse(data)[1];
          channels[ws.channel].forEach(function each(client) {
            if (
              client !== ws &&
              client.readyState === WebSocket.OPEN &&
              dataToPlayer[client.playerId]
            ) {
              client.send(JSON.stringify(dataToPlayer[client.playerId]));
              metrics.messages_outgoing.inc();
            }
          });
        } catch (e) {
          console.log("error parsing direct message JSON", e);
        }
        break;
      default:
        // all other messages
        console.log(
          new Date(),
          wss.clients.size,
          ws.channel,
          ws.playerId,
          data
        );
        channels[ws.channel].forEach(function each(client) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(data);
            metrics.messages_outgoing.inc();
          }
        });
        break;
    }
  });
});

// start ping interval timer
const interval = setInterval(function ping() {
  // ping each client
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) {
      metrics.connection_terminated_timeout.inc();
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.pingStart = new Date().getTime();
    ws.ping(noop);
  });
  // clean up empty channels and orphaned rooms
  let roomListChanged = false;
  for (let channel in channels) {
    if (
      !channels[channel].length ||
      !channels[channel].some(
        ws =>
          ws &&
          (ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING)
      )
    ) {
      metrics.channels_list.remove({ name: channel });
      delete channels[channel];
    }
  }
  // remove rooms that no longer have a host connected
  for (let channel in rooms) {
    const hasHost =
      channels[channel] &&
      channels[channel].some(
        ws =>
          ws &&
          ws.playerId === "host" &&
          (ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING)
      );
    if (!hasHost) {
      delete rooms[channel];
      roomListChanged = true;
    }
  }
  if (roomListChanged) {
    broadcastRoomList();
  }
}, PING_INTERVAL);

// handle server shutdown
wss.on("close", function close() {
  clearInterval(interval);
});

// prod mode with stats API (also used in Docker HTTP mode)
if (process.env.NODE_ENV !== "development" || isHttpMode) {
  console.log("server starting" + (isHttpMode ? " (HTTP mode)" : ""));
  server.listen(8080);
  server.on("request", (req, res) => {
    res.setHeader("Content-Type", register.contentType);
    register.metrics().then(out => res.end(out));
  });
}
