import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Switch } from "@base-ui/react/switch";
import {
  getOceanState,
  setOceanVisible,
  setZen,
  subscribeOcean,
} from "./ocean-scene.js";

function AtmosphereSwitch({
  checked,
  disabled = false,
  label,
  description,
  onCheckedChange,
}) {
  return (
    <label className="ocean-switch type-action">
      <Switch.Root
        className="ocean-switch-root"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      >
        <Switch.Thumb className="ocean-switch-thumb" />
      </Switch.Root>
      <span>{label}</span>
      <span className="visually-hidden">{description}</span>
    </label>
  );
}

function OceanControls() {
  const [state, setState] = useState(getOceanState);

  useEffect(() => subscribeOcean(setState), []);

  if (!state.available) return null;

  return (
    <div className="ocean-controls" role="group" aria-label="Homepage atmosphere">
      <AtmosphereSwitch
        checked={state.visible}
        onCheckedChange={setOceanVisible}
        label="Ocean"
        description="Show the animated ocean and sky behind the homepage. Turn off to use the plain page background."
      />
      <AtmosphereSwitch
        checked={state.zen}
        disabled={!state.visible}
        onCheckedChange={setZen}
        label="Zen"
        description="Hide the page and show only the ocean, sun, and moon. Press Escape to leave Zen."
      />
    </div>
  );
}

const mount = document.querySelector("[data-ocean-controls]");

if (mount) {
  createRoot(mount).render(
    <StrictMode>
      <OceanControls />
    </StrictMode>,
  );
}
