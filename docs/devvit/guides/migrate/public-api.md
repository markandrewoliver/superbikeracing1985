<!-- Scraped from https://developers.reddit.com/docs/guides/migrate/public-api -->

- - Migration Guides- Migrating from PRAW to Devvit Web- OverviewOn this page

# Migrating apps from the Data API to Devvit

Reddit’s Developer Platform is the most modern way to build apps for Reddit. Devvit is now the primary way to develop Reddit extensions and ensures automations are more supported, secure, policy-compliant, and deeply integrated with Reddit. The platform includes many new features not available with the Public Data API, such as new custom menu actions, interactive posts, event-based triggers, Reddit-hosted storage, app settings for one-to-many configurations, and more.

We would like to see more third-party app functionality to run through the Developer Platform instead of older legacy systems like the Public Data API.

## Join the App Migration Program​

We have launched a $1,000,000 Developer Platform App Migration Program to help developers bring existing Data API apps, particularly moderation bots and community tools, to Devvit.

To be considered, register your existing Data API app with the platform. Registering also helps us understand what challenges may exist for migrating apps today.

## App Migration Exemptions​

Some existing Data API apps may depend on capabilities that are not a direct one-to-one fit in Devvit yet. As part of the migration process, we are both reviewing porting challenges cited in app registration, as well as expanding our allow lists for key features that fill gaps like cross-subreddit communication, access to existing backends, incoming webhooks, or leveraging structured databases.

App Migration Program participants can get access to the following features and exemptions:

- HTTP Fetch allowlisting: If your Data API moderation tool needs domain access beyond what is typically allowlisted, we are offering a pathway to broader Fetch access.

- External endpoints: External Endpoints allow servers to call into a Dev Platform app for long running jobs or cross-subreddit workflows. If your app needs access, please request the feature here.

- App mentions triggers: for global mod tools and utilities to respond when an app username is mentioned. This feature is currently in beta. If your app needs access, please request the feature here.

- Blob storage: In addition to Redis, we also now offer blob storage, completely hosted by Reddit. Please send a modmail to r/Devvit to get access to this feature.

## Migration Guides​

Use these guides to get started with porting your Data API apps to Devvit:

- Migrating from PRAW to Devvit Web maps common PRAW patterns to Devvit Web, including project setup, Reddit API calls, streams to triggers, scheduler jobs, Redis, HTTP fetch, posts, comments, and moderation actions.

- Migrating with AI explains how to use an AI assistant safely during a migration: inventory the existing app first, create a reviewable plan, configure Devvit capabilities, migrate one behavior at a time, track gaps, add tests, and playtest before launch.

## Getting Support For Your Migration​

If you are unsure how to approach your migration, reach out for help early. You can get support in our #data-api-app-migration channel in Discord or by messaging r/Devvit modmail.

When asking for help, include what your app does, the communities it supports, the Data API or PRAW features it depends on, and any blockers you have already identified. This helps the Devvit team point you toward the right migration path, exemption process, or platform capability.
