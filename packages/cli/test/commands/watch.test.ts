import { describe, expect, it, vi } from "vitest";
import { buildDebounce } from "../../src/commands/watch.js";

describe("buildDebounce", () => {
  it("calls the function after the delay", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = buildDebounce(fn, 200);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("resets the timer on repeated calls", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = buildDebounce(fn, 200);

    debounced();
    await vi.advanceTimersByTimeAsync(100);
    debounced();
    await vi.advanceTimersByTimeAsync(100);
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("calls the function multiple times after separate debounce windows", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = buildDebounce(fn, 100);

    debounced();
    await vi.advanceTimersByTimeAsync(100);
    debounced();
    await vi.advanceTimersByTimeAsync(100);

    expect(fn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
