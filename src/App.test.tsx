import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
  await waitFor(() => expect(screen.getByText("Michael Chu")).toBeInTheDocument());
});
