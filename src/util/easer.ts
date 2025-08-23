// Copied from https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/gnome-48/js/ui/environment.js?ref_type=heads

// Fix: Convert camelCase strings to kebab-case for actor transitions.
// The `easeActor` function receives camelCase string from `EasingParamsWithProperties`.
// The `actor.get_transition()` method, however, expects a kebab-case string.
// This change ensures the string format is correct for the transition lookup.

import type Clutter from "gi://Clutter";
import type { EasingParamsWithProperties } from "@girs/gnome-shell/extensions/global";

const kebabize = (str: string) =>
  str.replace(
    /[A-Z]+(?![a-z])|[A-Z]/g,
    ($: string, ofs: boolean) => (ofs ? "-" : "") + $.toLowerCase(),
  );

function makeEaseCallback(
  params: EasingParamsWithProperties,
  cleanup: () => void,
) {
  const onComplete = params.onComplete;
  delete params.onComplete;

  const onStopped = params.onStopped;
  delete params.onStopped;

  return (isFinished: boolean) => {
    cleanup();

    if (onStopped) onStopped(isFinished);
    if (onComplete && isFinished) onComplete();
  };
}

export function easeActor(
  actor: Clutter.Actor,
  params: EasingParamsWithProperties,
) {
  params = {
    repeatCount: 0,
    autoReverse: false,
    ...params,
  };

  actor.save_easing_state();

  if (params.duration !== undefined) actor.set_easing_duration(params.duration);
  delete params.duration;

  if (params.delay !== undefined) actor.set_easing_delay(params.delay);
  delete params.delay;

  const repeatCount = params.repeatCount ?? 0;
  delete params.repeatCount;

  const autoReverse = params.autoReverse;
  delete params.autoReverse;

  // repeatCount doesn't include the initial iteration
  const numIterations = repeatCount + 1;
  // whether the transition should finish where it started
  const isReversed = autoReverse && numIterations % 2 === 0;

  if (params.mode !== undefined) actor.set_easing_mode(params.mode);
  delete params.mode;

  const prepare = () => {
    global.compositor.disable_unredirect();
    global.begin_work();
  };
  const cleanup = () => {
    global.compositor.enable_unredirect();
    global.end_work();
  };
  const callback = makeEaseCallback(params, cleanup);

  // cancel overwritten transitions
  // let animatedProps = Object.keys(params).map(p => p.replace('_', '-', 'g')); // Original function
  const animatedProps = Object.keys(params).map(kebabize);
  animatedProps.forEach((p) => actor.remove_transition(p));

  if (actor.get_easing_duration() > 0 || !isReversed) actor.set(params);
  actor.restore_easing_state();

  const transitions = animatedProps
    .map((p) => actor.get_transition(p))
    .filter((t) => t !== null);

  transitions.forEach((t) => t.set({ repeatCount, autoReverse }));

  const [transition] = transitions;

  if (transition?.delay) {
    transition.connect("started", () => prepare());
  } else {
    prepare();
  }

  if (transition) {
    transition.connect("stopped", (_source, finished) => callback(finished));
  } else {
    callback(true);
  }
}
