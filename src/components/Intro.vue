<template>
  <div class="intro">
    <div class="introContain">
      <img src="static/main_logo.png" alt="" />
      亲爱的玩家 欢迎使用<br />
      <b><span style="color: red">染·钟楼谜团官方魔典</span></b><br />
      点击右上角
      <span class="button" @click="toggleMenu">
        <font-awesome-icon icon="cog" /> 菜单
      </span>
      可查看主要功能<br />
      <div style="display: flex; align-items: center; justify-content: center">
        <span
          style="color: #1F65FF; font-size: 80%; cursor: pointer"
          @click="seeGuide"
          >如何使用染.钟楼谜团应用？</span
        >
      </div>
      线上语音平台推荐使用
      <a
        style="color: #1F65FF"
        href="https://meeting.tencent.com/marketplace/support-collect-detail?sdk_id=19800120650"
        target="_blank"
        >腾讯会议应用</a
      ><br />
      快捷键：<b>[A]</b>添加座位
      <b>[C]</b>创建小镇
      <b>[J]</b>加入小镇
    </div>
  </div>
</template>

<script>
import { mapMutations } from "vuex";

export default {
  methods: {
    ...mapMutations(["toggleMenu"]),
    seeGuide() {
      window.open("https://clocktower.gstonegames.com/guide/?type=2&bIsWM=", "_blank");
    }
  }
};
</script>

<style scoped lang="scss">
.intro {
  text-align: center;
  width: 50%;
  font-size: 120%;
  position: absolute;
  z-index: 3;

  a {
    color: white;
  }
}

.introContain {
  width: 100%;
  padding: 10px;
  background: rgba(0, 0, 0, 0.5);
  border: 3px solid black;
  border-radius: 10px;
  margin-top: 20%;

  img {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translate(-50%);
    margin-bottom: 2vh;
    width: 25vh;
    max-width: 192px;
    border-radius: 50%;
    box-shadow: 0 0 10px black;
    border: 3px solid black;
  }
}

.button {
  display: inline-block;
  padding: 1px 10px;
  font-size: 85%;
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid black;
  border-radius: 20px;
  cursor: pointer;
  &:hover {
    color: red;
  }
}
</style>
