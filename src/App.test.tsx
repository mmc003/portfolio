import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

// The gallery is API-driven now; mock fetch so views don't hit the network.
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      items: [],
      pagination: { nextCursor: null, hasMore: false },
    }),
  }) as unknown as typeof fetch;
});

test("renders the navbar logo", async () => {
  render(<App />);
  expect(await screen.findByText("Michael Chu")).toBeInTheDocument();
});
