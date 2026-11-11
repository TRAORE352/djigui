import { redirect } from "next/navigation";

/** /agent/distribution → la sous-page « Recevoir » (ancienne adresse). */
export default function Distribution() {
  redirect("/agent/distribution/recevoir");
}
