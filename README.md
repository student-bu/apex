# Apex

Apex 是一个混合健身挑战小站：每天从力量、HYROX 功能性动作和 HIIT 间歇里，生成一组随机但合理的训练，帮你走出固定课表。

Apex is a small open-source web app for hybrid fitness. It keeps three exercise libraries — strength, HYROX functional movements, and HIIT intervals — and builds one sensible workout for the day instead of repeating a fixed plan.

## MVP

This foundation includes:

- Three exercise libraries stored as JSON, with one shared schema
- A pure workout generator, covered by unit tests
- A single page that shows today's workout and lets you filter libraries, pick 20 / 30 / 45 minutes, or shuffle

Later versions can add the interval timer, local completion records, and the streak count. They are intentionally not in this pull request.

## Run and test

Requires Node.js 22+.

```bash
npm install
npm run dev
npm test
npm run build
```

`npm run dev` starts the Vite dev server. `npm test` runs Vitest once. `npm run build` typechecks the project and writes a static build to `dist/`.

## Preview

[https://student-bu.github.io/apex/](https://student-bu.github.io/apex/)

A push to `main` runs the tests and production build in GitHub Actions, then deploys `dist/` to GitHub Pages.

## How a workout is chosen

`generateWorkout` takes the selected libraries, a duration of 20, 30, or 45 minutes, and a seed. The page uses the local date (`YYYY-MM-DD`) as the daily seed. **换一换** appends a counter (`2026-11-13#1`) for another arrangement; that counter lives in memory and resets on refresh. **回到今日** returns to the date seed.

The generator follows these rules:

- No exercise is repeated in the workout
- Adjacent exercises do not share a `muscleGroup`
- The target count is 4, 6, or 8 exercises for 20, 30, or 45 minutes
- Each exercise is given 2–4 sets. Reps or seconds stay at the library default
- Estimated time is work + rest between sets + 30 seconds to change stations, and it never exceeds the selected duration
- Intensity `3` is at most half of the exercises
- The same seed, libraries, and duration always produce the same workout

Estimated work is 4 seconds per rep, or `defaultSeconds` for timed exercises. Rest between sets is 45 / 60 / 75 seconds for intensity 1 / 2 / 3.

If a library cannot fill the target without breaking a rule, the result is a shorter valid workout (`shortened`) or an empty one (`unsatisfiable`). An empty selection returns `no-libraries`. The page shows these states in Chinese and does not throw.

`muscleGroup` is the primary pattern used for sequencing, not a complete anatomy label. The HYROX list includes the race stations plus kettlebell swings and dumbbell snatches, which are common accessories in that style of training.

## Project layout

```
src/data/exercises.json    seeded libraries
src/types/exercise.ts      schema, type, and runtime checks
src/lib/workout.ts         pure generator
src/App.tsx                today's workout page
public/exercises/          strength photos used by the workout cards
```

## 数据来源

力量库的动作和图片选自 [free-exercise-db](https://github.com/yuhonas/free-exercise-db)（yuhonas）。该项目以 [Unlicense](https://unlicense.org/) 发布，属于公有领域，数据和图片都可以直接使用。谢谢作者把这套动作和示范图放进公有领域。

Apex 只取每个力量动作的第一张图，压缩后放在 `public/exercises/`，并改写成现有 schema：中文名、肌群枚举、器械，以及默认次数或时长。`image` 是可选字段，训练卡片会按 Vite 的 `base`（页面在 `/apex/`）去拼这张缩略图。HYROX 和 HIIT 两个库没有使用这份数据。

Strength movements and photos come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) by yuhonas, dedicated to the public domain under the [Unlicense](https://unlicense.org/). Each strength card uses that exercise's first image. HYROX and HIIT are unchanged.

## License

MIT © 2026 Brian / student-bu. See [LICENSE](LICENSE).
