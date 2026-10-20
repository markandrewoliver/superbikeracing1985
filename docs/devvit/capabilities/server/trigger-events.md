<!-- Scraped from https://developers.reddit.com/docs/capabilities/server/trigger-events -->

- - Automation & Triggers- Trigger Event CatalogOn this page

# Trigger Event Catalog

Use this catalog to choose a trigger and understand the request sent to your endpoint. For configuration and handler examples, see Triggers.

## Delivery and payload expectations​

- Delivery is asynchronous. Reddit state can change between the action and your handler. Fetch the current object when your decision depends on its latest state.

- An event can be delivered more than once. Make writes and other side effects idempotent. Do not rely on strict ordering between separate trigger requests.

- Payload objects are snapshots. Nested `post`, `comment`, `author`, and `subreddit` objects can be absent when Reddit cannot provide them. Check optional fields before using them.

- Payloads can be sanitized. Deleted or removed content can use redacted text and placeholder identities. Moderator and administrator identities can also be masked.

- User-generated content is untrusted. Escape content before rendering it, and validate it before passing it to another system.

Every Devvit Web trigger request also contains a `type` discriminator such as `"PostCreate"`. This is useful when multiple trigger keys share one endpoint.

## Quick reference​

Trigger keyRepresentsPayload typeDeliveryDetails`onPostSubmit`A newly submitted post`OnPostSubmitRequest`Does not wait for platform safety verificationView`onPostCreate`A newly created post`OnPostCreateRequest`Waits for platform safety verificationView`onPostUpdate`An edit to a post's body`OnPostUpdateRequest`State-change eventView`onPostReport`A report on a post`OnPostReportRequest`State-change eventView`onPostDelete`A post deletion or removal`OnPostDeleteRequest`State-change eventView`onPostFlairUpdate`A post flair change`OnPostFlairUpdateRequest`State-change eventView`onPostNsfwUpdate`A post's NSFW status changing`OnPostNsfwUpdateRequest`State-change eventView`onPostSpoilerUpdate`A post's spoiler status changing`OnPostSpoilerUpdateRequest`State-change eventView`onCommentSubmit`A newly submitted comment`OnCommentSubmitRequest`Does not wait for platform safety verificationView`onCommentCreate`A newly created comment`OnCommentCreateRequest`Waits for platform safety verificationView`onCommentUpdate`An edit to a comment's body`OnCommentUpdateRequest`State-change eventView`onCommentReport`A report on a comment`OnCommentReportRequest`State-change eventView`onCommentDelete`A comment deletion or removal`OnCommentDeleteRequest`State-change eventView`onModAction`An entry in a community's moderation log`OnModActionRequest`Moderation eventView`onModMail`A new modmail message`OnModMailRequest`Messaging eventView`onAutomoderatorFilterPost`AutoModerator filtering a post`OnAutomoderatorFilterPostRequest`Filtered-content eventView`onAutomoderatorFilterComment`AutoModerator filtering a comment`OnAutomoderatorFilterCommentRequest`Filtered-content eventView`onAppInstall`An app installation in a subreddit`OnAppInstallRequest`Lifecycle eventView`onAppUpgrade`An installation moving to a different app version`OnAppUpgradeRequest`Lifecycle eventView`onMentionInCommentCreate`A new comment that mentions the app username`OnMentionInCommentCreateRequest`Global eventView

## Post events​

### onPostSubmit​

Represents: A post being submitted to a subreddit.

Delivery: Does not wait for platform safety verification.

Payload: `OnPostSubmitRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"PostSubmit"`YesEvent discriminator.`post``PostV2`NoSnapshot of the submitted post.`author``UserV2`NoPost author.`subreddit``SubredditV2`NoSubreddit where the post was submitted.

### onPostCreate​

Represents: A newly created post.

Delivery: Waits for platform safety verification.

Payload: `OnPostCreateRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"PostCreate"`YesEvent discriminator.`post``PostV2`NoSnapshot of the created post.`author``UserV2`NoPost author.`subreddit``SubredditV2`NoSubreddit where the post was created.

Important behavior: A single post can produce both `onPostSubmit` and `onPostCreate`. Do not register both unless your app has a distinct, idempotent use for each stage.

### onPostUpdate​

Represents: A change to a post's body.

Delivery: The `post` object is a snapshot containing the updated body.

Payload: `OnPostUpdateRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"PostUpdate"`YesEvent discriminator.`post``PostV2`NoSnapshot of the post after the edit.`author``UserV2`NoPost author. This is not necessarily the user who performed every update.`previousBody``string`YesPrevious body on some legacy delivery paths; otherwise an empty string.`subreddit``SubredditV2`NoSubreddit containing the post.

Important behavior: Evaluator-produced requests currently leave `previousBody` empty. Do not use it as an audit log; store your own prior value if your app needs a reliable comparison.

### onPostReport​

Represents: A report being added to a post.

Delivery: This is a state-change event. The reported post can already be removed, changed, or unavailable when your handler runs.

Payload: `OnPostReportRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"PostReport"`YesEvent discriminator.`post``PostV2`NoSnapshot of the reported post.`subreddit``SubredditV2`NoSubreddit containing the post.`reason``string`YesReport reason associated with this event. It can be empty.

Important behavior: Reporter identity is intentionally not included. A report event is not a report-count update; fetch current moderation data when counts or current queue state matter.

### onPostDelete​

Represents: A post being deleted or removed by a user, moderator, or administrator.

Delivery: This event describes a deletion action. It carries identifiers and metadata instead of the deleted post body.

Payload: `OnPostDeleteRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"PostDelete"`YesEvent discriminator.`postId``string`YesFull post ID, such as `t3_...`.`deletedAt``string`NoDeletion time as an ISO 8601 string.`author``UserV2`NoPost author when available; deleted identities can be redacted.`createdAt``string`NoOriginal creation time as an ISO 8601 string.`source``EventSource`YesActor category associated with the deletion. It can be unknown.`reason``DeletionReason`YesNormalized deletion reason. It can be unspecified or unknown.`subreddit``SubredditV2`NoSubreddit that contained the post.

Important behavior: Do not expect the deleted body in this payload. A moderator removal can also produce `onModAction`; make cleanup idempotent if you subscribe to both.

### onPostFlairUpdate​

Represents: A post's flair being added, changed, or cleared.

Delivery: This is a state-change event. It is separate from edits to the post body.

Payload: `OnPostFlairUpdateRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"PostFlairUpdate"`YesEvent discriminator.`post``PostV2`NoSnapshot containing the updated flair.`author``UserV2`NoUser who updated the flair when available.`subreddit``SubredditV2`NoSubreddit containing the post.

Important behavior: `author` is the updater, not necessarily the post author. Inspect the flair on `post`; a missing flair can represent a cleared flair.

### onPostNsfwUpdate​

Represents: A post being marked or unmarked as NSFW.

Delivery: This is a state-change event. The boolean field is the new state.

Payload: `OnPostNsfwUpdateRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"PostNsfwUpdate"`YesEvent discriminator.`post``PostV2`NoSnapshot of the updated post.`author``UserV2`NoUser who changed the NSFW state when available.`isNsfw``boolean`YesNew NSFW state.`subreddit``SubredditV2`NoSubreddit containing the post.

Important behavior: `author` is the updater, not necessarily the post author. Use `isNsfw` instead of inferring the new state from the event name.

### onPostSpoilerUpdate​

Represents: A post being marked or unmarked as a spoiler.

Delivery: This is a state-change event. The boolean field is the new state.

Payload: `OnPostSpoilerUpdateRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"PostSpoilerUpdate"`YesEvent discriminator.`post``PostV2`NoSnapshot of the updated post.`author``UserV2`NoUser who changed the spoiler state when available.`isSpoiler``boolean`YesNew spoiler state.`subreddit``SubredditV2`NoSubreddit containing the post.

Important behavior: `author` is the updater, not necessarily the post author. Use `isSpoiler` instead of assuming the event only represents enabling the flag.

## Comment events​

### onCommentSubmit​

Represents: A comment being submitted.

Delivery: Does not wait for platform safety verification.

Payload: `OnCommentSubmitRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"CommentSubmit"`YesEvent discriminator.`comment``CommentV2`NoSnapshot of the submitted comment.`author``UserV2`NoComment author.`post``PostV2`NoPost containing the comment.`subreddit``SubredditV2`NoSubreddit where the comment was submitted.

### onCommentCreate​

Represents: A newly created comment.

Delivery: Waits for platform safety verification.

Payload: `OnCommentCreateRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"CommentCreate"`YesEvent discriminator.`comment``CommentV2`NoSnapshot of the created comment.`author``UserV2`NoComment author.`post``PostV2`NoPost containing the comment.`subreddit``SubredditV2`NoSubreddit where the comment was created.

Important behavior: A single comment can produce both `onCommentSubmit` and `onCommentCreate`. Do not register both unless your app has a distinct, idempotent use for each stage.

### onCommentUpdate​

Represents: A change to a comment's body.

Delivery: The `comment` object is a snapshot containing the updated body.

Payload: `OnCommentUpdateRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"CommentUpdate"`YesEvent discriminator.`comment``CommentV2`NoSnapshot of the comment after the edit.`author``UserV2`NoComment author.`post``PostV2`NoPost containing the comment.`previousBody``string`YesPrevious body on some legacy delivery paths; otherwise an empty string.`subreddit``SubredditV2`NoSubreddit containing the comment.

Important behavior: Evaluator-produced requests currently leave `previousBody` empty. Do not use it as an audit log; store your own prior value if your app needs a reliable comparison.

### onCommentReport​

Represents: A report being added to a comment.

Delivery: This is a state-change event. The reported comment can already be removed, changed, or unavailable when your handler runs.

Payload: `OnCommentReportRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"CommentReport"`YesEvent discriminator.`comment``CommentV2`NoSnapshot of the reported comment.`subreddit``SubredditV2`NoSubreddit containing the comment.`reason``string`YesReport reason associated with this event. It can be empty.

Important behavior: Reporter identity is intentionally not included. A report event is not a report-count update; fetch current moderation data when counts or current queue state matter.

### onCommentDelete​

Represents: A comment being deleted or removed by a user, moderator, or administrator.

Delivery: This event describes a deletion action. It carries identifiers and metadata instead of the deleted comment body.

Payload: `OnCommentDeleteRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"CommentDelete"`YesEvent discriminator.`commentId``string`YesFull comment ID, such as `t1_...`.`postId``string`YesFull ID of the post containing the comment.`parentId``string`YesFull ID of the parent comment, or the post ID for a top-level comment.`deletedAt``string`NoDeletion time as an ISO 8601 string.`author``UserV2`NoComment author when available; deleted identities can be redacted.`createdAt``string`NoOriginal creation time as an ISO 8601 string.`source``EventSource`YesActor category associated with the deletion. It can be unknown.`reason``DeletionReason`YesNormalized deletion reason. It can be unspecified or unknown.`subreddit``SubredditV2`NoSubreddit that contained the comment.

Important behavior: Do not expect the deleted body in this payload. A moderator removal can also produce `onModAction`; make cleanup idempotent if you subscribe to both.

## Moderation and community events​

### onModAction​

Represents: A moderator action recorded in a subreddit's moderation log, such as approving, removing, locking, distinguishing, stickying, or changing flair.

Delivery: This is a moderation event. Its target content can already be unavailable or sanitized when your handler runs.

Payload: `OnModActionRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"ModAction"`YesEvent discriminator.`action``string`NoModeration action name.`actionedAt``string`NoAction time as an ISO 8601 string.`subreddit``SubredditV2`NoSubreddit where the action occurred.`moderator``UserV2`NoModerator when available; the identity can be masked.`targetUser``UserV2`NoTarget user for user-related actions.`targetComment``CommentV2`NoTarget comment for comment-related actions.`targetPost``PostV2`NoTarget post for post-related actions.`id``string`NoIdentifier for the moderation action.

Important behavior: Target fields depend on `action`; never assume a particular target is present. Treat action names as an evolving string set and handle unknown values safely. Moderator and administrator identities can be replaced with masked identities.

### onModMail​

Represents: A message being sent or received in a modmail conversation associated with the installation.

Delivery: This is a messaging event. It contains message and conversation metadata, not the message body.

Payload: `OnModMailRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"ModMail"`YesEvent discriminator.`messageAuthor``UserV2`NoMessage author when available.`createdAt``string`NoMessage creation time as an ISO 8601 string.`messageAuthorType``string`YesRole used by the author, such as moderator or participant.`conversationState``string`YesCurrent state, such as new, in progress, or archived.`conversationType``string`YesConversation category, such as subreddit-to-user or internal.`isAutoGenerated``boolean`YesWhether Reddit or an automated system generated the message.`conversationSubreddit``SubredditV2`NoSubreddit that owns the conversation.`destinationSubreddit``SubredditV2`NoDestination subreddit for subreddit-to-subreddit conversations.`conversationId``string`YesBase36 conversation ID without a thing prefix.`messageId``string`YesBase36 message ID without a thing prefix.

Important behavior: Fetch the conversation through the Reddit API when your app needs message contents or current conversation state. `destinationSubreddit` is only relevant to conversation types that have one.

### onAutomoderatorFilterPost​

Represents: AutoModerator filtering a post.

Delivery: This event represents a post filtered by AutoModerator.

Payload: `OnAutomoderatorFilterPostRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"AutomoderatorFilterPost"`YesEvent discriminator.`post``PostV2`NoSnapshot of the filtered post.`removedAt``string`NoFiltering time as an ISO 8601 string.`reason``string`YesAutoModerator reason when available; it can be empty.`author``string`YesAuthor's user ID as a string, not a `UserV2` object.`subreddit``SubredditV2`NoSubreddit containing the post.

Important behavior: This trigger is specific to AutoModerator filtering. Use `onModAction` for broader moderator actions and `onPostDelete` for other deletion or removal events. Do not assume an AutoModerator-filter-only post also emits `onPostDelete`.

### onAutomoderatorFilterComment​

Represents: AutoModerator filtering a comment.

Delivery: This event represents a comment filtered by AutoModerator.

Payload: `OnAutomoderatorFilterCommentRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"AutomoderatorFilterComment"`YesEvent discriminator.`comment``CommentV2`NoSnapshot of the filtered comment.`removedAt``string`NoFiltering time as an ISO 8601 string.`reason``string`YesAutoModerator reason when available; it can be empty.`author``string`YesAuthor's user ID as a string, not a `UserV2` object.`subreddit``SubredditV2`NoSubreddit containing the comment.

Important behavior: This trigger is specific to AutoModerator filtering. Use `onModAction` for broader moderator actions and `onCommentDelete` for other deletion or removal events. Do not assume an AutoModerator filter also emits `onCommentDelete`.

## App lifecycle events​

### onAppInstall​

Represents: The app being installed in a subreddit.

Delivery: This lifecycle event is produced by an installation change, not by an ordinary app upload.

Payload: `OnAppInstallRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"AppInstall"`YesEvent discriminator.`subreddit``SubredditV2`NoSubreddit where the app was installed.`installer``UserV2`NoUser who initiated the installation when available.

Important behavior: Make initialization safe to retry because the event can be delivered more than once. Do not require `installer` to be present.

### onAppUpgrade​

Represents: A subreddit installation moving to a different version of the app.

Delivery: This lifecycle event is produced when an installation changes version. Uploading or publishing a version does not by itself invoke every installation.

Payload: `OnAppUpgradeRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"AppUpgrade"`YesEvent discriminator.`subreddit``SubredditV2`NoSubreddit whose installation was upgraded.`installer``UserV2`NoUser who initiated the upgrade when available.

Important behavior: Make migrations idempotent and track your own schema or migration version. The payload does not contain the previous and new app version numbers.

## Global events​

### onMentionInCommentCreate​

Represents: A newly created comment that mentions the app's username.

Delivery: This is a limited-access global event.

Payload: `OnMentionInCommentCreateRequest`

View payload fieldsFieldTypeRequiredMeaning`type``"MentionInCommentCreate"`YesEvent discriminator.`comment``CommentV2`NoSnapshot of the comment containing the mention.`author``UserV2`NoComment author.`post``PostV2`NoPost containing the comment.`subreddit``SubredditV2`NoSubreddit containing the comment.`mentions``Mentions`NoParsed username mentions found in the comment.

Important behavior: The event has additional access, profile-installation, subreddit, and playtest requirements. Review App Mention Triggers before using it.
