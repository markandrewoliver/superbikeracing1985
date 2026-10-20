<!-- Scraped from https://developers.reddit.com/docs/guides/ai -->

- - Using AI ToolsOn this page

# AI Tools

Devvit ships with first class support for common AI tools and patterns.

## LLMs.txt files​

- https://developers.reddit.com/docs/llms.txt: Most useful for pasting into the chat UI of common LLMs BEFORE your prompt. Place your prompt last as models are auto-regressive.

- https://developers.reddit.com/docs/llms-full.txt: Useful for pasting into the chat UI of LLMs with large context windows (Gemini, Claude Sonnet 4). This lets you chat with the docs instead of reading them. It's easy to pollute your context if your using this for coding so we recommend only using this to learn about Devvit or plan. To execute, use `llms.txt` as most modern LLMs can tool call websites.

## MCP​

Devvit ships with a MCP server to assist with agent driven development. There are two commands at the moment:

- `devvit_search`: Executes hybrid search over all of our docs. This is preferable to pasting in tons of docs since it can be more specific and lowers the risk of polluting your context.

- `devvit_logs` [experimental]: Queries for logs of your app and a subreddit to place into an agent's context. It can be fun any useful, and shows a glimpse of the future of AI Devvit! Try this after MCP is turned on in your agent, "find a bug in my app deployed to the subreddit <YOUR_SUBREDDIT_NAME> from the past week and a fix it". It might not work, but when it does, magic!

### Cursor​

Note that React, ThreeJS, and Phaser ship with first class support. All you have to do is run a template from /new in cursor and you will see a popup at the bottom-left corner to enable.

-
In your project, ensure a `.cursor` directory exists at the root. Create it if necessary.

-
Inside `.cursor`, create or open the `mcp.json` file.

-
Paste the following configuration into `mcp.json`:

mcp.json
`{
  "mcpServers": {
    "devvit": {
      "command": "npx",
      "args": ["-y", "@devvit/mcp"]
    }
  }
}
`

-
Save the file.

-
Check Cursor's Settings/MCP section. The Devvit MCP server should show an active status (green indicator). You might need to click "Refresh" if it doesn't appear immediately.

### Claude Code​

`claude mcp add devvit -- npx -y @devvit/mcp
`

Things should work after that!

### Claude Desktop​

- Open the Claude desktop application and go to Settings.

- Navigate to the Developer tab and click Edit Config.

- Add the Devvit server configuration:

`{
  "mcpServers": {
    "devvit": {
      "command": "npx",
      "args": ["-y", "@devvit/mcp"]
    }
  }
}
`

- Save the configuration file and restart the Claude desktop application.

- When starting a new chat, look for the MCP icon (hammer); the Devvit server should now be listed as available.

### Visual Studio Code (Copilot)​

-
Ensure your project root contains a `.vscode` directory. Create one if it's missing.

-
Create or open the `mcp.json` file within the `.vscode` directory.

-
Insert the following configuration:

mcp.json
`{
  "servers": {
    "devvit": {
      "command": "npx",
      "args": ["-y", "@devvit/mcp"]
    }
  }
}
`

-
Save `mcp.json`.

-
In the Copilot chat panel within Visual Studio Code, ensure you're in "Agent" mode. The tool icon should now indicate that Devvit MCP tools are available for use.

Refer to the official Copilot documentation for further details on VS Code MCP integration.

### Testing the Connection​

With your AI tool configured, you should now be able to leverage the Devvit MCP server. A good way to test this is to ask your AI assistant a question that requires accessing Devvit resources, for example: "Search the Devvit docs for information on redis."

If you encounter problems, refer to the official Devvit documentation or reach out in the Discord.
