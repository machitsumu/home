# 織造所｜Google Sheets 訂單後端設定

這個資料夾提供 GitHub Pages 使用的 Google Apps Script 後端。

## 架構

GitHub Pages → Google Apps Script Web App → Google Sheets + Gmail

Google Apps Script 負責：

- 產生 `YYYYMMDD + 3位流水號` 訂單編號
- 寫入 `Orders` 工作表
- 自動寄送訂單確認 Email
- 回傳訂單編號給 GitHub Pages
- 使用 Script Lock 避免同時下單造成流水號重複

Google 官方文件確認 Apps Script Web App 可透過 `doPost(e)` 接收 POST 資料，並可用 Content/HTML Service 回傳結果；Web App 可以設定為由部署者執行。citeturn0search1turn0search0

## 第一次設定

### A. 建立 Google Sheet

1. 建立一個新的 Google 試算表。
2. 工作表名稱可先保持預設，Apps Script 會自動建立 `Orders` 工作表。
3. 複製試算表網址中的 Spreadsheet ID。
4. 到 `Code.gs` 的 `CONFIG.SPREADSHEET_ID` 貼上 ID。
5. 填入：
   - `BANK_NAME`
   - `BANK_ACCOUNT`

### B. 建立 Apps Script

1. 前往 Google Apps Script。
2. 建立一個新的獨立專案。
3. 將本資料夾的 `Code.gs` 全部貼入。
4. 修改 `CONFIG`。
5. 儲存。
6. 手動執行 `setupSheet()` 一次並完成 Google 授權。

Apps Script 的寄信功能需要授權；Google 官方文件也說明 Mail service 可由 Apps Script 發送 Email。citeturn0search4turn0search5

### C. 部署 Web App

Apps Script：

`Deploy` → `New deployment` → `Web app`

建議：

- Execute as：**Me / 部署者**
- Who has access：**Anyone**

部署完成後取得 `/exec` 網址。

Google 官方文件說明 Web App 必須有 `doGet(e)` 或 `doPost(e)`，並可設定執行身份與存取權限。citeturn0search1turn0search6

### D. 回到 GitHub Pages

將 Apps Script 的 `/exec` 網址填入網站前端設定，例如：

```js
const ORDER_API_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
```

這一步要等 Apps Script 部署完成後再做。

## Orders 欄位

目前預留：

1. 訂單編號
2. 訂單日期
3. 訂購人姓名
4. Email
5. 聯絡電話
6. 訂購項目
7. 商品小計
8. 運費
9. 訂單總金額
10. 7-11 收貨門市
11. 付款狀態
12. 訂單狀態
13. 匯款末5碼
14. 備註
15. Email寄送時間

其中：

- 付款狀態預設 `待付款`
- 訂單狀態預設 `新訂單`
- 匯款末5碼由你收到 LINE 回覆後手動填入

## 注意

目前 `index.html` 尚未接上這個 API。這次先建立後端，確認 Google Sheet、Email 與 Web App 都能正常工作後，再修改 GitHub Pages 前端。

不要把銀行密碼、Google OAuth token、API secret 等敏感資料放進 GitHub Pages 前端；GitHub Pages 的 JavaScript 是公開的。
