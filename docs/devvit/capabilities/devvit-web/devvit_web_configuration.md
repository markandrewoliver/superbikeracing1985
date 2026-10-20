<!-- Scraped from https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_configuration -->

- - Devvit Setup Overview- Devvit ConfigurationOn this page

# Configure your app

The `devvit.json` file serves as your app's configuration file. Use it to specify entry points, configure features like event triggers and scheduled actions, and enable app functionality such as image uploads. This page summarizes the schema-supported configuration options; the published JSON Schema remains authoritative. A representative `devvit.json` example is provided here.

## devvit.json​

The `devvit.json` schema is available and is self-documented.

All configuration files should include a `$schema` property which many IDEs will use to make suggestions and present documentation:

`{
  "$schema": "https://developers.reddit.com/schema/config-file.v1.json"
}
`

## Required properties​

Your `devvit.json` must include:

- `name` (required): App account name and Community URL slug. Must be 3-20 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens.

Additionally, you must include at least one of:

- `post`: For web view apps

- `server`: For Node.js server apps

## Configuration sections​

### Core properties​

PropertyTypeDescriptionRequired`name`stringApp account name and Community URL slug (3-20 chars, `^[a-z][a-z0-9-]*$`)Yes`$schema`stringSchema version for IDE supportNo (recommended)

### App components​

PropertyTypeDescriptionRequired`post`objectCustom post/web view configurationOne of post/server`server`objectNode.js server configurationOne of post/server

### Permissions & capabilities​

PropertyTypeDescriptionRequired`permissions`objectWhat your app is allowed to doNo`media`objectStatic asset configurationNo`marketingAssets`objectAssets for featuring your appNo

### Event handling​

PropertyTypeDescriptionRequired`triggers`objectEvent trigger endpointsNo (requires server)`scheduler`objectScheduled task configurationNo

### UI & interaction​

PropertyTypeDescriptionRequired`menu`objectMenu items in posts, comments, and subredditsNo`forms`objectForm submission endpointsNo`settings`objectGlobal and per-subreddit app settings definitionsNo

### Development​

PropertyTypeDescriptionRequired`dev`objectDevelopment configurationNo`scripts`objectBuild commands run by the Devvit CLINo`sourceIgnores`arraySource files excluded from packages submitted for reviewNo

## Detailed configuration​

### Post configuration​

Configure web views for custom post types:

`{
  "post": {
    "dir": "public",
    "entrypoints": {
      "default": {
        "entry": "index.html",
        "height": "tall"
      }
    }
  }
}
`

Properties:

- `dir` (string): Client directory for web view assets (default: `"public"`)

- `entrypoints` (object): Map of named entrypoints for post rendering

- Must include a `"default"` entrypoint

- `entry` (string): HTML file path or `/api/` endpoint

- `height` (enum): `"regular"` or `"tall"` (default: `"tall"`)

### Server configuration​

Configure Node.js server functionality:

`{
  "server": {
    "dir": "dist/server",
    "entry": "index.js"
  }
}
`

Properties:

- `dir` (string): Server bundle directory relative to the project root (default: `"dist/server"`)

- `entry` (string): Server bundle filename within `server.dir` (default: `"index.js"`)

- `externalEndpoints` (object): Named `/external/` routes available to approved outside callers. See External Endpoints.

Server bundles must be compiled to CommonJS (`cjs`). ES module output is not supported by the Devvit Web runtime.

### Permissions configuration​

Control what your app can access:

`{
  "permissions": {
    "http": {
      "enable": true,
      "domains": ["example.com", "api.github.com"]
    },
    "media": true,
    "payments": false,
    "realtime": false,
    "redis": true,
    "chromeless": false,
    "reddit": {
      "enable": true,
      "asUser": ["SUBMIT_POST", "SUBMIT_COMMENT"]
    }
  }
}
`

HTTP plugin:

- `enable` (boolean): Enable HTTP plugin (default: `true`)

- `domains` (array): Allowed domains for `fetch()` calls

Reddit API plugin:

- `enable` (boolean): Enable Reddit API (default: `true`)

- `scope` (enum): `"user"` or `"moderator"` (default: `"user"`)

- `asUser` (array): APIs to execute as user account

Other permissions:

- `media` (boolean): Enable media uploads (default: `false`)

- `payments` (boolean): Enable the payments plugin (default: `false`)

- `realtime` (boolean): Enable realtime messaging (default: `false`)

- `redis` (boolean): Enable Redis storage (default: `false`)

- `chromeless` (boolean): Allow supported custom posts to render without standard post chrome when highlighted (default: `false`)

- `blob` (boolean): Reserved for the experimental Blob Storage capability and not yet publicly available. Follow the current Blob Storage setup instructions rather than enabling this field unless directed by Reddit.

### Triggers configuration​

Handle Reddit events:

`{
  "triggers": {
    "onPostCreate": "/internal/triggers/post-create",
    "onCommentSubmit": "/internal/triggers/comment-submit",
    "onModAction": "/internal/triggers/mod-action"
  }
}
`

Available triggers:

- `onAppInstall`, `onAppUpgrade`

- `onPostCreate`, `onPostDelete`, `onPostSubmit`, `onPostUpdate`, `onPostReport`, `onPostFlairUpdate`, `onPostNsfwUpdate`, `onPostSpoilerUpdate`

- `onCommentCreate`, `onCommentDelete`, `onCommentSubmit`, `onCommentUpdate`, `onCommentReport`

- `onMentionInCommentCreate` (limited access; see Global Triggers)

- `onModAction`, `onModMail`

- `onAutomoderatorFilterPost`, `onAutomoderatorFilterComment`

Note: All trigger endpoints must start with `/internal/` and will receive POST requests with JSON data.

### Menu configuration​

Add menu items to subreddit interfaces:

`{
  "menu": {
    "items": [
      {
        "label": "Approve Post",
        "description": "Quickly approve this post",
        "forUserType": "moderator",
        "location": ["post"],
        "endpoint": "/internal/menu/approve-post",
        "postFilter": "none"
      },
      {
        "label": "Report Issue",
        "description": "Report a problem with this post",
        "forUserType": "user",
        "location": ["post", "comment"],
        "endpoint": "/internal/menu/report-issue"
      }
    ]
  }
}
`

Menu item properties:

- `label` (string): Display text (required)

- `description` (string): Short description

- `forUserType` (enum): `"moderator"` or `"user"` (default: `"moderator"`)

- `location` (string|array): Where menu appears (`"post"`, `"comment"`, `"subreddit"`)

- `endpoint` (string): Internal endpoint to call (required)

- `postFilter` (enum): `"none"` or `"currentApp"` (default: `"none"`)

### Scheduler configuration​

Configure scheduled tasks:

`{
  "scheduler": {
    "tasks": {
      "daily-cleanup": {
        "endpoint": "/internal/cron/daily-cleanup",
        "cron": "0 2 * * *"
      },
      "hourly-check": {
        "endpoint": "/internal/cron/hourly-check",
        "cron": "0 * * * *",
        "data": {
          "checkType": "health"
        }
      },
      "manual-task": "/internal/cron/manual-task"
    }
  }
}
`

Task configuration:

- `endpoint` (string): Internal endpoint to call (required)

- `cron` (string): Cron schedule (optional, for automatic scheduling)

- `data` (object): Additional data passed to cron tasks (optional)

Cron format: Standard five-part (`0 2 * * *`) or six-part (`*/30 * * * * *`) format.

### Forms configuration​

Map form identifiers to submission endpoints:

`{
  "forms": {
    "contact_form": "/internal/forms/contact",
    "feedback_form": "/internal/forms/feedback"
  }
}
`

### Static asset configuration​

Configure a directory of static assets that is available to both the app client and server:

`{
  "media": {
    "dir": "assets"
  }
}
`

- `dir` (string): Static asset directory relative to the project root (default: `"assets"`)

This top-level `media` object is separate from `permissions.media`, which enables runtime media uploads.

### Settings configuration​

Define settings that apply globally or can be configured separately for each subreddit installation:

`{
  "settings": {
    "global": {
      "featureEnabled": {
        "type": "boolean",
        "label": "Enable feature",
        "defaultValue": true
      }
    },
    "subreddit": {
      "welcomeMessage": {
        "type": "paragraph",
        "label": "Welcome message"
      }
    }
  }
}
`

At least one of `global` or `subreddit` is required. Supported setting types include strings, paragraphs, numbers, booleans, selects, and multi-selects. See Settings and Secrets for validation and access patterns.

### Payments configuration​

The top-level `payments` object declares products and the internal endpoints used to fulfill or refund orders. It is separate from `permissions.payments`, which enables the payments plugin.

`{
  "payments": {
    "productsFile": "products.json",
    "endpoints": {
      "fulfillOrder": "/internal/payments/fulfill-order",
      "refundOrder": "/internal/payments/refund-order"
    }
  }
}
`

Provide either inline `products` or a `productsFile`, and always configure `endpoints.fulfillOrder`. See Add Payments for the complete product schema and implementation steps.

### Marketing assets​

Configure app presentation:

`{
  "marketingAssets": {
    "icon": "assets/icon.png"
  }
}
`

Properties:

- `icon` (string): Path to 1024x1024 PNG icon (required)

### Scripts configuration​

Configure build commands run by the Devvit CLI. These commands run relative to the `devvit.json` directory.

`{
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build"
  }
}
`

Properties:

- `dev` (string): Command run by `devvit playtest` to build or watch your client/server artifacts

- `build` (string): Command run by `devvit upload` to build your client/server artifacts

### Source packaging exclusions​

Use `sourceIgnores` to exclude files from the source archive submitted during `devvit publish`. Patterns use `.gitignore` syntax and are evaluated after the root `.gitignore` file.

`{
  "sourceIgnores": ["coverage/", "*.log", "fixtures/private/"]
}
`

Patterns are relative to the project root. Some paths, including `node_modules/`, `.env`, and `.git/`, are always excluded.

### Development configuration​

Configure development settings:

`{
  "dev": {
    "subreddit": "my-test-subreddit"
  }
}
`

Properties:

- `subreddit` (string): Default development subreddit (can be overridden by `DEVVIT_SUBREDDIT` env var)

## Validation rules​

The Devvit CLI validates `devvit.json` against the JSON Schema before playtest, upload, and publish operations. Many IDEs will also underline errors as you write. Common validation errors include:

- JSON Syntax: Adding comments or trailing commas (unsupported by JSON)

- Required Properties: Missing the required `name` property

- App Components: Missing at least one of `post` or `server`

- Dependencies: Missing `server` when `triggers` is specified

- File References: Missing files referenced in `devvit.json`

- Permissions: Missing required permissions for used features

- Pattern Validation: Invalid patterns for names, paths, or endpoints

## Best practices​

- Always include the `$schema` property for IDE autocompletion and validation.

- Use specific permission scopes. Only request permissions your app actually uses.

- Set appropriate menu scopes. Consider whether features should be available to all users or just moderators.

- Validate endpoints. Ensure all internal endpoints start with `/internal/`.

- Use meaningful names. Choose descriptive names for entrypoints, tasks, and forms.

- Test configurations. Use `devvit playtest` during development; `devvit playtest`, `devvit upload`, and `devvit publish` validate the configuration before packaging.

## Environment variables​

- `DEVVIT_SUBREDDIT`: Override the `dev.subreddit` value used during `devvit playtest`.

- `DEVVIT_APP_NAME`: Override the `name` value used during `devvit playtest` (and other similar commands).

## Complete example​

devvit.json
`{
  "$schema": "https://developers.reddit.com/schema/config-file.v1.json",
  "name": "my-awesome-app",
  "post": {
    "dir": "public",
    "entrypoints": {
      "default": {
        "entry": "index.html",
        "height": "tall"
      }
    }
  },
  "server": {
    "dir": "dist/server",
    "entry": "index.js"
  },
  "permissions": {
    "http": {
      "enable": true,
      "domains": ["api.example.com"]
    },
    "redis": true
  },
  "triggers": {
    "onPostCreate": "/internal/triggers/post-create"
  },
  "menu": {
    "items": [
      {
        "label": "Approve",
        "forUserType": "moderator",
        "location": "post",
        "endpoint": "/internal/menu/approve"
      }
    ]
  },
  "scheduler": {
    "tasks": {
      "daily-cleanup": {
        "endpoint": "/internal/cron/cleanup",
        "cron": "0 2 * * *"
      }
    }
  },
  "marketingAssets": {
    "icon": "assets/icon.png"
  },
  "dev": {
    "subreddit": "my-test-sub"
  },
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build"
  }
}
`
