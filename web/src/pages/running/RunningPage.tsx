import { TrainingPlan } from "../../components/TrainingPlan";
import { SPORTS } from "../../sports";
import { SportPage } from "../SportPage";

export function RunningPage() {
  return (
    <SportPage config={SPORTS.run}>
      <TrainingPlan />
    </SportPage>
  );
}
