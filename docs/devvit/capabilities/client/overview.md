<!-- Scraped from https://developers.reddit.com/docs/capabilities/client/overview -->

- - Devvit Setup Overview- Client OverviewOn this page

# Client Overview

Client-side effects enable your Devvit app to provide interactive feedback and navigation to users. These effects include showing toasts, displaying forms, navigating to different pages, and more.

Import client functions from `@devvit/web/client`:

client/index.ts
`import { showToast, showForm, navigateTo } from '@devvit/web/client';

// Show a toast notification
showToast('Hello from Devvit Web!');

// Navigate to a URL
navigateTo('https://www.reddit.com/r/webdev');

// Show a form and handle response
const result = await showForm({
  form: {
    fields: [
      {
        type: 'string',
        name: 'username',
        label: 'Username'
      }
    ]
  }
});

if (result) {
  console.log('Form submitted:', result.username);
}
`

## Available client effects​

EffectDescriptionAPIToastShow temporary notification messages`showToast()`FormDisplay interactive forms with promise-based responses`showForm()`NavigationRedirect to Reddit content or external URLs`navigateTo()`
caution
You should only use client library functions in response to a user-initiated action.

## Menu responses​

Menu items can respond with client effects after server processing.

Menu responses allow you to:

- Process data on the server before showing client effects

- Chain multiple forms together in complex workflows

- Validate user permissions before allowing actions

- Fetch external data to populate forms or display results

For complete details and examples, see the Menu Actions documentation.

## Next steps​

Explore the specific documentation for each client effect:

- Toasts - Temporary notification messages

- Forms - Interactive user input

- Navigation - Redirecting users

- Realtime - Live updates and communication
