"use client";

import { UiContext } from "@applicator/sdk/context";

interface Props {
  context?: UiContext;
}

export default function App({ context }: Props) {
  return (
    <div>
      <h1>My App</h1>
    </div>
  );
}
