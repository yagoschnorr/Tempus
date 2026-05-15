import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "../src/lib/mocks/server";
import { resetMockState } from "../src/lib/mocks/handlers";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetMockState();
});
afterAll(() => server.close());
