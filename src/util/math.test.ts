import { describe, expect, test } from "bun:test";

interface Geometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

const randomMargin = (): number => {
    return Math.floor(Math.random() * 20);
}

const windowActor = (window: Geometry): Geometry => {
    const margin = {
        top: randomMargin(),
        right: randomMargin(),
        bottom: randomMargin(),
        left: randomMargin(),
    }

    return {
        x: window.x - margin.right,
        y: window.y - margin.top,
        width: window.width + ((margin.left + margin.right) * 2),
        height: window.height + ((margin.top + margin.bottom) * 2),
    }
}

const actorMargin = (window: Geometry, actor: Geometry) => {
    const top = window.y - actor.y;
    const left = window.x - actor.x;
    const right = actor.width - window.width - left;
    const bottom = actor.height - window.height - top;
    return {
        top,
        right,
        bottom,
        left,
    }
}

const scaleActorX = (window: Geometry, actor: Geometry, scaleX: number): void => {
    actor.width = actor.width * scaleX;
    window.width = window.width * scaleX;
    window.x = window.x + ((window.x - actor.x) * (scaleX - 1));
}

describe("scale X from (0, 0)", () => {
    const windowMaker = (): Geometry => {
        return {
            x: 0,
            y: 0,
            width: 400,
            height: 400,
        }
    }

    test("scale X by 2", () => {
        const window = windowMaker();
        const actor = windowActor(window);
        const margin = actorMargin(window, actor);

        scaleActorX(window, actor, 2);
        expect(window.x).toBe(margin.left); // Exactly the same as the left margin
    });

    test("scale X by 3", () => {
        const window = windowMaker();
        const actor = windowActor(window);
        const margin = actorMargin(window, actor);

        scaleActorX(window, actor, 3);
        expect(window.x).toBe(margin.left * 2); // Exactly the same as the left margin * 2
    });

    test("scale X by 0.5", () => {
        const window = windowMaker();
        const actor = windowActor(window);
        const margin = actorMargin(window, actor);

        scaleActorX(window, actor, 0.5);
        expect(window.x).toBe(-margin.left / 2);
    });
})

describe("scale X from (100, 100)", () => {
    const windowMaker = (): Geometry => {
        return {
            x: 100,
            y: 100,
            width: 400,
            height: 400,
        }
    }

    test("scale X by 2", () => {
        const window = windowMaker();
        const actor = windowActor(window);
        const margin = actorMargin(window, actor);

        scaleActorX(window, actor, 2);
        expect(window.x).toBe(windowMaker().x + margin.left); // Exactly the same as the left margin
    });

    test("scale X by 3", () => {
        const window = windowMaker();
        const actor = windowActor(window);
        const margin = actorMargin(window, actor);

        scaleActorX(window, actor, 3);
        expect(window.x).toBe(windowMaker().x + margin.left * 2); // Exactly the same as the left margin * 2
    });

    test("scale X by 0.5", () => {
        const window = windowMaker();
        const actor = windowActor(window);
        const margin = actorMargin(window, actor);

        scaleActorX(window, actor, 0.5);
        expect(window.x).toBe(windowMaker().x + -margin.left / 2);
    });
})

describe("scale X from (random, random)", () => {
    const x = Math.floor(Math.random() * 1920);
    const y = Math.floor(Math.random() * 1080);
    const windowMaker = (): Geometry => {
        return {
            x: x,
            y: y,
            width: 400,
            height: 400,
        }
    }

    test("scale X by 2", () => {
        const window = windowMaker();
        const actor = windowActor(window);
        const margin = actorMargin(window, actor);

        scaleActorX(window, actor, 2);
        expect(window.x).toBe(windowMaker().x + margin.left); // Exactly the same as the left margin
    });

    test("scale X by 3", () => {
        const window = windowMaker();
        const actor = windowActor(window);
        const margin = actorMargin(window, actor);

        scaleActorX(window, actor, 3);
        expect(window.x).toBe(windowMaker().x + margin.left * 2); // Exactly the same as the left margin * 2
    });

    test("scale X by 0.5", () => {
        const window = windowMaker();
        const actor = windowActor(window);
        const margin = actorMargin(window, actor);

        scaleActorX(window, actor, 0.5);
        expect(window.x).toBe(windowMaker().x + -margin.left / 2);
    });
})

const scaleActorY = (window: Geometry, actor: Geometry, scaleY: number): void => {
    actor.height = actor.height * scaleY;
    window.height = window.height * scaleY;
    window.y = window.y + ((window.y - actor.y) * (scaleY - 1));
}

const moveActorY = (window: Geometry, actor: Geometry, y: number): void => {
    window.y = y + (window.y - actor.y);
    actor.y = y;
}

const moveActorX = (window: Geometry, actor: Geometry, x: number): void => {
    window.x = x + (window.x - actor.x);
    actor.x = x;
}

const moveResize = (window: Geometry, actor: Geometry, target: Geometry): void => {
    const margin = actorMargin(window, actor);
    const scaleX = target.width / window.width;
    const scaleY = target.height / window.height;
    moveActorX(window, actor, target.x - (scaleX * margin.left));
    moveActorY(window, actor, target.y - (scaleY * margin.top));
    scaleActorX(window, actor, scaleX);
    scaleActorY(window, actor, scaleY);
}


describe("move resize", () => {
    // Animate resize actor to position B.
    const window: Geometry = {
        x: 0,
        y: 0,
        width: 400,
        height: 400,
    }
    const target: Geometry = {
        x: 930,
        y: 290,
        width: 1000,
        height: 800,
    }
    const actor = windowActor(window);
    moveResize(window, actor, target);
    test("x", () => {
        expect(window.x).toBe(target.x);
    });
    test("y", () => {
        expect(window.y).toBe(target.y);
    });
    test("width", () => {
        expect(window.width).toBe(target.width);
    });
    test("height", () => {
        expect(window.height).toBe(target.height);
    });
})

describe("move resize scene 2", () => {
    // Animate resize actor to position B.
    const window: Geometry = {
        x: 930,
        y: 290,
        width: 1000,
        height: 800,
    }
    const target: Geometry = {
        x: 0,
        y: 0,
        width: 400,
        height: 400,
    }
    const actor = windowActor(window);
    moveResize(window, actor, target);
    test("x", () => {
        expect(window.x).toBe(target.x);
    });
    test("y", () => {
        expect(window.y).toBe(target.y);
    });
    test("width", () => {
        expect(window.width).toBe(target.width);
    });
    test("height", () => {
        expect(window.height).toBe(target.height);
    });
})

describe("move resize scene 3", () => {
    // Move resize window to position B,
    // Move resize actor to position A,
    // Animate resize actor to position B.
    const window: Geometry = {
        x: 930,
        y: 290,
        width: 1000,
        height: 800,
    }
    const posA: Geometry = {
        x: 930,
        y: 290,
        width: 1000,
        height: 800,
    }
    const posB: Geometry = {
        x: 0,
        y: 0,
        width: 400,
        height: 400,
    }

    window.x = posB.x;
    window.y = posB.y;
    window.width = posB.width;
    window.height = posB.height;
    
    const actor = windowActor(window);

    moveResize(window, actor, posA);
    moveResize(window, actor, posB);
    test("x", () => {
        expect(window.x).toBe(posB.x);
    });
    test("y", () => {
        expect(window.y).toBe(posB.y);
    });
    test("width", () => {
        expect(window.width).toBe(posB.width);
    });
    test("height", () => {
        expect(window.height).toBe(posB.height);
    });
})