<!-- Scraped from https://developers.reddit.com/docs/capabilities/client/navigation -->

- - Post Creation & Navigation- NavigationOn this page

# Navigation

Use navigation functions to redirect users to Reddit content or external websites in response to user actions, such as button clicks. You can redirect to a `url` string or to objects such as `Subreddit`, `Post`, or `Comment`.

For most navigation interactions, use the direct client library functions. These provide immediate navigation and are perfect for user interactions within your app components.

warning
When linking to Reddit content, the navigation function requires the app account to have access to the content. If the app account does not have access, the redirect will fail.

## Basic navigation​

client/index.ts
`import { navigateTo } from '@devvit/web/client';

// Navigate to external URLs
navigateTo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

// Navigate to Reddit URLs
navigateTo('https://www.reddit.com/r/movies/comments/tzxev3/');

// Navigate to Reddit objects
async function goToPost() {
  const post = await fetch('/api/getPost').then(r => r.json());
  navigateTo(post);
}

// Use in button handlers or user interactions
function handleNavigateClick() {
  navigateTo('https://www.reddit.com/r/webdev');
}
`

### Parameters​

`navigateTo(target)`

- `target`: Either a URL string or a Reddit object (Subreddit, Post, Comment)

:::tip Menu response navigation
For navigation in menu response workflows (when you need server processing before navigation), see the Menu Actions documentation.
:::

## External URLs​

Users see a confirmation dialog before going to external URLs.

## Limitations​

- `url` must be http/https

- `url` must have a domain
