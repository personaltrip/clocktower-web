<template>
  <Modal v-if="modals.roomList" @close="close">
    <h3 class="room-modal-title">加入小镇</h3>
    <p class="room-modal-desc">输入说书人创建的房间号</p>
    <div class="custom-room">
      <input
        ref="roomInput"
        v-model="customRoomId"
        placeholder="房间号"
        @keyup.enter="joinRoom"
        maxlength="10"
        autofocus
      />
      <div class="button-group">
        <span class="button townsfolk" @click="joinRoom">加入</span>
        <span class="button" @click="close">取消</span>
      </div>
      <p v-if="error" class="error-text">{{ error }}</p>
    </div>
  </Modal>
</template>

<script>
import { mapState } from "vuex";
import Modal from "./Modal";

export default {
  name: "RoomListModal",
  components: { Modal },
  computed: {
    ...mapState(["modals"]),
    ...mapState("session", ["connectError"])
  },
  watch: {
    connectError(val) {
      if (val) this.error = val;
    }
  },
  data() {
    return {
      customRoomId: "",
      error: ""
    };
  },
  mounted() {
    this.$nextTick(() => {
      if (this.$refs.roomInput) {
        this.$refs.roomInput.focus();
      }
    });
  },
  methods: {
    joinRoom() {
      const roomId = (this.customRoomId || "")
        .replace(/[^0-9a-zA-Z]/g, "")
        .substr(0, 10)
        .toLowerCase();
      if (!roomId) {
        this.error = "请输入有效的房间号";
        return;
      }
      this.error = "";
      this.$store.commit("session/setConnectError", "");
      this.$store.commit("session/clearVoteHistory");
      this.$store.commit("session/setSpectator", true);
      this.$store.commit("toggleGrimoire", false);
      this.$store.commit("toggleModal", "roomList");
      this.$store.commit("session/setSessionId", roomId);
    },
    close() {
      this.$store.commit("toggleModal", "roomList");
    }
  }
};
</script>

<style scoped lang="scss">
.room-modal-title {
  color: white;
  margin: 10px 0 5px;
  font-size: 120%;
}

.room-modal-desc {
  color: #aaa;
  font-size: 85%;
  margin: 0 0 15px;
  text-align: center;
}

.custom-room {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;

  input {
    width: 100%;
    max-width: 250px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    background: rgba(0, 0, 0, 0.4);
    color: white;
    font-size: 100%;
    text-align: center;

    &::placeholder {
      color: #888;
    }

    &:focus {
      outline: none;
      border-color: #0031ad;
    }
  }

  .button-group {
    display: flex;
    gap: 8px;
  }

  .error-text {
    color: #ff4444;
    font-size: 80%;
    margin: 0;
    text-align: center;
  }
}
</style>
