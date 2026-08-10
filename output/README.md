# output — 完成物

## website/

**サイトのコード一式です。** ここを書き換えるとサイトが変わります。

- **`入力のしかた.md` を最初に読んでください。**
- `content/` … 部活・PJ・イベント・作品の中身（ここを書き換える）
- `public/photos/` … 写真の置き場
- `custom/` … 部活・PJ等が自分でデザインしたページ（`custom/README.md` 参照）

```
cd output/website
npm install     最初に1回だけ
npm run status  いま何が足りないかを見る
npm run dev     手元で見る（http://localhost:3000）
npm run build   サイトをつくる
npm run check   公開してよい状態か検査する
```

**GitHubにpushすると自動で公開されます。**
公開先：https://jinkinokino5-max.github.io/shinri-zemi/

⚠ 検査に通らないと公開されません（壊れたまま公開されるのを防ぐため）。

---

## このフォルダに無いもの

| 何 | どこ | なぜ |
|---|---|---|
| 団体の基本情報・MVV | `reference/学生団体基本情報.txt` | **これが唯一の正。**サイトはここから読んでいる |
| デザインの根拠 | `draft/デザイン大本資料_v1.md` | 「なぜこの色か」を後から辿れるようにするため |
| 制作の進め方 | `draft/ロードマップ.md` | |
| まだ聞けていないこと | `draft/必要情報更新.txt` | |

⚠ **MVV（Mission/Vision/Value）を変えるときは、まず `reference/` を直してください。**
サイト側と食い違うと、ビルドが止まるようにしてあります（文言が勝手に書き換わる事故を防ぐため）。
