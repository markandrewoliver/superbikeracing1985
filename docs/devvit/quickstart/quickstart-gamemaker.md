<!-- Scraped from https://developers.reddit.com/docs/quickstart/quickstart-gamemaker -->

- - Build Games- Quickstart for GameMakerOn this page

# GameMaker Quickstart

This page walks you through building a GameMaker app for Devvit. Once complete, you'll see your GameMaker game running directly within a Reddit post.

If you are already familiar with Devvit and want to jump straight to exporting, see the  Build and Deploy GameMaker Games to Devvit  section.

## Try it out​

The template creates a simple GameMaker game and demonstrates data exchange between Reddit and GameMaker.

## What you'll need​

- Node.js (version 24.18.0+)

- GameMaker 2024.1400.3 or later (this version adds direct exporting to Reddit)

## Environment setup​

- Install Node.js and npm (instructions)

- Go to developers.reddit.com/new and select the GameMaker template

- Complete the setup wizard (you'll need to create a Reddit account and connect it to Reddit Developers)

- Follow the instructions in your terminal

On success, you should see something like this:

`Your Devvit authentication token has been saved to /Users/user.name/.devvit/token
Fetching and extracting the template...
Cutting the template to the target directory...
 🔧 Installing dependencies...
 🚀🚀🚀 Devvit app successfully initialized!
┌────────────────────────────────────────────────────┐
│ • `cd my-app` to open your project directory       │
│ • `npm run dev` to develop in your test community  │
└────────────────────────────────────────────────────┘
`

## Running your app​

To run your app, navigate to your project directory with `cd my-app` and run `npm run dev`. You should see logs that conclude with:

`┌─────────────────────────────────────────────────────────────────────────────┐
│ ✓ Playtest ready                                                            │
│ ➜ URL: https://www.reddit.com/r/my-app_dev/?playtest=my-app                 │
│ ➜ Version: v0.0.0.1                                                         │
│ ➜ Open the URL above and refresh to see your latest changes.                │
└─────────────────────────────────────────────────────────────────────────────┘
`

Follow this link to see your app.

## Build and Deploy GameMaker Games to Devvit​

For step-by-step export instructions, see the GameMaker Reddit Template documentation.

## Communicate between GameMaker and Reddit​

GameMaker games communicate with Reddit through HTTP requests. The provided template includes working examples of this data exchange:

- GameMaker client code: reddit_demo_server_api.gml — Shows how to send requests from GameMaker to retrieve user data, save scores, and interact with Reddit features.

- Devvit server code: src/server/index.ts — Handles incoming requests from GameMaker, accesses Reddit APIs, and stores data in Redis.
