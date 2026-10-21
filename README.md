# PresentShow

純前端聚會投影工具：繁體中文主控台、YAML／JSON 設定、純文字歌詞、獨立投影視窗、固定 seed 的動畫背景、YouTube／音訊／影片控制。不需服務端；YAML 解析器已隨網站附帶，日常使用不需安裝套件。

## 開始使用

1. 安裝 Node.js 20 以上，執行 `npm start`，開啟 http://localhost:4173 。不要直接雙擊 HTML，瀏覽器會限制模組、設定檔與 YouTube。
2. 選示範、本機 YAML／JSON，或輸入設定檔網址。
3. 按「開啟投影視窗」，拖至第二螢幕，點「全螢幕」或雙擊畫面。
4. 點縮圖預選、再點同頁播出；左右鍵換頁；空白鍵開始／暫停媒體與輪播。輸入欄及編輯器保留原本鍵盤行為。
5. 播放遭阻擋時，在投影視窗點「啟用播放／聲音」。YouTube 也可能因擁有者禁止嵌入、地區、登入或網路而無法播放。

只有一處播放聲音：未開投影視窗時由預覽播放；開啟後移交播放位置。第一次開啟／關閉投影視窗需要重建播放器，可能短暫停頓，建議正式播放前先開好。正常切換 `media: "keep"` 頁面不重建播放器、不歸零。本機影片預覽靜音同步播放進度；YouTube 預覽顯示封面與歌名，不建立第二播放器或分享畫面。

進入輪播自動開始倒數，控制區顯示剩餘秒數與進度條。可暫停本頁，換頁後恢復倒數。右鍵播出下一頁預覽（含輪播回跳）；左鍵返回順序上一頁。「純背景」暫時隱藏前景、保留聲音並暫停倒數，再按一次恢復。媒體可獨立播放／暫停、拖曳進度、調整音量與循環。

## 私人設定與部署

- `examples/sample.yml` 是完整公開示範，包含三首一般示範文字、命名背景與播放流程。`examples/sample.json` 保留原始 17 頁範例；兩種格式都可用。YouTube 使用官方 API 範例影片。
- `private/`、`*.private.json`、`*.private.yml`、`*.private.yaml` 由 `.gitignore` 排除。私人檔可在入口本機選檔，不需上傳。
- 在本機可開啟 `http://localhost:4173/?config=private/20260920/church.private.yml` 使用私人設定。三首使用者提供的歌曲共有 27 個歌詞畫面，安排在聚會 2 正式開始之後，依八個項目分組，頁數隨內容及自動空白頁而定。私人 JSON 也已更新；之後建議只編輯 YAML，兩份檔案不會自動同步。
- `npm run build` 只複製明確列出的程式及 `examples/` 到 `dist/`，不包含 `private/`。將 **dist 裡的內容** 上傳至 `http://christorng.idv.tw/PresentShow/`；不要直接上傳整個專案。Git 忽略不代表網頁伺服器禁止存取。
- Vercel 使用 `vercel.json` 指定純靜態網站（Framework Preset：Other）、`npm run build` 與輸出目錄 `dist`，避免將瀏覽器程式誤判為 Node 服務。正式站台為 https://present-show.vercel.app/，主唱介面為 https://present-show.vercel.app/src/leader/singer.html；之後預覽及分享皆使用 Vercel，不使用 raw.githack.com。
- 直接載入範例：`http://christorng.idv.tw/PresentShow/?config=examples/sample.yml`。
- 遠端設定：`?config=https%3A%2F%2Fexample.com%2Fmeeting.json`。跨網域來源須允許 CORS；一般 HTTPS 頁面不能抓 HTTP 設定，本機 loopback 來源由瀏覽器的本機網路權限管理。相對素材 URL 以設定檔網址為基準。
- 網頁不能用網址任意讀取 `C:\…` 或 `file://…`。請本機選檔，並「選取素材資料夾」。檔案不會上傳或永久儲存，重整後須重新選取。
- 素材資料夾可包含 `media/song.mp3`、`images/logo.png`；設定檔使用相同相對路徑，選取共同根資料夾。不支援 `../` 跳出選取的資料夾。
- 建議桌面 Chrome／Edge。HTTP 部署可使用選檔與資料夾輸入，不依賴需 HTTPS 的檔案系統 API。

### 線上網站讀取本機私人設定與素材

在專案目錄執行 `npm start`（修改伺服器後需重新啟動），再從 Vercel／GitHub Pages／個人網域的設定網址欄載入 `http://localhost:4173/private/20260920/church.private.yml`。也可直接開啟：

https://present-show.vercel.app/?config=http%3A%2F%2Flocalhost%3A4173%2Fprivate%2F20260920%2Fchurch.private.yml

請允許 Chrome／Edge 提示的「本機網路存取」權限；若已封鎖，請到該網站的網站權限修改後重新載入。公開網站需使用 HTTPS 才能取得這項權限。localhost 指開啟網頁的那台電腦，手機無法透過這個網址讀取電腦上的素材。

本機伺服器只監聽 `127.0.0.1`，預設允許以下 origin 讀取（不含網站路徑）：

- `https://present-show.vercel.app`、`https://present-show-christorngs-projects.vercel.app`、`https://present-show-git-main-christorngs-projects.vercel.app`
- `https://christorng.github.io`（涵蓋其下所有 GitHub Pages 專案路徑）
- `https://christorng.idv.tw`、`http://christorng.idv.tw`（HTTP 來源仍受瀏覽器安全限制）
- 本機伺服器自己的 `http://localhost:<port>` 與 `http://127.0.0.1:<port>`

支援 GET／HEAD／OPTIONS、影片 Range 請求及舊版 Private Network Access 預檢。其他 origin 回應 403。需要額外的 Vercel 預覽網域或其他個人網域時，以 PowerShell 設定完整 origin 清單再啟動：

```powershell
$env:PRESENTSHOW_CORS_ORIGINS = 'https://your-preview.vercel.app,https://www.your-domain.example'
npm start
```

透過 localhost 網址載入 YAML 後，`pray/273480.jpg` 會解析為 `http://localhost:4173/private/20260920/pray/273480.jpg`，影片與 QR code 也依同樣規則解析。檔案由本機提供，不會上傳至網站主機。若使用「選取本機 YAML」按鈕，瀏覽器無法提供設定檔所在資料夾，需另外選取 `private/20260920` 素材資料夾；只選 YAML 會把未對應的相對素材網址解析到線上網站，導致 404。

## 歌曲只編輯一份，實際播放可重複編排

主控台直接使用原本的 `index.html` 與整份聚會設定。當設定有 `leaderPlans`，同一首歌曲會依規劃的唱法自動展開成所有播放頁；歌詞只保存在 `songs`。例如：

```yaml
songs: |
  # 晨光相聚
  [Verse]
  晨光照亮窗邊
  今天又是新的開始

  [Chorus]
  一起分享這份喜悅
  讓希望在心裡發芽

leaderPlans:
  '1': 前奏-主歌-副歌-主歌-副歌-副歌-尾奏
sections:
  - id: songs
    title: 晨光相聚
    sequence:
      - song: 1
```

主控實際出現完整的「前奏 → 主歌 → 副歌 → 主歌 → 副歌 → 副歌 → 尾奏」，Leader 也依同一條已展開的路徑同步。英文段落標記 `[Verse]`、`[Chorus]` 與中文 `[主歌]`、`[副歌]` 均支援，主控與 Leader 一律顯示中文。

如需調整某一個重唱位置，點「建立播放編排」，即把目前歌曲安排存為個別頁面的 **引用清單**，例如：

```yaml
sequence:
  - song: 1
    arrangement:
      - utility: 前奏
      - {section: 主歌, page: 1}
      - {section: 副歌, page: 1}
      - {section: 主歌, page: 1}
      - {section: 副歌, page: 1}
      - {section: 副歌, page: 1}
      - utility: 尾奏
```

此處不複製歌詞，僅指定來源段落與頁碼。主控縮圖支援拖曳改順序、按住 Ctrl 拖曳複製、選取後 Delete 刪除，也可透過縮圖的 ⋯ 選單進行複製／移動／刪除。調整僅限同一首歌內的實際播放引用；如需調整整首歌曲、跨流程移動，仍編輯 YAML 的 `sections[*].sequence`。修改後用「編輯 YAML」→「下載設定檔」保存。

私有 YAML／JSON 不用重做也不用公開。直接載入本機私有設定：原有 `songs`、`sections` 與頁面會保留；按「建立播放編排」即為每首歌建立可拖曳的 `arrangement`，舊設定沒有 `leaderPlans` 時則從原來每段依序展開。可在 YAML 中補上 `leaderPlans` 或直接編輯引用清單，再下載到本機。編輯原始歌詞仍只要一份，引用會使用更新後內容。

下方控制區可拖曳分隔線調整高度，右側為加寬的純文字下一頁歌詞／段落預覽（不顯示投影背景），高度偏好會記在瀏覽器本機。

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

## 主唱手機介面（設計原型）

四個 HTML 頁面、專用 JavaScript、共用歌曲資料與 `styles/` 樣式集中在 `src/leader/`，建置時保留相同目錄。Vercel 的舊 `/singer.html`、`/singer1.html`、`/singer2.html`、`/singer3.html` 網址會永久轉址到新位置；本機及其他靜態主機請使用新路徑。

開啟 https://present-show.vercel.app/src/leader/singer.html 或 `http://localhost:4173/src/leader/singer.html`。目前是獨立的 UI 設計原型，尚未接入主控台、投影視窗或跨裝置同步。歌詞及空行分頁沿用提供的聚會設定；不包含私人設定或素材。

第一版也可由 `src/leader/singer1.html` 開啟，與 `src/leader/singer.html` 相同。區段標題、歌詞、狀態及頁次文字已放大，歌詞保留原始分行，右側超出時漸淡隱藏，不自動折行；原有多頁橫滑及預備操作仍可使用。第一版的放大樣式獨立於第二、三版。

有足夠高度時，第一版將大按鈕的一小部分留白分給「之後」與底部提示按鈕，讓兩排更高、字更大；大按鈕內的原字級維持不變。頁次使用與所在歌詞頁相同的不透明底色，覆蓋下方歌詞，避免文字重疊。

- 歌曲數字使用 `1/3`。切換歌名只瀏覽該首的編排及歌詞，不切換目前播放。
- 演唱路徑集中在上方三排：已唱過；前一個／目前／下一個／下下一個；之後。每次重複段落都有獨立項目，第一首採指定的 16 段順序，第二、三首有範例；尾奏接下一首前奏，第三首尾奏接結束。
- 所有路徑、段落及歌詞頁按鈕都只預備；預覽內部倒數每五秒推進一頁，不提供秒數、模擬列或額外電腦面板。正式播放將由投影端回報換頁，預備線保留為設計示意。
- 按大段落按鈕若與預計下一段相同，保留原順序；不同則在原下一段前插入，播出前改選會取代尚未播放的插入。點已唱過項目，會預備複製從該項到目前的已走過路徑；點目前項目可重唱。點未來項目預備跳到該處，略過項目不會被標為已唱過，仍可點選。
- 已唱過項目使用淡字與段落代表色底線，未唱使用深字色框；目前歌詞頁與下一頁、下一段使用同段落色系的深淺框。寬螢幕並排多頁，窄螢幕橫滑閱讀，播放換頁會將目前歌詞頁帶入視野。段落播放完畢後恢復顯示第一頁。
- 手機只使用預設順序，不提供編排編輯器；日後將由電腦端編排並同步。大按鈕平均填滿剩餘高度，字體隨高度縮放，歌詞可裁切但不提供直向捲動。頁次疊在歌詞右下角，上方目前項目僅顯示「目前 1/2」與段落名稱。

另一個手機排版原型位於 `src/leader/singer2.html`，原版 `src/leader/singer.html` 保留。第二版不顯示歌詞，也不提供頁面按鈕；整塊大按鈕用來預備段落，多頁段落以頁次顯示目前進度，未播放時回到第一頁。主歌左右並排在第一排、前副歌與副歌在第二排、小副歌在第三排，沒有小副歌時僅兩排；上方編排放大為三排，前一段併入已唱過區域。

第三版 `src/leader/singer3.html` 保留第二版的控制列與分組，區段名稱（如「主歌1」）與小字頁次靠上同列、分別靠左及靠右。整頁共用一致字級，標題最大、歌詞次之、頁次最小；跨歌曲共用字級基準，不會因單顆按鈕較寬就放大。歌詞固定為區段開頭：兩排按鈕顯示前兩行、三排顯示第一行，第一頁不足兩行時接第二頁開頭，不隨播放翻頁改變，只有頁次更新。歌詞維持不折行，右側超出的文字漸淡隱藏。整塊按鈕仍只預備區段。

頁次會依最長標題旁的剩餘寬度自動放大，整頁維持相同字級。按鈕多出的高度分配到標題上方、標題與歌詞之間及歌詞下方，較高的按鈕會有較多分區留白，兩行歌詞的行距保持緊密；短螢幕則先保留標題及歌詞可讀的高度。

## 程式驗證

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

## 手動緊急靜音與遮蔽

F8／緊急按鈕立即靜音，在投影中央顯示封面／歌名，四周留 5 CSS px 原始畫面供人工觀察。再次按 F8，以兩秒淡出遮罩並淡入音量；恢復期間再按一次會立即回到靜音遮蔽，不會等待動畫完成。播放器持續運行，不換來源、不暫停也不自動判斷廣告。

已移除原始監看、螢幕分享、自動提前循環與自動音量偵測。一般播放只每秒讀取進度，不修改 YouTube 音量或位置；音量僅在使用者操作／明確頁面轉場時變更，且相同數值不重複寫入。循環勾選只在影片真正結束後重播。網路緩衝或 YouTube 服務本身仍可能影響播放。

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

### 排版與自訂標題

媒體 `label` 優先於自動取得的標題；只有 label 留空且 autoTitle: true 才查詢 YouTube。固定聚會日期請設定 variables.date（例如字串 `2026/9/20`）。服事表連續 rows 可各加 `group: 樂團`，顯示共同群組標記；role 靠右對齊。QR 可寫成 `qr: { src: images/qr.png, size: 21 }`，size 是畫面寬度百分比（8–30）。歌詞依各首最寬文字估算統一字級，底框寬 90%；長文字最大字級為畫面寬度的 3.5%。英文歌名以每個單字首字母放大的小型大寫呈現。


## 嵌入網頁與 Canva

頁面支援 type: web、src: HTTPS 網址。Canva edit 網址會轉為 view?embed 檢視模式；設 embed: false 可保留原網址，但編輯網站可能禁止被嵌入。網頁填滿原投影視窗，沒有 PresentShow 背景；離頁立即移除 iframe，也停止該頁的網頁內容。

報告項目設 bookends: false，下一項可設 startBlank: false，避免自動空白页。

跨網站 iframe 無法由主控台讀取頁面、轉送模擬 PgUp/PgDn 或自動按 Ctrl+Alt+P。請先開投影視窗並全螢幕，再按「聚焦投影網頁」或直接點一下投影中的 Canva，讓投影筆鍵盤輸入交給 Canva。實際按鍵依投影筆型號及 Canva 支援而定。嵌入檢視通常不需要編輯器的簡報快捷鍵；若要啟動 Canva 自己的全螢幕，需在該網頁內操作。

回主控台按下一頁會卸載內嵌網頁、回到 PresentShow。控制端只顯示報告項目提示，不聲稱同步 Canva 當前頁。若 Canva 權限／防嵌入限制擋住內容，請在 Canva 取得可用的嵌入連結，或按「另開原網頁」自行播放；另開分頁時須自行切回投影視窗。程式不修改 Canva 分享權限。

### YouTube 播放穩定性

YouTube 狀態只在播放器 ready/state-change 事件讀取，沒有定時 API 查詢、廣告偵測、自动靜音或提前跳回。進度條在事件之間以本機時間估算，可能與實際秒數稍有差距；估算不會回寫播放器。循環只在影片正式結束時執行。手動播放、暫停、拖曳、音量與 F8 遮蔽仍有效。

被媒體或網頁蓋住的背景暫停運作，離開時恢復同一背景；音訊分析只在本機音檔的律動背景啟動。這些措施減少本網站的播放干擾，但不能排除 YouTube、網路或瀏覽器造成的緩衝。

報告網頁進入、載入及投影視窗重新取得焦點時會嘗試聚焦 iframe。只要目前是 web 頁，投影視窗完全不攔截鍵盤（包括方向鍵、空白與 F8），即使焦點落在外層也不會跳出報告。請從控制台換頁或啟動緊急遮蔽。Canva 是否接受投影筆按鍵仍由其網頁決定。

YouTube 含延續音樂的圖片／服事表頁，一律改用原配色的靜態漸層；兩個預覽也不運作動態背景。播放器維持原尺寸、不透明且不重建，由靜態前景蓋住影片。結束 YouTube 段落才恢復設定的背景樣式。


## Leader 1／2／3：Cloudflare WebSocket 多裝置同步

已保留 `src/leader/singer1.html`、`singer2.html`、`singer3.html` 三種獨立 UI 原型，不再用 `src/leader/singer.html` 當 Leader。
正式同步入口為：
- `/leader1.html` → `src/leader/leader1.html`
- `/leader2.html` → `src/leader/leader2.html`
- `/leader3.html` → `src/leader/leader3.html`

UI 專屬程式放在 `src/leader/leader1.js`、`leader2.js`、`leader3.js`，共用 `leader-runtime.js`、`leader-sync.js`、`leader-sync-data.js`。
三個 Leader 接收的是主控 **實際載入 YAML／JSON 的歌曲內容**，預設順序依照原 Singer 測試資料；若有自己的歌詞，主控 YAML 可設定 `leaderPlans`：

```yaml
leaderPlans:
  1: 前奏-主歌1-前副歌-副歌-間奏-主歌2-副歌-尾奏
  2: 前奏-主歌-前副歌-副歌-尾奏
  3: 前奏-主歌1-主歌2-副歌1-副歌2-尾奏
```

示範使用 `examples/leader-demo.json`（三首歌及原預設完整演唱順序）。主控的「Leader 即時同步」提供連線代碼和 QR Code。Leader 可在其他 Wi-Fi、4G/5G 網路連線，不需要知道教會內網 IP；任何能取得該連線代碼的人都可以操作歌詞換頁，因此不要公開分享邀請連結。

### Cloudflare Worker 初次部署

1. 建立 Cloudflare 帳戶，啟用 Workers 免費方案；在 `cloudflare` 目錄執行 `npm install`、`npx wrangler login`、`npx wrangler deploy`。
2. `cloudflare/wrangler.toml` 已設定 SQLite Durable Object migration、Worker binding 與來源網域清單；若換新網域，請更新 `ALLOWED_ORIGINS` 後重新部署。若在 Cloudflare 有自訂網域，也可額外配置 Worker Route。
3. 將部署後的網址（例如 `https://present-show-sync.<account>.workers.dev`）填入 PresentShow 主控左欄的「Leader 即時同步」；按「啟用同步」，複製代碼或掃 QR Code。
4. Leader 開啟其中一種 `leaderN.html`。從 QR 進入時會自動帶入 Worker 網址及代碼；手動進入則需填入這兩項。
5. 主控載入歌詞設定後，Leader 就會收到歌曲、段落、播放順序、目前歌詞頁。任一 Leader 點選段落或歌詞頁，會發送指令給主控，再由主控換頁並廣播給所有 Leader。新加入、重新連線都會收到 Durable Object 保存的最新快照。
6. 主控停留在標題、開場、訊息、輪播等非歌詞頁時，Leader 顯示「目前不是唱歌階段」覆蓋畫面。部分 Singer 預設「前奏／間奏／尾奏」沒有對應的 PresentShow 歌詞投影片，目前這類提示只能預備，不能觸發主控換頁。

WebSocket 使用 Durable Objects Hibernation，既不需要主控開放防火牆的入站 Port，也不需主控長時間維持 HTTP 輪詢。Worker 與靜態網站獨立部署，並不限定 GitHub Pages 或 Vercel。QR Code 使用瀏覽器載入的 qrcodejs CDN 函式庫於本機產生；CDN 無法載入時仍可複製網址手動開啟，邀請網址不會送給 QR Code API 服務。

**資料傳輸說明：** 未啟用同步時，主控所載入的私人檔案不會送往同步服務。啟用後，歌曲歌詞、歌曲名稱、演唱順序與目前投影頁會經由加密 WebSocket 傳送到 Cloudflare Worker 並儲存在 Durable Object；其他非歌曲 YAML 設定、媒體檔案與主控密鑰不會出現在 Leader 快照。

**部署狀態：** GitHub 的 Worker 程式碼不是 Cloudflare 的正式部署。需要在 Cloudflare 帳戶執行上面的 Wrangler 步驟，才能讓 WebSocket 實際互連。
