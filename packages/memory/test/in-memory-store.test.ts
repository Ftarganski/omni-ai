import { describe, it, expect } from "vitest";
import { InMemoryStore } from "../src/stores/in-memory.js";

const session = { resourceId: "user1", threadId: "thread1" };
const other = { resourceId: "user2", threadId: "thread2" };

describe("InMemoryStore", () => {
  it("saves and loads messages in order", async () => {
    const store = new InMemoryStore();
    await store.saveMessages(session, [
      { role: "user", content: "hello", timestamp: 1 },
      { role: "assistant", content: "hi", timestamp: 2 },
    ]);
    const loaded = await store.loadMessages(session);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].content).toBe("hello");
    expect(loaded[1].content).toBe("hi");
  });

  it("isolates sessions from each other", async () => {
    const store = new InMemoryStore();
    await store.saveMessages(session, [{ role: "user", content: "s1", timestamp: 1 }]);
    await store.saveMessages(other, [{ role: "user", content: "s2", timestamp: 2 }]);
    expect(await store.loadMessages(session)).toHaveLength(1);
    expect(await store.loadMessages(other)).toHaveLength(1);
    expect((await store.loadMessages(session))[0].content).toBe("s1");
  });

  it("respects the limit parameter", async () => {
    const store = new InMemoryStore();
    for (let i = 0; i < 5; i++) {
      await store.saveMessages(session, [{ role: "user", content: `msg${i}`, timestamp: i }]);
    }
    const limited = await store.loadMessages(session, 3);
    expect(limited).toHaveLength(3);
    expect(limited[0].content).toBe("msg2");
  });

  it("search returns messages containing the query", async () => {
    const store = new InMemoryStore();
    await store.saveMessages(session, [
      { role: "user", content: "implement the orders module", timestamp: 1 },
      { role: "assistant", content: "I will create the service", timestamp: 2 },
      { role: "user", content: "unrelated message", timestamp: 3 },
    ]);
    const results = await store.search(session, "orders");
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain("orders");
  });

  it("get and set working memory round-trips", async () => {
    const store = new InMemoryStore();
    expect(await store.getWorkingMemory(session)).toBeNull();
    await store.setWorkingMemory(session, "current task: orders module");
    expect(await store.getWorkingMemory(session)).toBe("current task: orders module");
  });

  it("returns empty array for unknown session", async () => {
    const store = new InMemoryStore();
    expect(await store.loadMessages(session)).toHaveLength(0);
  });
});
