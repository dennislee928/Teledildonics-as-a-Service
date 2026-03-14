# TaaS v1 生產級基底規劃

## 摘要
- 以綠地 monorepo 開局，產品面一次規劃四個面向：`Creator Console`、`Hosted Control Page`、`Embeddable JS SDK`、`Companion App`（桌面 + 行動）。
- 技術分層固定為 `Go + Rust + TypeScript`：Go 負責控制面與即時 relay，Rust/Tauri 負責 companion 與裝置 runtime，TypeScript 負責 console、hosted page、SDK。
- 即時路徑採混合式架構：外部事件先進 Go 控制面，控制面再透過 Cloudflare Realtime 將命令下發到 creator companion；狀態回傳走反向資料通道，Redis Pub/Sub 做跨區 session 同步，Postgres 做耐久資料。
- v1 僅支援平台中立 webhook / SDK 事件，不做 OnlyFans 私有 API 整合；商業模型先落在 API 呼叫計量與用量帳本，不把 payout/creator settlement 綁死在第一版。

## 主要實作
- 控制面建立多租戶核心模型：`Workspace`、`Creator`、`DeviceBridge`、`Device`、`RuleSet`、`Session`、`InboundEndpoint`、`ControlGrant`、`UsageLedger`、`AuditEvent`。
- Go `control-api` 提供工作區管理、API key、webhook endpoint、session arming/revocation、ruleset CRUD、pairing、usage 查詢與 consent/audit 流程；console 登入走通用 OIDC，server-to-server 走 workspace API keys。
- Go `relay` 以 Pion 連接 Cloudflare Realtime；每個 armed session 固定兩條資料通道：`control`（平台 -> companion）與 `telemetry`（companion -> 平台）。Cloudflare 通道失敗時，companion 自動降級到最近區域的認證 WebSocket。
- Companion 採 Tauri v2 + 共用 Rust core；Rust core 內建 Buttplug 相容裝置層，優先直接控制支援裝置，遇到特殊硬體時允許外掛到 Intiface/WS connector，不阻塞首版交付。
- 規則引擎只接受事件驅動控制，不對匿名 fan 暴露原始裝置命令；`tip.received`、`event.received` 會被映射為標準化 `ControlCommand`，套用 creator 設定的強度上限、持續時間上限、冷卻、去重與速率限制。
- 安全模型固定為 Zero-Trust session：creator 必須顯式 arm session、設定裝置上限並可隨時 panic stop；disconnect、token 過期、companion 背景權限失效、或規則違規時一律 `stop-all`。
- Creator Console 與 Hosted Control Page 共用同一套 TypeScript domain SDK；embeddable JS SDK 只提供事件提交、session 狀態、簽章驗證輔助與 hosted widget 嵌入，不提供直接 actuator 指令介面。
- 觀測性固定納入首版：命令接收至 companion ACK 的延遲直方圖、per-region 失敗率、裝置連線健康、webhook 驗章失敗、規則拒絕原因、panic stop 觸發與 API 用量計量。

## 公開 API / 介面
- REST API 固定提供：
  - `POST /v1/inbound-events`
  - `POST /v1/device-bridges/pair`
  - `POST /v1/sessions`
  - `POST /v1/sessions/{id}/arm`
  - `POST /v1/sessions/{id}/stop`
  - `POST /v1/rulesets`
  - `PUT /v1/rulesets/{id}`
  - `GET /v1/sessions/{id}/stream`
- `inbound-events` 輸入格式固定為 provider-neutral envelope：`event_type`、`workspace_id`、`creator_id`、`source_id`、`amount`、`currency`、`occurred_at`、`idempotency_key`、`signature`、`metadata`。
- 平台內部標準命令格式固定為 `ControlCommand`：`session_id`、`sequence`、`device_id`、`action`、`intensity`、`duration_ms`、`pattern_id`、`nonce`、`issued_at`、`expires_at`、`ciphertext`、`signature`。
- Companion 回傳 `TelemetryEvent`：`session_id`、`sequence`、`status`、`executed_at`、`device_state`、`latency_ms`、`error_code`、`stop_reason`。
- 加密介面固定為「Ed25519 身分簽章 + 每 session 對稱金鑰封裝後的 AES-256-GCM payload」；實作上以配對階段建立可輪替的 session key，不依賴傳輸層加密作為唯一保護。

## 測試與驗收
- 規則引擎測試：金額映射、冷卻、去重、上限裁切、過期 session、重放攻擊與非法來源事件都必須可重現且可審計。
- Relay 測試：雙資料通道建立、跨區重連、Cloudflare 不可用時 WebSocket 降級、session 轉移、presence 同步與 stop-all 可靠送達。
- Companion 測試：桌面與行動各一條主線路徑，至少覆蓋配對、裝置掃描、控制執行、panic stop、背景/前景切換與藍牙權限失效。
- E2E 驗收場景固定包含：`webhook -> ruleset -> command -> ACK`、`hosted page -> event -> command`、`SDK 嵌入頁 -> session status`、`creator revoke -> immediate stop-all`、`disconnect -> automatic stop-all`。
- 非功能驗收目標固定為：單區熱路徑 `p95 < 150ms`（事件被平台接受到 companion ACK），Cloudflare 降級模式 `p95 < 250ms`，且 1000 個 armed sessions / 200 events per second 聚合負載下不出現命令亂序或遺失。

## 假設與預設
- repo 目前是空的，這份規劃預設直接建立新 monorepo，而不是接既有服務。
- v1 只做平台中立 inbound webhook / SDK，不做平台專屬支付或私有 creator 平台整合。
- hosted auth 以「OIDC 相容且接受成人產業」為選型邊界，程式設計上做 provider abstraction，不把首版綁死單一廠商。
- 雖然你原始構想寫的是 `Go + Buttplug wrapper`，但基於目前官方生態，裝置 runtime 改為 Rust/Tauri 會更穩；Go 仍保留在控制面與 relay。
- 由於 Cloudflare Realtime 文件在 2025 年 8 月 12 日更新時明確記載 DataChannels 為單向，首版設計固定使用雙通道而不是單通道雙向假設。
- Companion 首版同時規劃桌面與行動，但會共用同一個 Rust core；若個別平台 BLE 限制造成差異，允許以 feature flag 延後特定裝置支援，不改 API 契約。

## 參考依據
- Cloudflare Realtime SFU / DataChannels / TURN：
  - https://developers.cloudflare.com/realtime/sfu
  - https://developers.cloudflare.com/realtime/sfu/datachannels/
  - https://developers.cloudflare.com/realtime/turn/
- Buttplug / Intiface 架構與開發指引：
  - https://docs.buttplug.io/docs/spec/architecture/
  - https://docs.buttplug.io/docs/dev-guide/intro/how-to-read/
  - https://docs.intiface.com/docs/intiface-central/quickstart
- Pion WebRTC 官方專案：
  - https://github.com/pion/webrtc
