# Apex

<img src="public/logo.png" width="32" height="32" alt="Apex" />

Apex 是一个混合健身小站。第一次打开先问身高、体重、训练基础和目标，之后每次打开直接给出今天的训练：热身、力量、徒手、拉伸。

Apex is a small hybrid-training page. The first visit asks for height, weight, training base, and goal. Later visits open straight onto today's plan: warm-up, strength, bodyweight, and stretching.

## 今天的训练

页面把资料存在这台设备的 localStorage 里。顶部可以修改资料，保存后会按新资料重新生成。**换一换**用同一次打开里的计数再排一版（`2026-11-24|175|70|foundation|muscle#1`），刷新后回到日期种子。**回到今日**去掉这个计数。

`generatePlan` 的种子是本地日期（`YYYY-MM-DD`）加上身高、体重、基础和目标。同一天、同一份资料，得到同一组动作。

顺序固定：

1. 3 个热身
2. 3 个力量，每个 3 组。次数看目标：增肌 10、减脂 12、力量 8。计时动作（例如平板支撑）保持原来的秒数，仍然 3 组
3. 2 个徒手动作，只从 HIIT 和 HYROX 里挑器械为「徒手」或「自重」的条目（含「徒手（替代…）」），不要雪橇、划船机这类器械
4. 2 个拉伸

规则：

- 一组里不重复同一个动作
- 3 个力量动作的 `muscleGroup` 各不相同，因此相邻力量动作也不会是同一肌群
- 新手不会排到强度 3
- BMI = 体重（kg）/ 身高（m）²。`BMI_HIGH_THRESHOLD` 是 24，大于等于 24 视为偏高（中国成人标准），这时不排 `jumping: true` 的动作
- 动作库本身不会被改动
- 某一段不够排满时，返回较短的一组，并提示「可用动作不够」，不抛错

热身和拉伸按库里的默认次数或秒数做一遍。徒手动作也用库里的默认剂量，做一遍。

`muscleGroup` 用来区分力量动作的侧重，不是完整的解剖标签。

## 怎么跑

需要 Node.js 22+。

```bash
npm install
npm run dev
npm test
npm run build
```

`npm run dev` 启动 Vite。`npm test` 跑一遍 Vitest。`npm run build` 会做类型检查，并把静态文件写到 `dist/`。GitHub Pages 的 `base` 是 `/apex/`，本地开发仍是 `/`。

## 预览

[https://student-bu.github.io/apex/](https://student-bu.github.io/apex/)

推到 `main` 后，GitHub Actions 会跑测试和生产构建，再把 `dist/` 部署到 GitHub Pages。

## 项目结构

```
src/data/exercises.json    五个动作库
src/types/exercise.ts      schema 和运行时校验
src/lib/profile.ts         资料、BMI、localStorage
src/lib/plan.ts            今日训练
src/App.tsx                问卷和今日训练
public/logo.png            标志，页头和 favicon 共用这张图
public/exercises/          力量和拉伸的图片
```

页头 `.lockup` 在「Apex」左边放 `public/logo.png`，大约 32px。同一张图也是 favicon 和 apple-touch-icon，链接使用 Vite 的 `base`，在 `/apex/` 下同样有效。

## 数据来源

力量库和拉伸库的动作和图片选自 [free-exercise-db](https://github.com/yuhonas/free-exercise-db)（yuhonas）。该项目以 [Unlicense](https://unlicense.org/) 发布，属于公有领域，数据和图片都可以直接使用。谢谢作者把这套动作和示范图放进公有领域。

Apex 只取每个力量动作、以及拉伸库里每个动作的第一张图，压缩后放在 `public/exercises/`（长边不超过 480px 的 JPEG），并改写成现有 schema：中文名、肌群枚举、器械，以及默认次数或时长。拉伸来自该库的 `stretching` 分类，大约 12 个，中文名是 Apex 写的。`image` 是可选字段，训练卡片会按 Vite 的 `base`（页面在 `/apex/`）去拼这张缩略图。HYROX 和 HIIT 两个库没有使用这份数据，也没有配图。热身是 Apex 自己写的动态动作，同样没有配图。

Strength and stretch movements and photos come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) by yuhonas, dedicated to the public domain under the [Unlicense](https://unlicense.org/). Each of those cards uses that exercise's first image, compressed so the long side is at most 480 pixels. Stretches are about a dozen entries from the `stretching` category, with Chinese names written for Apex. HYROX, HIIT, and the warm-up library do not use these photos. Warm-ups are original dynamic movements.

HIIT 库在原有间歇动作上，并入了从 Open WOD Database 选出的常见间歇动作。波比跳、俯卧撑、登山跑这三条本来就在库里，合并时没有再加一遍。新增动作的中文名是翻译，次数和秒数按训练剂量改写，不是数据库里的原始课表。

Open WOD Database (https://github.com/WodWiz/open-wod-db, https://www.wodwiz.com/benchmarks), CC BY 4.0。动作经过改编和翻译。CrossFit 是商标。这些条目只是常见体能动作的结构化整理，不表示 CrossFit 官方授权或关联。

HYROX 库按公开赛制写成 8 个功能站，站与站之间是跑步：SkiErg、Sled Push、Sled Pull、Burpee Broad Jump、Rowing、Farmers Carry、Sandbag Lunges、Wall Balls，外加 1 km 跑。条目里的时间和次数是训练量，例如几十秒的滑雪机或划船机、十几次墙球，不是比赛的 1000 m、100 次或整段 1 km。没有滑雪机、雪橇、划船机、壶铃、沙袋或药球时，用阻力带、哑铃、单车、立定跳远等替代，并在 `equipment` 里写明「替代」哪一站。今日训练的徒手段只取其中器械为徒手或自重的条目。

站点要点和无器械替代的取舍，参考了 HYROX 中文备赛手册（https://github.com/fisha1616/hyrox-training-skill，MIT）。手册里的说明已改写成 Apex 自己的结构化条目，没有照搬原文。HYROX 是商标。本库不表示赛事方授权。

## License

MIT © 2026 Brian / student-bu. See [LICENSE](LICENSE).
