import { WebHaptics } from "web-haptics";

// Shared singleton — survives across component mounts/unmounts and navigations,
// so multi-step patterns (e.g. "success" double-tap) complete on iOS.
export const haptics = new WebHaptics();
