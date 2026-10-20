// Shared state. Most state belongs to one module and is read from it; these four objects hold what several modules change.

export const game = {};   // where the game is: state (title | intro | count | play | crash | finish | ...), mode, clocks, run records
export const race = {};   // the current track and race: settings, length, start, timings, results
export const view = {};   // the camera and what the renderer collects each frame
export const menu = {};   // menu cursors and title-screen flags

export const ATT = { on: false };                // the splash's intro video (see ATTRACT, at the end): while it's on, the game is playing itself
