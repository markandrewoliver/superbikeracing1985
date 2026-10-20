import type { Form } from "@devvit/web/shared";
import type { PostKindId } from "../shared/api";

/**
 * The subreddit menu is **one row**, and this is the chooser behind it.
 *
 * `menu.items` in `devvit.json` is an ordered list and Reddit addresses each
 * row by its **index** (`menuItem.${index}`); the label is display text the
 * client cached from whenever it last read the list. Insert a row and every
 * row below it is renumbered — and a client still drawing the old list fires
 * the right index into the wrong meaning, with stale labels and no error
 * anywhere. Nothing you upload can invalidate that cached list (incognito sees
 * it too). **One row is the fix that does not depend on the cache.**
 *
 * **Adding a post kind is three things, and none of them is a menu row:**
 *
 *   1. an entry in `POST_KINDS` below, naming a `formName`;
 *   2. `"<formName>": "/internal/forms/<path>"` in `devvit.json` → `forms`
 *      (forms are addressed by NAME, so adding one renumbers nothing);
 *   3. a `router.post("/internal/forms/<path>", ...)` in routes/internal.ts.
 *
 * Nothing checks that the three agree — `npm run check:kinds` does. A mismatch
 * otherwise fails only at the moment a moderator picks that kind.
 *
 * A moderator tool that is not "create a post" does not need the menu at all:
 * put it in an admin screen inside the app, which has no index to collide with.
 */
export type PostKind = {
  /** What `postData.kind` will say. */
  value: PostKindId;
  /** The chooser's option label (moderator-facing). */
  label: string;
  /** Key in devvit.json → forms. */
  formName: string;
  /** The kind's own form, built at press time so it can read live state. */
  form: () => Promise<Form>;
};

export const POST_KINDS: PostKind[] = [
  {
    value: "example",
    label: "Example post",
    formName: "newExample",
    form: async () => ({
      title: "Create an example post",
      acceptLabel: "Create post",
      fields: [{ type: "string", name: "title", label: "Post title", required: true }],
    }),
  },
];

export function chooseKindForm(): Form {
  return {
    title: "Create a post",
    acceptLabel: "Next",
    fields: [
      {
        type: "select",
        name: "kind",
        label: "Kind",
        required: true,
        options: POST_KINDS.map(({ label, value }) => ({ label, value })),
        defaultValue: [POST_KINDS[0]!.value],
      },
    ],
  };
}

/** The chosen kind, or null for a value this build does not have — which is
 * what a client holding an older chooser would send. */
export function postKindByValue(value: string): PostKind | null {
  return POST_KINDS.find((k) => k.value === value) ?? null;
}
