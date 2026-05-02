import "@girs/gjs";
import "@girs/gjs/dom";
import "@girs/gnome-shell/ambient";
import "@girs/gnome-shell/extensions/global";
import { EasingParamsWithProperties } from "@girs/gnome-shell/extensions/global";

declare module '@girs/clutter-17/clutter-17' {
    export namespace Clutter {
        interface Actor {
            /**
             * New async function starting from Gnome Shell 50
             *
             * @version 50
             * @see https://gjs.guide/extensions/upgrading/gnome-shell-50.html#gnome-shell
             */
            easeAsync(props: EasingParamsWithProperties): Promise<void>;
        }
    }
}