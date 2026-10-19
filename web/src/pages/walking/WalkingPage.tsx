import { SPORTS } from "../../sports";
import { SportPage } from "../SportPage";

export function WalkingPage() {
  return <SportPage config={SPORTS.walk} />;
}
