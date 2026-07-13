module.exports = {
  // if the app is supposed to run on Github Pages in a subfolder, use the following config:
  // publicPath: process.env.NODE_ENV === "production" ? "/townsquare/" : "/"
  publicPath: process.env.NODE_ENV === "production" ? "/" : "/",
  devServer: {
    // 允许局域网设备通过 IP 地址访问（如 http://192.168.x.x:8080）
    host: "0.0.0.0",
    allowedHosts: "all"
  }
};
