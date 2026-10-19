import { SPORTS } from "../../sports";
import { SportPage } from "../SportPage";

export function SwimmingPage() {
  return <SportPage config={SPORTS.swim} />;
}
