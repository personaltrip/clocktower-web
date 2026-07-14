<template>
  <div class="token" :class="[role.id]">
    <span
      class="icon"
      v-if="role.id && !hideRole"
      :style="{ backgroundImage: `url(${iconUrl})` }"
    ></span>
    <span
      class="leaf-left"
      v-if="role.firstNight || role.firstNightReminder"
    ></span>
    <span
      class="leaf-right"
      v-if="role.otherNight || role.otherNightReminder"
    ></span>
    <span v-if="reminderLeaves" :class="['leaf-top' + reminderLeaves]"></span>
    <span class="leaf-orange" v-if="role.setup"></span>
    <svg v-if="!hideRole" viewBox="0 0 150 150" class="name">
      <path
        d="M 13 75 C 13 160, 138 160, 138 75"
        id="curve"
        fill="transparent"
      />
      <text
        width="150"
        x="66.6%"
        text-anchor="middle"
        class="label mozilla"
        :font-size="role.name | nameToFontSize"
      >
        <textPath xlink:href="#curve">
          {{ role.name }}
        </textPath>
      </text>
    </svg>
    <div class="edition" :class="[`edition-${role.edition}`, role.team]"></div>
    <div class="ability" v-if="role.ability">
      {{ role.ability }}
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";
import { getCachedImage, cacheImage } from "../utils/imageCache";

// 构建时获取所有本地图标文件列表
const localIcons = require.context("../assets/icons/", false, /\.png$/);
const localIconSet = new Set(
  localIcons.keys().map(key => key.replace("./", "").replace(".png", ""))
);

export default {
  name: "Token",
  props: {
    role: {
      type: Object,
      default: () => ({})
    },
    hideRole: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return { cachedImageUrl: null };
  },
  computed: {
    reminderLeaves: function() {
      return (
        (this.role.reminders || []).length +
        (this.role.remindersGlobal || []).length
      );
    },
    /**
     * 检查是否有本地图标
     */
    hasLocalIcon() {
      const iconId = this.role.imageAlt || this.role.id;
      return localIconSet.has(iconId);
    },
    useRemoteImage() {
      // 如果有本地图标，优先使用本地
      if (this.hasLocalIcon) return false;
      return !!(
        this.role.image &&
        (this.role.trustedImage ||
          (!this.role.isCustom && this.grimoire.isImageOptIn))
      );
    },
    /**
     * 将外部图片 URL 转换为服务器代理地址，实现服务器端缓存
     */
    proxiedImageUrl() {
      if (!this.role.image) return null;
      // 所有 http/https 外部图片都走代理
      if (/^https?:\/\//.test(this.role.image)) {
        return `/image-proxy/?url=${encodeURIComponent(this.role.image)}`;
      }
      return this.role.image;
    },
    iconUrl() {
      if (this.cachedImageUrl) return this.cachedImageUrl;
      if (this.useRemoteImage) return this.proxiedImageUrl;
      return require("../assets/icons/" + (this.role.imageAlt || this.role.id) + ".png");
    },
    ...mapState(["grimoire"])
  },
  watch: {
    role: "loadRemoteImage"
  },
  mounted() {
    this.loadRemoteImage();
  },
  beforeDestroy() {
    if (this.cachedImageUrl) URL.revokeObjectURL(this.cachedImageUrl);
  },
  filters: {
    nameToFontSize: name => (name && name.length > 10 ? "90%" : "110%")
  },
  methods: {
    setRole() {
      this.$emit("set-role");
    },
    async loadRemoteImage() {
      if (this.cachedImageUrl) URL.revokeObjectURL(this.cachedImageUrl);
      this.cachedImageUrl = null;
      if (!this.useRemoteImage) return;
      const cached = await getCachedImage(this.role.id);
      if (cached) {
        if (this._isDestroyed) return;
        this.cachedImageUrl = cached;
      } else {
        // 使用代理 URL 进行缓存，实现服务器端缓存
        const url = await cacheImage(this.role.id, this.proxiedImageUrl);
        if (this._isDestroyed) return;
        this.cachedImageUrl = url;
      }
    }
  }
};
</script>

<style scoped lang="scss">
.token {
  border-radius: 50%;
  width: 100%;
  background: url("../assets/token.png") center center;
  background-size: 100%;
  text-align: center;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none !important;

  * {
    pointer-events: none !important;
  }

  &:hover .name .label {
    stroke: black;
    stroke-width: 2px;
    fill: white;
    paint-order: stroke;
    @-moz-document url-prefix() {
      &.mozilla {
        stroke: none;
        filter: drop-shadow(0 1.5px 0 black) drop-shadow(0 -1.5px 0 black)
          drop-shadow(1.5px 0 0 black) drop-shadow(-1.5px 0 0 black)
          drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));
      }
    }
  }

  .icon,
  &:before {
    background-size: 100%;
    background-repeat: no-repeat;
    background-position: center 30%;
    position: absolute;
    width: 100%;
    height: 100%;
    margin-top: 3%;
  }

  span {
    position: absolute;
    width: 100%;
    height: 100%;
    background-size: 100%;
    pointer-events: none;

    &.leaf-left {
      background-image: url("../assets/leaf-left.png");
    }

    &.leaf-orange {
      background-image: url("../assets/leaf-orange.png");
    }

    &.leaf-right {
      background-image: url("../assets/leaf-right.png");
    }

    &.leaf-top1 {
      background-image: url("../assets/leaf-top1.png");
    }

    &.leaf-top2 {
      background-image: url("../assets/leaf-top2.png");
    }

    &.leaf-top3 {
      background-image: url("../assets/leaf-top3.png");
    }

    &.leaf-top4 {
      background-image: url("../assets/leaf-top4.png");
    }

    &.leaf-top5 {
      background-image: url("../assets/leaf-top5.png");
    }
  }

  .name {
    width: 100%;
    height: 100%;
    font-size: 24px; // svg fonts are relative to document font size
    .label {
      fill: black;
      stroke: none;
      paint-order: stroke;
      font-family: "Papyrus", serif;
      font-weight: bold;
      letter-spacing: 1px;

      @-moz-document url-prefix() {
        &.mozilla {
          // Vue doesn't support scoped media queries, so we have to use a second css class
          stroke: none;
          text-shadow: none;
          filter: drop-shadow(0 1.5px 0 black) drop-shadow(0 -1.5px 0 black)
            drop-shadow(1.5px 0 0 black) drop-shadow(-1.5px 0 0 black)
            drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));
        }
      }
    }
  }

  .edition {
    position: absolute;
    right: 0;
    bottom: 5px;
    width: 30px;
    height: 30px;
    background-size: 100%;
    display: none;
  }

  .ability {
    display: flex;
    position: absolute;
    padding: 5px 10px;
    left: 120%;
    width: 250px;
    z-index: 25;
    font-size: 80%;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 10px;
    border: 3px solid black;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
    text-align: left;
    justify-items: center;
    align-content: center;
    align-items: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms ease-in-out;

    &:before {
      content: " ";
      border: 10px solid transparent;
      width: 0;
      height: 0;
      border-right-color: black;
      position: absolute;
      margin-right: 2px;
      right: 100%;
    }
  }

  &:hover .ability {
    opacity: 1;
  }
}
</style>
