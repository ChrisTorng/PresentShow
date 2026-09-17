# PresentShow

純前端聚會投影工具：繁體中文主控台、可編輯 JSON、獨立投影視窗、淡色流動背景、YouTube／音訊／影片控制。不需服務端或安裝相依套件。

## 開始使用

1. 安裝 Node.js 20 以上，執行 `npm start`，開啟 http://localhost:4173 。不要直接雙擊 HTML，瀏覽器會限制模組、設定檔與 YouTube。
2. 選示範、本機 JSON，或輸入設定檔網址。
3. 按「開啟投影視窗」，拖至第二螢幕，點「全螢幕」或雙擊畫面。
4. 點縮圖或左右鍵換頁；空白鍵開始／暫停媒體與輪播。輸入欄及編輯器保留原本鍵盤行為。
5. 播放遭阻擋時，在投影視窗點「啟用播放／聲音」。YouTube 也可能因擁有者禁止嵌入、地區、登入或網路而無法播放。

只有一處播放聲音：未開投影視窗時由預覽播放；開啟後移交播放位置。第一次開啟／關閉投影視窗需要重建播放器，可能短暫停頓，建議正式播放前先開好。正常切換 `media: "keep"` 頁面不重建播放器、不歸零。投影中的主控預覽以媒體狀態卡取代重複影片，避免重複出聲。

「開始播放」啟用設定秒數的換頁。輪播可暫停計時，也可直接點後續縮圖跳出。左右鍵沿整份流程移動，不受輪播回跳限制。「純背景」暫時隱藏前景、保留聲音並暫停倒數，再按一次恢復。媒體可獨立播放／暫停、拖曳進度、調整音量與循環。

## 私人設定與部署

- `examples/sample.json` 是公開示範，帳號與戶名是示範文字；YouTube 使用官方 API 範例影片。
- `private/` 與 `*.private.json` 由 `.gitignore` 排除。私人檔可在入口本機選檔，不需上傳。
- 在本機可開啟 `http://localhost:4173/?config=private/church.private.json` 使用已準備的私人設定。
- `npm run build` 只複製明確列出的程式及 `examples/` 到 `dist/`，不包含 `private/`。將 **dist 裡的內容** 上傳至 `http://christorng.idv.tw/PresentShow/`；不要直接上傳整個專案。Git 忽略不代表網頁伺服器禁止存取。
- 直接載入範例：`http://christorng.idv.tw/PresentShow/?config=examples/sample.json`。
- 遠端設定：`?config=https%3A%2F%2Fexample.com%2Fmeeting.json`。跨網域來源須允許 CORS；HTTPS 不能抓 HTTP 設定。相對素材 URL 以設定檔網址為基準。
- 網頁不能用網址任意讀取 `C:\…` 或 `file://…`。請本機選檔，並「選取素材資料夾」。檔案不會上傳或永久儲存，重整後須重新選取。
- 素材資料夾可包含 `media/song.mp3`、`images/logo.png`；設定檔使用相同相對路徑，選取共同根資料夾。不支援 `../` 跳出選取的資料夾。
- 建議桌面 Chrome／Edge。HTTP 部署可使用選檔與資料夾輸入，不依賴需 HTTPS 的檔案系統 API。

## 編輯設定

主控台「編輯設定」可修改、套用、下載 JSON。修改只在本次工作階段有效，請下載保存。拖曳可排序一般頁面、或同一輪播內的頁面；跨輪播搬移與加減頁面請改 `sequence`。

`variables` 集中定義地點、日期、聚會時間／名稱、音樂、奉獻資訊與經文；文字以 `{{venue}}` 等占位符引用。`date` 留空時採載入當天的本機日期。跨午夜不會突然改日期，重新套用即可更新。

`pages` 定義頁面，`sequence` 定義順序，可重複引用：

```json
{
  "name": "我的聚會",
  "variables": { "venue": "相聚空間", "date": "" },
  "pages": {
    "blank": { "type": "blank", "label": "純背景" },
    "welcome": {
      "type": "text", "label": "歡迎",
      "blocks": [
        { "kind": "eyebrow", "text": "{{date}}" },
        { "kind": "title", "text": "{{venue}}" },
        { "kind": "subtitle", "text": "歡迎參與" }
      ]
    }
  },
  "sequence": ["blank", "welcome", "blank"]
}
```

頁面 `type` 支援 `blank`、`text`、`image`、`media`。文字 `kind` 支援 `eyebrow`、`title`、`subtitle`、`text`、`quote`、`account`、`caption`；以 `\n` 換行。頁面加 `align: "left"` 可靠左。文字依內容量縮小，仍建議少量大字。內容安全地以文字呈現，不執行 HTML／腳本。

圖片頁：

```json
{ "type": "image", "label": "透明圖片", "src": "images/logo.png", "fit": "original", "media": "keep" }
```

`fit: "original"` 保持原尺寸，太大才等比例縮小；`"contain"` 等比例放大／縮小至螢幕內，不裁切。透明區顯示持續背景。`examples/welcome.svg` 是原創透明範例。聚會 1 的「圖檔」頁預設以可編輯文字重製，不使用截圖；若要實際圖片，將 `prayImage` 改為上述 image 格式。

媒體頁：

```json
{ "type": "media", "label": "音樂", "media": { "kind": "youtube", "src": "https://www.youtube.com/watch?v=VIDEO_ID", "loop": true } }
```

`kind` 也可為 `audio`、`video`；`src` 使用網址或本機素材相對路徑。影片黑底等比例滿版，音檔只秀無字背景。請使用瀏覽器支援的格式，例如 MP3、WAV、MP4（H.264/AAC）。

- 下一頁指定 `"media": "keep"` 延續媒體，隱藏影片画面但不打斷音樂。
- 未指定 media 或 `"media": "stop"` 停止媒體。
- 直接跳至 keep 頁會開始流程中繼承的音樂；同一段媒體已在播放則保持進度。
- 操作介面的音量與循環只影響當次操作；永久修改 loop 請編輯設定並下載。
- 實作參考 [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)。YouTube 需連網，廣告與品牌元素由 YouTube 決定。

輪播放在 `sequence`：

```json
{
  "label": "聚會前輪播",
  "pages": [{ "page": "pre1", "seconds": 10 }, { "page": "pre2", "seconds": 12 }],
  "loop": true
}
```

`loop: true` 回到首張；`loop: false` 停在最後一張，另加 `continue: true` 可接續流程。組別 seconds 預設 10 秒，可逐頁指定。一般頁面 seconds 預設 0（手動），大於 0 時按開始才倒數。也可使用 `{ "page": "welcome", "seconds": 8 }`。

## 驗證

`npm test` 檢查日期、輪播、媒體繼承、路徑與設定驗證。`npm run build` 產生不含私人資料的靜態部署目錄。YouTube 可否嵌入依影片與網路环境決定。
