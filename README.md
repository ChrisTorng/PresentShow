# PresentShow

純前端聚會投影工具：繁體中文主控台、YAML／JSON 設定、純文字歌詞、獨立投影視窗、固定 seed 的動畫背景、YouTube／音訊／影片控制。不需服務端；YAML 解析器已隨網站附帶，日常使用不需安裝套件。

## 開始使用

1. 安裝 Node.js 20 以上，執行 `npm start`，開啟 http://localhost:4173 。不要直接雙擊 HTML，瀏覽器會限制模組、設定檔與 YouTube。
2. 選示範、本機 YAML／JSON，或輸入設定檔網址。
3. 按「開啟投影視窗」，拖至第二螢幕，點「全螢幕」或雙擊畫面。
4. 點縮圖預選、再點同頁播出；左右鍵換頁；空白鍵開始／暫停媒體與輪播。輸入欄及編輯器保留原本鍵盤行為。
5. 播放遭阻擋時，在投影視窗點「啟用播放／聲音」。YouTube 也可能因擁有者禁止嵌入、地區、登入或網路而無法播放。

只有一處播放聲音：未開投影視窗時由預覽播放；開啟後移交播放位置。第一次開啟／關閉投影視窗需要重建播放器，可能短暫停頓，建議正式播放前先開好。正常切換 `media: "keep"` 頁面不重建播放器、不歸零。本機影片預覽靜音同步播放進度；YouTube 預設顯示封面與歌名，也可透過下述原始監看分享同一播放器畫面。

進入輪播自動開始倒數，控制區顯示剩餘秒數與進度條。可暫停本頁，換頁後恢復倒數。右鍵播出下一頁預覽（含輪播回跳）；左鍵返回順序上一頁。「純背景」暫時隱藏前景、保留聲音並暫停倒數，再按一次恢復。媒體可獨立播放／暫停、拖曳進度、調整音量與循環。

## 私人設定與部署

- `examples/sample.yml` 是完整公開示範，包含三首一般示範文字、命名背景與播放流程。`examples/sample.json` 保留原始 17 頁範例；兩種格式都可用。YouTube 使用官方 API 範例影片。
- `private/`、`*.private.json`、`*.private.yml`、`*.private.yaml` 由 `.gitignore` 排除。私人檔可在入口本機選檔，不需上傳。
- 在本機可開啟 `http://localhost:4173/?config=private/20260920/church.private.yml` 使用私人設定。三首使用者提供的歌曲共有 27 個歌詞畫面，安排在聚會 2 正式開始之後，依八個項目分組，頁數隨內容及自動空白頁而定。私人 JSON 也已更新；之後建議只編輯 YAML，兩份檔案不會自動同步。
- `npm run build` 只複製明確列出的程式及 `examples/` 到 `dist/`，不包含 `private/`。將 **dist 裡的內容** 上傳至 `http://christorng.idv.tw/PresentShow/`；不要直接上傳整個專案。Git 忽略不代表網頁伺服器禁止存取。
- 直接載入範例：`http://christorng.idv.tw/PresentShow/?config=examples/sample.yml`。
- 遠端設定：`?config=https%3A%2F%2Fexample.com%2Fmeeting.json`。跨網域來源須允許 CORS；HTTPS 不能抓 HTTP 設定。相對素材 URL 以設定檔網址為基準。
- 網頁不能用網址任意讀取 `C:\…` 或 `file://…`。請本機選檔，並「選取素材資料夾」。檔案不會上傳或永久儲存，重整後須重新選取。
- 素材資料夾可包含 `media/song.mp3`、`images/logo.png`；設定檔使用相同相對路徑，選取共同根資料夾。不支援 `../` 跳出選取的資料夾。
- 建議桌面 Chrome／Edge。HTTP 部署可使用選檔與資料夾輸入，不依賴需 HTTPS 的檔案系統 API。

## 編輯設定

主控台「編輯 YAML」可修改、套用、下載設定；仍接受原本 JSON。「編輯歌詞」可直接貼純文字，免處理縮排。修改只在本次工作階段有效，請下載保存。拖曳可排序一般頁面、或同一輪播內的頁面；跨項目／輪播搬移與加減頁面請改各項目的 `sequence`。歌詞分頁請修改空行，整首歌曲順序請修改 sequence 的 song 項目。

直接編輯 YAML 會保留註解及排版；透過歌詞／背景面板或拖曳修改時，會重新產生 YAML，原註解不保留。YAML 的 `#RRGGBB` 色碼、帳號與時間建議加引號，避免誤判成註解或數字。以下舊 JSON 範例仍可使用。

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

`fit: "original"` 保持原尺寸，太大才等比例縮小；`"contain"` 等比例放大／縮小至螢幕內，不裁切。透明區顯示持續背景。`examples/welcome.svg` 是原創透明範例。私人流程已使用 pray 資料夾中的圖片，並以 `media: keep` 延續第一首音樂；公開範例使用一般示範圖片。

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

## 背景：固定 seed、雙色與動畫

預設為明亮奶油色／淺藍色，速度比舊版明顯。使用背景面板即可選色、改 seed 與速度；也可直接寫 YAML：

```yaml
background: dawn
backgrounds:
  dawn:
    type: abstract
    seed: sunday-2026
    colors: ["#fff2d5", "#d8ecff"]
    deviation: 20
    speed: 1
    motion: 1.3
    colorMotion: 1
    blobs: 7
    blur: 70
  sky:
    type: ribbons
    seed: open-sky
    colors: ["#e1f5ff", "#e8e1ff"]
    speed: 0.8
  photo:
    type: image
    src: images/background.jpg
    fit: cover
  film:
    type: video
    src: media/background.mp4
    fit: cover
```

| 設定 | 意義 |
| --- | --- |
| `type` | `abstract` 流動色雲、`ribbons` 柔光絲帶、`mist` 晨光霧幕、`solid` 靜態雙色、`image` 圖片、`video` 影片、`audio-reactive` 隨音樂柔和變化 |
| `seed` | 任意文字或數字；相同 seed、參數與動畫時間產生相同的色塊／軌跡，不使用 Math.random |
| `colors` | 兩個 `#RRGGBB` 色碼；色彩沿兩者的 RGB 漸層生成 |
| `deviation` | 0–100 的百分比；20 代表插值參數範圍 −0.2～1.2，即沿雙色漸層向兩端各延伸 20%，RGB 最後限制在 0–255。不是每個色相任意偏移 20% |
| `speed` | 0–10；1 為每輪約 28–50 秒，2 約快一倍，0 停止動畫 |
| `motion` | 0–3，控制平移、旋轉、縮放幅度 |
| `colorMotion` | 0–1，控制每個色塊在時間上的變色幅度；0 保持各自初始顏色 |
| `blobs` | 0–20，色塊數量 |
| `blur` | 0–200，1920 寬畫面的模糊基準值；隨螢幕等比例縮放 |
| `fit` | 圖片／影片的 `cover` 填滿但可能裁切，或 `contain` 完整顯示 |

動畫自動運行，與前景播放／暫停互相獨立。不想動時可設 speed 為 0 或選 solid。顏色若接近，變色自然较柔和；可降低 blur、提高 motion 或拉開兩個色碼差異。固定 seed 保證生成參數與時間軌跡相同，瀏覽器色彩管理／模糊渲染仍可能有細微像素差異。

背景圖片與影片都支援本機素材資料夾／URL；背景影片固定靜音、循環播放，聲音由前景音樂控制。範例的 film 需要自行提供 `media/background.mp4`，picture 則附有可立即使用的 SVG 示範。

### 在任一頁切換，其他頁繼承

背景設定會沿流程向後延續，直到下一個明確設定；直接跳頁也依流程計算正確背景，不依賴操作歷史。

```yaml
sequence:
  - blank
  - page: pray1
    background: dawn
  - song: 1
    background: sky
    backgroundAt:
      4: dawn  # 這首歌的第 4 頁開始換背景
  - page: main8
    background: film
  - blank      # 影片繼續，不重頭播放
```

主控台「從此頁切換背景」會把切換點寫進設定，連歌曲內部頁面也支援；「調整顏色與動畫」沿用名稱會修改同名背景，改成新名稱可建立新樣式。換背景不會中斷前景音樂。

同一背景跨頁保留原 DOM、動畫及影片播放器。更換背景樣式、同名背景參數或素材來源時才重建。切去另一個背景後再切回，會從 seed 的初始動畫相位重新開始；新開投影視窗則接續目前背景時間。前景全螢幕影片會遮住背景，但不銷毀背景。

### 擴充 JS／CSS 背景

1. 在 `src/backgrounds/config.js` 的 `BACKGROUND_STYLES` 加入新 type 與 label／預設值。
2. 在 `src/backgrounds/index.js` 用 `registerBackgroundStyle(type, factory)` 註冊。factory 收到 `{root, config, epoch, onError}`，可自行建立 CSS、Canvas 或 JS 動畫。
3. factory 回傳 `destroy()` 清理動畫、計時器與資源；可選擇回傳 `resume()` 處理使用者啟用播放，或 `audio({level,pitch,bass,treble})` 接收音訊分析。epoch 是本背景開始的毫秒時間，隨機請使用 `seededRandom(config.seed)`。
4. 新程式放在 `src/`，建置會完整複製此目錄。YAML 只選擇已註冊 type，不執行外部或設定檔內的任意 JS。

## 純文字歌曲與快捷鍵

在「編輯歌詞」直接貼以下形式。`# 歌名` 開始新歌，一個或多個空行就是換頁；頁內換行保留。段落標記本身不投影，空白也不會產生空頁。`X4` 等文字會原樣呈現，不會自動複製頁面。

```text
# 第一首歌

[Verse]
第一頁第一行
第一頁第二行

第二頁歌詞

[Chorus]
副歌第一頁

[Verse]
另一段主歌

# 第二首歌

沒有標記的歌詞
一樣可以分頁
```

- **v** → 預選下一個 `[Verse]` 起點；**p** → `[Pre-Chorus]`；**c** → `[Chorus]`；**b** → `[Bridge]`。也支援 I／O／T／E 對應 Intro／Outro／Tag／Ending，或中文主歌／導歌／副歌／橋段。
- 同一類段落有多個時預選後面的起點，沒有下一段就回到第一段；只有一段就回到該段第一頁。段落裡因空行產生的續頁仍使用左右鍵，不會被當成新的段落起點。
- 只在**目前這一次播放的歌曲內**跳轉，不會跳去其他歌曲。未標記的歌曲視為一段 Verse。找不到指定類型則保持目前頁面。
- 段落鍵也可在投影視窗操作。輸入欄、下拉選单、編輯器與 Ctrl／Cmd 快捷鍵不會觸發歌曲跳轉。
- 「套用歌詞」保留既有歌曲的流程位置，新增歌接在既有歌曲後；原本沒有歌曲則加至流程末尾。先以標題對應；同歌數改名時用原位置對應。刪掉的歌曲會移出流程。套用後請在「編輯 YAML」下載保存。

完整 YAML 可以把整份歌詞放在 `songs: |` 下方，所有歌詞行統一縮排兩格：

```yaml
songs: |
  # 第一首歌
  [Verse]
  第一頁歌詞

  第二頁歌詞

  # 第二首歌
  [Chorus]
  副歌歌詞

sequence:
  - song: 1
  - song: 2
```

`song` 是歌詞文件中的 1 起算順序，也可填完整歌名。同一首歌可重複出現在 sequence；每次有独立快捷鍵範圍。各首歌第一頁預設停止上一段媒體；若要延續則在 song 項目加 `media: keep`，或指定 media 物件播放這首歌的伴奏。

## 驗證

`npm test` 檢查日期、輪播、媒體繼承、背景 seed／色彩範圍／切換繼承、YAML、多歌曲分頁與快捷鍵循環。`npm run build` 產生不含私人資料的靜態部署目錄。YAML 使用隨附的 js-yaml（版本記在 package-lock.json，授權在 src/vendor/js-yaml.LICENSE）。YouTube 可否嵌入依影片與網路環境決定。

## 分組主控台、空白頁與轉場

頂端整合為一列工具列；投影按鈕綠色表示未連線，紅色表示已連線，按下可前往投影視窗。左側是項目導覽，右側縮圖按項目分組。底部整條是目前播放預覽、控制、下一頁預覽。縮圖區獨立捲動，播放控制固定可見。點左側項目可預選其開頭並捲至該項目，再點同項目即可播出。

新的設定使用 sections 取代最外層 sequence；舊格式仍可讀取。每個項目的 sequence 可以混合一般頁、輪播與歌曲：

```yaml
transition: { type: fade, duration: 0.1 }
sections:
  - id: prepare
    title: 活動預備
    background: dawn
    sequence: [welcome]
  - id: first-song
    title: 第一首歌
    background: film
    sequence:
      - song: 1
  - id: third-song
    title: 第三首歌
    background: film
    transition: { type: fade, duration: 0.3 }
    sequence:
      - song: 3
```

每個項目預設自動加開頭、結尾純背景頁。相鄰項目背景相同時，共用前項結尾空白頁；背景不同時，保留兩張，分別顯示前、後背景。直接跳頁也會套用正確背景。需要完全手動安排可在項目設 bookends: false。

轉場沿流程繼承，直到下一個明確設定；可放在最外層、項目、頁面或 sequence 引用。歌曲可用 transitionAt: { 4: 0.3 } 指定第 4 頁起的轉場。type: none 可取消。私人設定第三首整組為 0.3 秒，奉獻項目明確恢復 0.1 秒。換背景也使用同一淡入淡出設定；相同背景不重建。

歌詞中心放在螢幕高度 29%，以便站立時後排觀看。歌詞預設有淡色半透明底框，同一首按最寬文字決定固定寬度；lyricStyle: shadow 改成無方塊的白字、深色陰影與細描邊。圖片素材內的文字仍由原始圖片決定。

## 和緩的音樂律動背景

```yaml
backgrounds:
  quiet:
    type: audio-reactive
    seed: quiet-room
    colors: ["#fff1d6", "#dcefff"]
    deviation: 12
    speed: 0.22
    motion: 0.4
    colorMotion: 0.55
    sensitivity: 0.8
    response: 0.96
pages:
  quiet-music:
    type: media
    background: quiet
    media: { kind: audio, src: media/quiet.mp3, loop: true }
```

分析目前音檔的音量與主要頻率，經平滑處理後微調色雲大小、位置、透明度與色彩；不做快速閃爍。sensitivity 控制反應強度，response 越接近 1 越緩慢。音樂暫停時會柔和回復，原本色雲動畫仍持續。私人第二首音樂已使用此樣式。

本機選取素材、同源音訊可直接分析。跨網域音檔需來源允許 CORS，且 media 設 cors: true；YouTube 嵌入播放器無法取得聲音樣本，仍可顯示基本動畫。首次播放可能需按「啟用播放／聲音」。公開範例附原創合成音檔可測試。

## 程式結構

- src/config：YAML／JSON、歌曲分頁、項目與空白頁、繼承規則、編輯操作。
- src/backgrounds：背景定義、固定 seed 與可擴充的背景播放器。
- src/player：媒體、音訊分析與前景轉場。
- src/ui、src/styles：分組縮圖與畫面樣式。
- src/app.js：主控台與投影視窗協調。
- tests：設定、媒體繼承、快捷鍵、分組邊界、轉場與音訊分析測試。

本機伺服器支援影片範圍讀取與拖曳進度；可透過 PRESENTSHOW_PORT 環境變數改連接埠。靜態部署仍不需要 Node.js。

## 預選下一頁與播出

- 縮圖／左側項目：第一次點選只更新下一頁預覽；再次點同一頁即播出，兩次不必快按。改點不同頁則改變預選。
- 小寫 v/p/c/b：只預選。慢按同鍵會循環不同段落；同鍵兩次間隔不超過 320 毫秒，第二次直接播出首次預選的段落。
- 大寫 V/P/C/B（Shift 或 Caps Lock）：直接跳到目前播放位置的下一個同類段落。
- → 或「播出 →」：播出預選頁；没有預選時走順序下一頁。← 返回順序上一頁。Esc 取消預選。
- 自動輪播時間到時，若有手動預選則優先採用；否則遵循原輪播設定。
- 空白键仍為播放／暫停。預選不會暫停、重設或替換目前的媒體。
- 同一標記下的分頁顯示 Verse 1-1、Verse 1-2 等。只有標記起點顯示字母；橘色粗體是下一次小寫鍵可預選的位置，灰色表示其他起點。目前頁與目前預覽固定綠框；下一頁與下一頁預覽固定黃框。歌曲首尾空白頁也能使用段落快捷鍵。

## 歌曲標題與歌詞樣式

每首歌新增一張標題頁，仍保留項目開頭的空白背景頁。中英文與右下角作者／專輯資訊集中在 songMeta，以歌曲順序對應：

```yaml
songMeta:
  1:
    title: 迎向晨光
    english: Morning Light
    credit: 示範創作團隊 · 示範專輯
  2:
    title: 分享美好
    english: Share the Good
    credit: 示範創作團隊
    lyricStyle: shadow
```

未提供資料時標題使用原 # 歌名，英文與出處留白。可用 songTitlePage: false 關閉全部歌曲標題，或在個別 song 項目设 titlePage: false。backgroundAt / transitionAt 的頁碼仍只計算歌詞頁，不把標題頁算進去。空白頁沒有顯示名稱，縮圖只留序號。

## 多頁長文字

在項目的 sequence 放 text: |，空行即換頁。每頁自動顯示項目名稱及目前／總頁碼；內文以較小邊界、自動字級盡量填滿畫面。

```yaml
sections:
  - id: sharing
    title: 今日分享
    background: dawn
    transition: 0.1
    sequence:
      - text: |
          1. 第一頁完整內容。
          這一行仍在同一頁。

          2. 第二頁完整內容。
```

以上顯示 1/2、2/2；有四段則顯示 1/4～4/4。未填的內容可先保留 xxx，之後直接編輯文字。新增文字項目與歌曲一樣自動處理開頭／結尾背景頁。

## 保留 Windows 工作列的最大化

一般網頁無法要求 F11 隱藏頁籤與網址列，同時保留系統工作列。可在 Edge 選「… → 其他工具 → 應用程式 → 將此網站安裝為應用程式」，再使用視窗最大化；正常工作列仍可保留（依系統的自動隱藏設定）。此方式不提供 F11 的移到頂端顯示頁籤效果，可用 Alt+Tab 切換視窗。參考 [Microsoft 官方說明](https://support.microsoft.com/en-us/edge/install-manage-or-uninstall-apps-in-microsoft-edge)。

## 原始 YouTube 監看與投影遮蔽

YouTube 官方 IFrame API 沒有廣告開始／結束事件；播放時間停在 0 也可能是載入或暫停，中途廣告亦不一定歸零。因此不以時間推測後自動恢復聲音。播放器出現可略過廣告按鈕時，請在原始監看視窗操作。

1. 正式播放前，開啟投影視窗及「原始 YouTube 監看」。
2. 按「分享監看分頁」，在瀏覽器選擇剛開啟的原始監看視窗／分頁；不要選主控台，避免畫面遞迴。分享不包含聲音，音樂仍只由原播放器輸出。需要 localhost 或 HTTPS；一般 HTTP 網站不能分享。
3. 原始監看使用同一個 YouTube 播放器。遮蔽時，觀眾看封面／歌名、聲音靜音；控制端仍能看到分享的原始畫面。此時目前預覽刻意顯示監看來源，並非觀眾看到的封面。
4. 確認正式內容開始後，按「恢復聲音與畫面（F8）」。F8 可隨時再次遮蔽。可勾選每次新 YouTube 影片先遮蔽。中途廣告仍需操作人員監看。
5. 停止分享時會立即靜音並遮蔽。關閉原始監看則回到一般投影播放器，可能重新載入影片。

沒有分享時使用封面與可編輯歌名，不建立第二個 YouTube 串流。媒體設 `label` 可指定歌名，`autoTitle: true` 嘗試讀取 YouTube 公開標題；失敗時保留原標籤。原始監看模式需先分享才能恢復投影。畫面分享由瀏覽器要求使用者選取，程式不會自動選擇螢幕。

## 服事表、QR 與音樂轉場

文字服事表可直接編輯角色及姓名，日期沿用同一變數：

```yaml
pages:
  roster:
    type: text
    layout: roster
    heading: "{{date}} 服務團隊"
    media: keep
    columns:
      - rows:
          - { role: 主持, name: 林小晴 }
          - { role: 音樂, name: 陳小光 }
      - rows:
          - { role: 接待, name: 王小禾 }
  quiet:
    type: text
    background: quiet
    crossfade: 2
    exitCrossfade: 2
    blocks: [{ kind: title, text: 靜默 }]
    media: { kind: audio, src: media/quiet.mp3, loop: true }
```

`crossfade` 指進入該頁時，上一段及新音樂同時淡出／淡入的秒數，畫面同步轉場；`exitCrossfade` 指離開時的秒數。媒體需先完成載入，受網路／自動播放限制時仍可能停頓。`media: keep` 頁不重建播放器。

頁面加入 `qr: images/qr.png` 即顯示右上角 QR 圖，文字保留空間。公開範例 QR 指向 example.com。輪播範例每頁五秒，`autoStart: false` 可改回手動啟動；預備心為手動頁。長文字的數字列點採凸排，換行與內文對齊。縮圖與投影共用前景排版，頁碼／Verse 提示僅覆蓋縮圖底部，預覽保持乾淨；操作錯誤訊息集中在中央控制區。
