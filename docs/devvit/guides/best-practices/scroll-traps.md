<!-- Scraped from https://developers.reddit.com/docs/guides/best-practices/scroll-traps -->

- - Best Practices- Avoid Scroll Traps in Inline AppsOn this page

# Avoid Scroll Traps in Inline Apps

Inline apps appear inside the Reddit feed. Users must be able to scroll past
them with a mouse wheel, trackpad, or touch gesture.

A scroll trap happens when the feed stops moving while the pointer is over the
app. This can happen even when the inline app has no visible scrollbar. Common
causes include internal scroll panels, full-surface canvases, games, maps,
carousels, and broad gesture handlers.

Use inline mode for quick, bounded interactions. Move vertical scrolling,
full-surface drag gestures, zooming, maps, drawing canvases, and long flows into
expanded mode.

## Inline scroll trap demo​

Below is an example feed with three tabs: an internal scroll trap, a
no-scrollbar trap, and a fixed version. Switch tabs, then scroll through the
feed to compare how each inline app handles scroll input.

Internal scroll trapNo scrollbar trapFeed stays scrollable
Hover over the nested list and scroll. The app captures the scroll inside the post.Ssample-scroll-trap-appApp11 hr. ago...

### Daily Game #116
Daily Gamer/?
Rejected

#### Internal app scroll blocks the feed
The app contains its own scrolling panel. When that panel reaches an edge, the Reddit feed still cannot continue scrolling.Daily run completeScore 186 points and keep a 4 day streak.
Share scoreComment on the postJoin subredditView leaderboardClaim streak bonusInvite a friendPlay again tomorrow
`overscroll-behavior: contain;`

Privacy4218Share
