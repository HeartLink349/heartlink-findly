# Don't Block Me — Full Parity Local Build

A complete Arabic (`ar`, RTL) and English (`en`, LTR) recreation matching [block.youtest.me](https://block.youtest.me/) across every creator, friend/player, utility, and error route.

## Included Features & Routes

- **Loading Splash Screens**: Animated blue sky splash with floating clouds, yellow sticky note, and 3-dot bounce (plus player sky splash).
- **Homepage (`/`, `/?no_redirect=1`)**: Sky hero, floating white doodles, ribbon tagline, centered Language Selector pill opening the full 25-language modal, CTA card with brush highlight & doodles, How to Play steps, and creator auto-redirect to `/user/share`.
- **Creator Name & Gender (`/user/name`)**: `SceneHeader` with back button and full searchable **248-country picker modal**, pink tilted speech bubble, floating panda mascot, 15-char counter + shake validation tooltip, and tilted Male/Female cards.
- **Quiz Creation (`/user/creating`)**: Pink progress bar, lined notebook question card with pink tape & creator name highlight, photo option cards with wavy animated underlines, `pop.mp3` & `swipe.mp3` sound effects, true in-place **Skip Question** replacement (keeps 10 questions), and **WOOHOO!** completion card with confetti and sticky note.
- **Creator Share Dashboard (`/user/share`)**: Slide-in side menu drawer (Language modal, Create Another Quiz confirmation, Contact Us, Instagram), mascot & thought bubble, `share your link & find your fake friends`, copy link box, WhatsApp gender-specific share message, 6 social share tiles, Check Scores CTA, and `Try our other quizzes` promo card.
- **Creator Scoreboard (`/user/scoreboard`) & View Answers (`/user/scoreboard/answers`)**: Empty state card, populated yellow-banner leaderboard with rank badges (`rank1..3`, `rankall`), 30 animal avatars, progress bars, Delete Player confirmation modal, and question-by-question answer review screen.
- **Contact & Delete Quiz (`/contact`)**: Instagram DM card (`@official_fake_friend_finder`) + WhatsApp (`01125674359`), informational card, and `Delete my link` confirmation modal that deletes the quiz and returns home.
- **Friend / Player Flow (`/find?id=<id>&q=<m|f>` → `/player/name` → `/player/playing` → `/player/completed`)**:
  - Cloud-framed friend landing with thought bubble, tilted notebook card, compact language switcher, and embedded Scoreboard.
  - Hanging pink gingham nameplate entry screen.
  - 1–10 numbered tile progress tray, scalloped question card, 2-column photo grid, instant green/red correct/wrong feedback with audio (`pop.mp3` / `pop1.mp3`) and correct-answer reveal.
  - Full 4-stage animated story (`CreatorEntrance` → `Conversation` → `Decision` → `Reaction`) on grassy stage with typewriter sound synthesis, 3D gradient SVG score counter with cubic-root easing (`scorePop.mp3`), reaction poses & audio (`result-high/medium/low.mp3`), torn-paper CTA, Scoreboard with `YOU 👇` badge, and timed Quiz Invitation modal.
- **Custom 404 Page (`/404` & unknown paths)**: Sky gradient, sleeping Bubu with `404` sticker, and homepage CTA.

## Run Locally

```bash
node preview-server.js
```
(Or any static SPA server / Python preview server serving `index.html` on port `5500`.)

## Database Handoff

All persistence goes through `window.quizStore` in `storage.js` (`list()`, `get(id)`, `save(quiz)`, `delete(id)`, `addResponse(id, response)`, `removeResponse(quizId, responseId)`). Replace `LocalQuizStore` with your backend API adapter without changing UI code.
